/**
 * Microsoft Teams ⇄ employee bridge.
 *
 * Lets a user assign an employee (agent) a Microsoft Teams identity (an email),
 * then converse with that employee through Teams. The assignment is an
 * `agent_triggers` row of type `webhook` with config
 *   { channel: 'teams', teamsEmail, connectorId? }
 * (no new catalog names — reuses the trigger system, the webhook ingress, and
 * the run/approval events; BUILD_GUIDE §6/§7).
 *
 * Conversation loop:
 *   Teams message → Graph change-notification → POST /hooks/teams
 *     → webhook/received → teamsInboundFunction:
 *         resolve the assigned employee, create an agent_runs row, emit agent/run
 *   run finishes → run/finished → teamsReplyFunction:
 *         approvalMode 'never' (or bypass) → send the reply via Graph now;
 *         otherwise hold the reply as a pending 'send' approval (review & permission)
 *   approval/decided (approved) → teamsApprovedSendFunction: send the held reply
 *
 * Microsoft Graph is called over fetch; the access token is opened from
 * connector_credentials with the connector vault. Real-time delivery requires a
 * Graph subscription pointed at /hooks/teams (validated by the validationToken
 * handshake in WebhookController).
 */
import { inngest } from './client.js';
import { eq, and, desc } from 'drizzle-orm';
import {
  agents, agentTriggers, agentRuns, employeeControls, approvals,
  connectors, connectorCredentials,
} from '@bitecodes/db';
import { systemDb, withTenant, type RuntimeDb } from './runtime-db.js';
import { openSecret } from '../connector-oauth/vault.js';

interface TeamsAssignment { channel?: string; teamsEmail?: string; connectorId?: string }
interface TeamsRunInput { channel: 'teams'; text: string; chatId: string; connectorId?: string | null; from?: string | null }
interface ParsedTeamsMessage { recipientEmail?: string; chatId?: string; text?: string; from?: string }

/** Normalise a Teams webhook body into the fields we need. Supports a simple
 *  relay shape and Microsoft Graph rich change-notifications. */
function parseTeamsMessage(payload: unknown): ParsedTeamsMessage | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, any>;
  // Simple relay shape (also what the tests post).
  if (p['text'] || p['message'] || p['chatId'] || p['recipientEmail']) {
    return {
      recipientEmail: p['recipientEmail'] ?? p['toEmail'] ?? p['assignedEmail'],
      chatId: p['chatId'],
      text: p['text'] ?? p['message'],
      from: p['from'] ?? p['senderName'],
    };
  }
  // Graph rich notification: value[0].resourceData
  const note = Array.isArray(p['value']) ? p['value'][0] : undefined;
  const rd = note?.resourceData;
  if (rd) {
    const resource: string = note?.resource ?? '';
    const chatId = rd.chatId ?? resource.match(/chats\('([^']+)'\)/)?.[1];
    return {
      recipientEmail: note?.clientState,
      chatId,
      text: rd.body?.content ?? rd.bodyPreview,
      from: rd.from?.user?.displayName,
    };
  }
  return null;
}

/** Open the access token sealed in a connector's most-recent credential row. */
async function connectorAccessToken(tx: RuntimeDb, connectorId: string): Promise<string | null> {
  const [cred] = await tx
    .select({ encryptedSecret: connectorCredentials.encryptedSecret })
    .from(connectorCredentials)
    .where(eq(connectorCredentials.connectorId, connectorId))
    .orderBy(desc(connectorCredentials.createdAt))
    .limit(1);
  if (!cred) return null;
  try {
    const opened = JSON.parse(await openSecret(cred.encryptedSecret)) as { access_token?: string };
    return opened.access_token ?? null;
  } catch {
    return null;
  }
}

/** Resolve the Teams connector for the workspace if the assignment did not pin one. */
async function resolveTeamsConnectorId(tx: RuntimeDb, pinned?: string | null): Promise<string | null> {
  if (pinned) return pinned;
  const [c] = await tx
    .select({ id: connectors.id })
    .from(connectors)
    .where(and(eq(connectors.type, 'teams'), eq(connectors.status, 'connected')))
    .limit(1);
  return c?.id ?? null;
}

