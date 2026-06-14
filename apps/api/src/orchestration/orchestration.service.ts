/**
 * OrchestrationService — employee hierarchy + request routing ("ask the wrong
 * employee → divert to the right one").
 *
 * Routing uses deterministic keyword classification against each employee's
 * routing_keywords (no token cost per route; a model classifier can replace it
 * later). High confidence auto-dispatches; otherwise the decision is PROPOSED
 * for a human to confirm or divert. A viewer never auto-dispatches.
 */
import { Injectable, Logger } from '@nestjs/common';
import { eq, and, isNull, desc } from 'drizzle-orm';
import {
  DrizzleService,
  agents,
  agentRelationships,
  routingDecisions,
  agentRuns,
  agentMemories,
} from '../drizzle/drizzle.service.js';
import { inngest } from '../inngest/client.js';
import { runsEmitter } from '../gateway/runs-emitter.js';

export interface OrchestrationCtx {
  organizationId: string;
  workspaceId?: string;
  userId: string;
  role?: string;
}

function threshold(): number {
  return Number(process.env['ORCHESTRATION_AUTODISPATCH_THRESHOLD'] ?? 0.85);
}

@Injectable()
export class OrchestrationService {
  private readonly logger = new Logger(OrchestrationService.name);
  constructor(private readonly drizzle: DrizzleService) {}

