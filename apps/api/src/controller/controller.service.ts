/**
 * ControllerService — the AI Controller, executed IN-PROCESS (no Inngest server).
 *
 * Flow: a natural-language command → the model plans a sequence of actions chosen
 * ONLY from the closed Action Registry (it cannot invent actions) → each action is
 * Zod-validated → server actions (agent.create / agent.run) run here via the same
 * services the REST API uses; browser actions are resolved to concrete app routes
 * and returned to the web client to perform (router.push). The last plan per session
 * is kept in memory for GET /sessions/:id/actions.
 */
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { ModelRouter } from '@bitecodes/ai-core';
import { ACTION_REGISTRY, validateActionArgs, getAction } from '@bitecodes/ai-controller';
import type { AgentInput } from '@bitecodes/shared';
import { AgentService } from '../agent/agent.service.js';
import { executeAgentRun } from '../inngest/agent.run.js';

export interface ControllerCtx {
  organizationId: string;
  workspaceId: string;
  userId: string;
  role?: string;
}

export interface PlannedAction {
  name: string;
  args: Record<string, unknown>;
  target: 'browser' | 'server' | 'both';
  riskClass: 'safe' | 'confirm' | 'destructive';
  status: 'executed' | 'ready' | 'acknowledged' | 'invalid';
  result?: unknown;
  note?: string;
  error?: string;
}

export interface ClientAction {
  /** A concrete app route the browser should navigate to. */
  to: string;
  label: string;
}

export interface DispatchResult {
  sessionId: string;
  command: string;
  summary: string;
  actions: PlannedAction[];
  clientActions: ClientAction[];
  startedAt: string;
}

// Routes the Controller is allowed to send the browser to.
const KNOWN_ROUTES: Record<string, string> = {
  dashboard: '/app/dashboard',
  agents: '/app/agents',
  content: '/app/content',
  inbox: '/app/inbox',
  knowledge: '/app/knowledge',
  workflows: '/app/workflows',
  marketplace: '/app/marketplace',
  analytics: '/app/analytics',
  settings: '/app/settings',
  connectors: '/app/connectors',
  billing: '/app/settings',
};

/** Describe a Zod schema's top-level fields as a compact map for the planner prompt. */
function describeType(t: any): string {
  const tn = t?._def?.typeName;
  if (tn === 'ZodOptional' || tn === 'ZodDefault') return describeType(t._def.innerType) + '?';
  if (tn === 'ZodString') return 'string';
  if (tn === 'ZodNumber') return 'number';
  if (tn === 'ZodBoolean') return 'boolean';
  if (tn === 'ZodArray') return describeType(t._def.type) + '[]';
  if (tn === 'ZodEnum') return (t._def.values as string[]).map((v) => JSON.stringify(v)).join('|');
  if (tn === 'ZodRecord') return 'object';
  if (tn === 'ZodUnknown' || tn === 'ZodAny') return 'any';
  return 'any';
}
function describeArgs(schema: z.ZodTypeAny): Record<string, string> {
  const def: any = (schema as any)._def;
  if (def?.typeName !== 'ZodObject') return {};
  const shape = def.shape();
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(shape)) out[key] = describeType(val as any);
  return out;
}

function buildSystemPrompt(): string {
  const catalog = ACTION_REGISTRY.map(
    (a) => `- ${a.name} [${a.target}] — ${a.description} args: ${JSON.stringify(describeArgs(a.argsSchema))}`,
  ).join('\n');
  return [
    'You are the Bitecodes AI Controller. You turn a user request into an ordered plan of platform actions.',
    'You may ONLY use actions from this closed catalog — never invent an action name or argument.',
    '',
    'Catalog:',
    catalog,
    '',
    'For "navigate", set args.to to one of these routes: /app/dashboard, /app/agents, /app/agents/new, /app/content, /app/inbox, /app/knowledge, /app/workflows, /app/marketplace, /app/analytics, /app/settings, /app/connectors.',
    'To hire/create an employee use agent.create with a sensible role. For "open/go to X" use navigate.',
    '',
    'Respond with ONLY a JSON object, no prose and no code fences:',
    '{"summary":"one friendly sentence describing what you will do","actions":[{"name":"<action>","args":{}}]}',
    'If nothing in the catalog fits, return an empty actions array and explain in summary.',
  ].join('\n');
}