/** Send a chat message to Teams via Microsoft Graph. Returns the message id or throws. */
async function sendTeamsViaGraph(accessToken: string, chatId: string, text: string): Promise<string> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/chats/${chatId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: { contentType: 'html', content: text } }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) throw new Error(`Graph send failed ${res.status}: ${JSON.stringify(data['error'] ?? data)}`);
  return String(data['id'] ?? '');
}

/** Extract the human-readable reply text from a run's output. */
function replyText(output: unknown): string {
  if (output == null) return '';
  if (typeof output === 'string') return output;
  if (typeof output === 'object') {
    const o = output as Record<string, unknown>;
    for (const k of ['content', 'text', 'message', 'output', 'result', 'response', 'answer', 'reply']) {
      if (typeof o[k] === 'string') return o[k] as string;
    }
    try { return JSON.stringify(output); } catch { return String(output); }
  }
  return String(output);
}

// ── 1. Inbound: a Teams message → create a run for the assigned employee ──────
export const teamsInboundFunction = inngest.createFunction(
  { id: 'teams/inbound', name: 'Route inbound Teams message to its employee' },
  { event: 'webhook/received' },
  async ({ event }) => {
    const data = event.data as { source?: string; payload?: unknown };
    if (data.source !== 'teams') return { skipped: 'not teams' };
    const msg = parseTeamsMessage(data.payload);
    if (!msg?.text || !msg.chatId) return { skipped: 'no message text/chat' };
    const text = msg.text;
    const chatId = msg.chatId;

    const db = systemDb();
    // Find the webhook trigger assigned to this Teams identity.
    const triggers = await db
      .select({
        agentId: agentTriggers.agentId,
        organizationId: agentTriggers.organizationId,
        workspaceId: agentTriggers.workspaceId,
        config: agentTriggers.config,
      })
      .from(agentTriggers)
      .where(and(eq(agentTriggers.type, 'webhook'), eq(agentTriggers.enabled, true)));

    const match = triggers.find((t) => {
      const c = (t.config ?? {}) as TeamsAssignment;
      if (c.channel !== 'teams') return false;
      if (!msg.recipientEmail) return true; // single Teams employee → no disambiguation needed
      return c.teamsEmail?.toLowerCase() === msg.recipientEmail.toLowerCase();
    });
    if (!match) return { skipped: 'no assigned employee' };

    const orgId = match.organizationId;
    const wsId = match.workspaceId ?? undefined;
    const cfg = (match.config ?? {}) as TeamsAssignment;

    const runId = await withTenant(orgId, wsId, async (tx) => {
      const [agent] = await tx
        .select({ activeVersionId: agents.activeVersionId })
        .from(agents)
        .where(eq(agents.id, match.agentId))
        .limit(1);
      if (!agent?.activeVersionId) return null;

      const connectorId = await resolveTeamsConnectorId(tx, cfg.connectorId ?? null);
      const input: TeamsRunInput = { channel: 'teams', text, chatId, connectorId, from: msg.from ?? null };
      const [run] = await tx
        .insert(agentRuns)
        .values({
          organizationId: orgId,
          workspaceId: wsId ?? null,
          agentId: match.agentId,
          agentVersionId: agent.activeVersionId,
          triggerType: 'webhook',
          status: 'queued',
          input: input as object,
        })
        .returning({ id: agentRuns.id });
      return run!.id;
    });

    if (!runId) return { skipped: 'employee has no active version' };
    await inngest.send({ name: 'agent/run', data: { runId, organizationId: orgId, workspaceId: wsId } });
    return { runId };
  },
);