  // ── Relationships ──────────────────────────────────────────────────────────
  listRelationships(ctx: OrchestrationCtx) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const items = await tx
        .select()
        .from(agentRelationships)
        .where(eq(agentRelationships.organizationId, ctx.organizationId));
      return { items, nextCursor: null };
    });
  }

  createRelationship(ctx: OrchestrationCtx, input: { fromAgentId: string; toAgentId: string; kind: 'supervises' | 'watches' | 'delegates_to' }) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [row] = await tx
        .insert(agentRelationships)
        .values({
          organizationId: ctx.organizationId,
          workspaceId: ctx.workspaceId ?? null,
          fromAgentId: input.fromAgentId,
          toAgentId: input.toAgentId,
          kind: input.kind,
        })
        .onConflictDoNothing()
        .returning();
      return row ?? { ...input };
    });
  }

  removeRelationship(ctx: OrchestrationCtx, id: string) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      await tx
        .delete(agentRelationships)
        .where(and(eq(agentRelationships.id, id), eq(agentRelationships.organizationId, ctx.organizationId)));
    });
  }

  // ── Routing ──────────────────────────────────────────────────────────────────
  listDecisions(ctx: OrchestrationCtx) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const items = await tx
        .select()
        .from(routingDecisions)
        .where(eq(routingDecisions.organizationId, ctx.organizationId));
      return { items, nextCursor: null };
    });
  }

  /** Classify a request to the best-fit employee and propose or auto-dispatch. */
  async route(ctx: OrchestrationCtx, requestText: string) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const candidates = await tx
        .select({ id: agents.id, name: agents.name, keywords: agents.routingKeywords, isRouter: agents.isRouter })
        .from(agents)
        .where(and(eq(agents.organizationId, ctx.organizationId), isNull(agents.deletedAt)));

      // ── Learning loop: a prior human correction for this request wins ────────
      // If someone previously diverted/confirmed this exact request to an
      // employee, route there with high confidence — no human needed this time.
      const learned = await this.findLearnedRoute(tx, ctx.organizationId, requestText, candidates.map((c) => c.id));
      const { agentId, confidence, reasoning } = learned ?? classify(requestText, candidates);
      const canAutoDispatch = ctx.role !== 'viewer' && confidence >= threshold() && !!agentId;
      const status = canAutoDispatch ? 'auto_dispatched' : 'proposed';

      const [decision] = await tx
        .insert(routingDecisions)
        .values({
          organizationId: ctx.organizationId,
          workspaceId: ctx.workspaceId ?? null,
          requestText,
          proposedAgentId: agentId,
          chosenAgentId: canAutoDispatch ? agentId : null,
          confidence: confidence.toFixed(3),
          status,
          reasoning,
          createdBy: ctx.userId,
        })
        .returning();

      let runId: string | null = null;
      if (canAutoDispatch && agentId) {
        runId = await this.dispatch(tx, ctx, decision!.id, agentId, requestText);
      }

      // Stream the proposal/resolution for live UIs.
      if (ctx.workspaceId) {
        if (status === 'proposed') {
          runsEmitter()?.emitRunStatus(ctx.workspaceId, { routingDecisionId: decision!.id, type: 'routing:proposed', agentId, confidence });
        } else {
          runsEmitter()?.emitRunStatus(ctx.workspaceId, { routingDecisionId: decision!.id, type: 'routing:resolved', agentId, status });
        }
      }

      return { ...decision!, runId, autoDispatched: canAutoDispatch };
    });
  }

  /** Confirm a proposed decision (optionally diverting to a different employee). */
  async confirm(ctx: OrchestrationCtx, decisionId: string, divertToAgentId?: string) {
    const out = await this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [decision] = await tx
        .select()
        .from(routingDecisions)
        .where(and(eq(routingDecisions.id, decisionId), eq(routingDecisions.organizationId, ctx.organizationId)))
        .limit(1);
      if (!decision) return null;
      if (decision.status !== 'proposed') return { decision, alreadyResolved: true };

      const chosenAgentId = divertToAgentId ?? decision.proposedAgentId;
      if (!chosenAgentId) return { decision, noAgent: true };

      const runId = await this.dispatch(tx, ctx, decisionId, chosenAgentId, decision.requestText);
      await tx
        .update(routingDecisions)
        .set({ status: divertToAgentId ? 'diverted' : 'confirmed', chosenAgentId, runId, updatedAt: new Date() })
        .where(eq(routingDecisions.id, decisionId));

      // Learn from the human's choice so the same request routes itself next time.
      await this.writeRoutingCorrection(tx, ctx, decision.requestText, chosenAgentId, runId);

      return { decision, chosenAgentId, runId, diverted: !!divertToAgentId };
    });

    if (out && 'runId' in out && out.runId && ctx.workspaceId) {
      runsEmitter()?.emitRunStatus(ctx.workspaceId, {
        routingDecisionId: decisionId, type: 'routing:resolved', agentId: out.chosenAgentId, status: out.diverted ? 'diverted' : 'confirmed',
      });
    }
    return out ?? { ok: false, reason: 'NOT_FOUND' };
  }

  /** Persist a routing correction as a durable, workspace-visible memory. */
  private async writeRoutingCorrection(
    tx: Parameters<Parameters<DrizzleService['withTenant']>[2]>[0],
    ctx: OrchestrationCtx,
    requestText: string,
    agentId: string,
    runId: string | null,
  ): Promise<void> {
    await tx.insert(agentMemories).values({
      organizationId: ctx.organizationId,
      workspaceId: ctx.workspaceId ?? null,
      agentId,
      scope: 'long_term',
      kind: 'routing_correction',
      visibility: 'workspace',
      content: normalizeRequest(requestText),
      sourceRunId: runId,
      salience: '0.900',
      metadata: { rawRequest: requestText },
    });
  }

  /** Look up a learned routing correction matching this request (exact-normalized). */
  private async findLearnedRoute(
    tx: Parameters<Parameters<DrizzleService['withTenant']>[2]>[0],
    organizationId: string,
    requestText: string,
    candidateIds: string[],
  ): Promise<{ agentId: string; confidence: number; reasoning: string } | null> {
    const norm = normalizeRequest(requestText);
    const rows = await tx
      .select({ agentId: agentMemories.agentId, content: agentMemories.content, salience: agentMemories.salience })
      .from(agentMemories)
      .where(and(
        eq(agentMemories.organizationId, organizationId),
        eq(agentMemories.kind, 'routing_correction'),
        eq(agentMemories.content, norm),
      ))
      .orderBy(desc(agentMemories.salience), desc(agentMemories.createdAt))
      .limit(1);
    const hit = rows[0];
    // Only honour a learned route to an employee that still exists.
    if (hit && candidateIds.includes(hit.agentId)) {
      return { agentId: hit.agentId, confidence: 0.95, reasoning: 'Learned from a prior human correction for this request.' };
    }
    return null;
  }

  /** Create a queued run for the chosen agent + emit agent/run (best-effort). */
  private async dispatch(
    tx: Parameters<Parameters<DrizzleService['withTenant']>[2]>[0],
    ctx: OrchestrationCtx,
    routingDecisionId: string,
    agentId: string,
    requestText: string,
  ): Promise<string | null> {
    const [agent] = await tx
      .select({ activeVersionId: agents.activeVersionId })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);
    if (!agent?.activeVersionId) return null;

    const [run] = await tx
      .insert(agentRuns)
      .values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId ?? null,
        agentId,
        agentVersionId: agent.activeVersionId,
        triggerType: 'event',
        status: 'queued',
        input: requestText,
        routingDecisionId,
      })
      .returning({ id: agentRuns.id });

    try {
      await inngest.send({ name: 'agent/run', data: { runId: run!.id, organizationId: ctx.organizationId, workspaceId: ctx.workspaceId } });
    } catch (err) {
      this.logger.error(`routed agent/run emit failed for run ${run!.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
    return run!.id;
  }
}

/** Normalize a request for exact-match learned-route lookup. */
function normalizeRequest(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 500);
}

interface Candidate { id: string; name: string; keywords: unknown; isRouter: boolean }

/** Deterministic keyword classifier → { agentId, confidence (0..1), reasoning }. */
export function classify(requestText: string, candidates: Candidate[]): { agentId: string | null; confidence: number; reasoning: string } {
  const text = requestText.toLowerCase();
  let best: { id: string; name: string; matched: number } | null = null;

  for (const c of candidates) {
    const kws = Array.isArray(c.keywords) ? (c.keywords as unknown[]).map((k) => String(k).toLowerCase()) : [];
    const matched = kws.filter((k) => k && text.includes(k)).length;
    if (matched > 0 && (!best || matched > best.matched)) best = { id: c.id, name: c.name, matched };
  }

  if (best) {
    // 1 keyword → 0.6, 2 → 0.78, 3+ → capped near 0.99.
    const confidence = Math.min(0.6 + (best.matched - 1) * 0.18, 0.99);
    return { agentId: best.id, confidence, reasoning: `Matched ${best.matched} keyword(s) for "${best.name}".` };
  }

  // No keyword match → route to a router employee if one exists (low confidence).
  const router = candidates.find((c) => c.isRouter);
  if (router) return { agentId: router.id, confidence: 0.3, reasoning: 'No keyword match; defaulting to the router employee.' };
  if (candidates.length) return { agentId: candidates[0]!.id, confidence: 0.1, reasoning: 'No keyword match and no router; low-confidence fallback.' };
  return { agentId: null, confidence: 0, reasoning: 'No employees available to route to.' };
}