@Injectable()
export class ControllerService {
  private readonly logger = new Logger(ControllerService.name);
  private readonly router = new ModelRouter();
  private readonly sessions = new Map<string, DispatchResult>();

  constructor(private readonly agents: AgentService) {}

  getSession(sessionId: string): { sessionId: string; actions: PlannedAction[]; clientActions: ClientAction[]; summary: string } {
    const s = this.sessions.get(sessionId);
    return s
      ? { sessionId, actions: s.actions, clientActions: s.clientActions, summary: s.summary }
      : { sessionId, actions: [], clientActions: [], summary: '' };
  }

  async dispatch(sessionId: string, command: string, ctx: ControllerCtx): Promise<DispatchResult> {
    const startedAt = new Date().toISOString();
    const plan = await this.plan(command);

    const actions: PlannedAction[] = [];
    const clientActions: ClientAction[] = [];

    for (const step of plan.actions) {
      const def = getAction(step.name);
      if (!def) {
        actions.push({ name: step.name, args: step.args, target: 'server', riskClass: 'safe', status: 'invalid', error: `Unknown action: ${step.name}` });
        continue;
      }
      const validation = validateActionArgs(step.name, step.args);
      if (!validation.success) {
        actions.push({ name: step.name, args: step.args, target: def.target, riskClass: def.riskClass, status: 'invalid', error: validation.error });
        continue;
      }
      const args = validation.data as Record<string, unknown>;
      try {
        const outcome = await this.execute(def.name, def.target, args, ctx, clientActions);
        actions.push({ name: def.name, args, target: def.target, riskClass: def.riskClass, ...outcome });
      } catch (err) {
        actions.push({ name: def.name, args, target: def.target, riskClass: def.riskClass, status: 'invalid', error: err instanceof Error ? err.message : String(err) });
      }
    }

    const result: DispatchResult = { sessionId, command, summary: plan.summary, actions, clientActions, startedAt };
    this.sessions.set(sessionId, result);
    return result;
  }