// ── 2. Outbound: a Teams-originated run finished → reply (gated by approval) ──
export const teamsReplyFunction = inngest.createFunction(
  { id: 'teams/reply', name: 'Send an employee reply back to Teams' },
  { event: 'run/finished' },
  async ({ event }) => {
    const { runId, status } = event.data as { runId: string; status?: string };
    if ((status ?? '').toLowerCase() !== 'succeeded') return { skipped: `status ${status}` };

    const db = systemDb();
    const [run] = await db
      .select({
        organizationId: agentRuns.organizationId,
        workspaceId: agentRuns.workspaceId,
        agentId: agentRuns.agentId,
        input: agentRuns.input,
        output: agentRuns.output,
      })
      .from(agentRuns)
      .where(eq(agentRuns.id, runId))
      .limit(1);
    if (!run) return { skipped: 'run not found' };
    const input = (run.input ?? {}) as Partial<TeamsRunInput>;
    if (input.channel !== 'teams' || !input.chatId) return { skipped: 'not a teams run' };
    const chatId = input.chatId;
    const text = replyText(run.output);
    if (!text) return { skipped: 'empty reply' };

    const orgId = run.organizationId;
    const wsId = run.workspaceId ?? undefined;

    return withTenant(orgId, wsId, async (tx) => {
      const [ctrl] = await tx
        .select({ approvalMode: employeeControls.approvalMode, bypassPermission: employeeControls.bypassPermission })
        .from(employeeControls)
        .where(eq(employeeControls.agentId, run.agentId))
        .limit(1);
      const mode = ctrl?.approvalMode ?? 'risky';
      const auto = (ctrl?.bypassPermission ?? false) || mode === 'never';
      const connectorId = await resolveTeamsConnectorId(tx, input.connectorId ?? null);

      if (auto) {
        if (!connectorId) return { sent: false, reason: 'no connected Teams connector' };
        const token = await connectorAccessToken(tx, connectorId);
        if (!token) return { sent: false, reason: 'no token' };
        const messageId = await sendTeamsViaGraph(token, chatId, text);
        return { sent: true, messageId };
      }

      // Gated: hold the reply as a pending 'send' approval (review & permission).
      await tx.insert(approvals).values({
        organizationId: orgId,
        workspaceId: wsId ?? null,
        runId,
        kind: 'send',
        status: 'pending',
        payload: { channel: 'teams', chatId, text, connectorId } as object,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      return { sent: false, reason: 'awaiting approval' };
    });
  },
);

// ── 3. After approval: send the held Teams reply ─────────────────────────────
export const teamsApprovedSendFunction = inngest.createFunction(
  { id: 'teams/approved-send', name: 'Send an approved Teams reply' },
  { event: 'approval/decided' },
  async ({ event }) => {
    const { approvalId, decision } = event.data as { approvalId?: string; decision?: string };
    if (!approvalId || decision !== 'approved') return { skipped: 'not an approval' };

    const db = systemDb();
    const [appr] = await db
      .select({
        organizationId: approvals.organizationId,
        workspaceId: approvals.workspaceId,
        kind: approvals.kind,
        payload: approvals.payload,
      })
      .from(approvals)
      .where(eq(approvals.id, approvalId))
      .limit(1);
    if (!appr || appr.kind !== 'send') return { skipped: 'not a send approval' };
    const p = (appr.payload ?? {}) as { channel?: string; chatId?: string; text?: string; connectorId?: string | null };
    if (p.channel !== 'teams' || !p.chatId || !p.text) return { skipped: 'not a teams send' };
    const chatId = p.chatId;
    const text = p.text;

    const orgId = appr.organizationId;
    const wsId = appr.workspaceId ?? undefined;
    return withTenant(orgId, wsId, async (tx) => {
      const connectorId = await resolveTeamsConnectorId(tx, p.connectorId ?? null);
      if (!connectorId) return { sent: false, reason: 'no connected Teams connector' };
      const token = await connectorAccessToken(tx, connectorId);
      if (!token) return { sent: false, reason: 'no token' };
      const messageId = await sendTeamsViaGraph(token, chatId, text);
      return { sent: true, messageId };
    });
  },
);