  /** Ask the model for a JSON action plan; tolerate code fences / stray prose. */
  private async plan(command: string): Promise<{ summary: string; actions: Array<{ name: string; args: Record<string, unknown> }> }> {
    let content = '';
    try {
      const resp = await this.router.route({
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: command },
        ],
        costTier: 'smart',
        temperature: 0.1,
      } as never);
      content = (resp as { message?: { content?: string | null } }).message?.content ?? '';
    } catch (err) {
      this.logger.error(`controller plan failed: ${err instanceof Error ? err.message : String(err)}`);
      return { summary: 'I could not reach the planner right now. Please try again.', actions: [] };
    }
    const parsed = safeParsePlan(content);
    if (!parsed) return { summary: content.trim().slice(0, 300) || 'I could not turn that into an action.', actions: [] };
    return parsed;
  }

  private async execute(
    name: string,
    target: 'browser' | 'server' | 'both',
    args: Record<string, unknown>,
    ctx: ControllerCtx,
    clientActions: ClientAction[],
  ): Promise<Pick<PlannedAction, 'status' | 'result' | 'note'>> {
    // ── Server actions we fully execute ───────────────────────────────────────
    if (name === 'agent.create') {
      const input = { name: String(args['name'] ?? 'New Employee'), role: String(args['role'] ?? 'AI Employee') } as AgentInput;
      const agent = await this.agents.create(input, ctx);
      const id = (agent as { id?: string }).id;
      if (id) clientActions.push({ to: `/app/agents/${id}`, label: `Open ${input.name}` });
      return { status: 'executed', result: { agentId: id, name: input.name } };
    }
    if (name === 'agent.run') {
      const agentId = String(args['agentId']);
      const runId = await this.agents.createRun(agentId, args['input'] ?? '', ctx);
      this.fireRun(runId);
      clientActions.push({ to: `/app/agents/${agentId}`, label: 'Watch the run' });
      return { status: 'executed', result: { runId } };
    }

    // ── Browser actions → resolve to a concrete route the client navigates to ──
    if (target === 'browser' || target === 'both') {
      const nav = this.toRoute(name, args);
      if (nav) {
        clientActions.push(nav);
        return { status: 'ready', note: `Navigating: ${nav.label}` };
      }
    }

    // ── Remaining server actions: acknowledge + send the user to the right page ─
    const fallback = this.fallbackRoute(name);
    if (fallback) {
      clientActions.push(fallback);
      return { status: 'acknowledged', note: `Opening ${fallback.label} so you can complete this step.` };
    }
    return { status: 'acknowledged', note: 'Planned. This step needs your confirmation in the relevant area.' };
  }

  private toRoute(name: string, args: Record<string, unknown>): ClientAction | null {
    switch (name) {
      case 'navigate': {
        const to = String(args['to'] ?? '/app/dashboard');
        return { to: to.startsWith('/') ? to : `/app/${to}`, label: `Go to ${to}` };
      }
      case 'agent.open':
        return { to: `/app/agents/${String(args['agentId'])}`, label: 'Open employee' };
      case 'content.open':
        return { to: KNOWN_ROUTES['content']!, label: 'Open Content' };
      case 'settings.open':
        return { to: KNOWN_ROUTES['settings']!, label: 'Open Settings' };
      case 'billing.open':
        return { to: KNOWN_ROUTES['billing']!, label: 'Open Billing' };
      case 'connector.start':
        return { to: KNOWN_ROUTES['connectors']!, label: 'Open Connectors' };
      case 'workflow.open':
        return { to: KNOWN_ROUTES['workflows']!, label: 'Open Workflows' };
      default:
        return null;
    }
  }

  private fallbackRoute(name: string): ClientAction | null {
    if (name.startsWith('content') || name.startsWith('blog')) return { to: KNOWN_ROUTES['content']!, label: 'Content' };
    if (name.startsWith('inbox')) return { to: KNOWN_ROUTES['inbox']!, label: 'Inbox' };
    if (name.startsWith('knowledge')) return { to: KNOWN_ROUTES['knowledge']!, label: 'Knowledge' };
    return null;
  }

  /** Execute a queued run in-process (same inline-step shim the agent REST route uses). */
  private fireRun(runId: string): void {
    const inlineStep = {
      async run<T>(_id: string, fn: () => Promise<T>): Promise<T> { return fn(); },
      async waitForEvent() { return null; },
      async sendEvent() { return undefined; },
    };
    const logger = {
      warn: (o: unknown, m?: string) => console.warn(m ?? '', o),
      error: (o: unknown, m?: string) => console.error(m ?? '', o),
    };
    void executeAgentRun({ event: { data: { runId } }, step: inlineStep as never, logger } as never).catch(
      (err: unknown) => console.error('[controller agent.run] inline execution failed:', err),
    );
  }
}

/** Extract a JSON plan from model output, tolerating ```json fences and surrounding prose. */
function safeParsePlan(text: string): { summary: string; actions: Array<{ name: string; args: Record<string, unknown> }> } | null {
  if (!text) return null;
  let body = text.trim();
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) body = fence[1]!.trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const obj = JSON.parse(body.slice(start, end + 1));
    const actions = Array.isArray(obj.actions)
      ? obj.actions
          .filter((a: unknown) => a && typeof (a as { name?: unknown }).name === 'string')
          .map((a: { name: string; args?: Record<string, unknown> }) => ({ name: a.name, args: a.args ?? {} }))
      : [];
    return { summary: typeof obj.summary === 'string' ? obj.summary : 'Here is the plan.', actions };
  } catch {
    return null;
  }
}
