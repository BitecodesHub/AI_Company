/**
 * AgentService — real persistence for agents + agent_versions.
 * All queries run inside withTenant() so RLS is enforced.
 */
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { DrizzleService, agents, agentVersions, agentRuns, employeeControls } from '../drizzle/drizzle.service.js';
import type { AgentInput } from '@bitecodes/shared';
import crypto from 'node:crypto';
import { OnboardingService } from '../onboarding/onboarding.service.js';

/** Input for hiring an employee from a role template (marketplace). */
export interface HireInput {
  name: string;
  role: string;
  goal?: string;
  systemPrompt?: string;
  costTier?: 'fast' | 'smart' | 'auto';
  avatar?: string;
  isRouter?: boolean;
  routingKeywords?: string[];
}

@Injectable()
export class AgentService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly onboarding: OnboardingService,
  ) {}

  async create(
    input: AgentInput,
    ctx: { organizationId: string; workspaceId: string; userId: string },
  ) {
    const agentId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const slug = input.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50)
      + '-' + agentId.slice(0, 8);

    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [agent] = await (tx as any)
        .insert(agents)
        .values({
          id: agentId,
          organizationId: ctx.organizationId,
          workspaceId: ctx.workspaceId,
          name: input.name,
          slug,
          role: input.role,
          goal: input.goal,
          mode: input.mode ?? 'sandbox',
          defaultModel: input.defaultModel,
          costTier: input.costTier ?? 'auto',
          activeVersionId: versionId,
          createdBy: ctx.userId,
        })
        .returning();

      await (tx as any)
        .insert(agentVersions)
        .values({
          id: versionId,
          agentId,
          organizationId: ctx.organizationId,
          workspaceId: ctx.workspaceId,
          systemPrompt: input.systemPrompt ?? '',
          config: {
            tools: input.tools ?? [],
            knowledgeBaseIds: input.knowledgeBaseIds ?? [],
            approvalRequiredFor: input.approvalRequiredFor ?? ['publish', 'send', 'destructive'],
            guardrails: input.guardrails ?? {},
          },
          createdBy: ctx.userId,
        });

      return agent;
    });
  }

  /** Wraps create() and advances the onboarding checklist (best-effort). */
  async createWithOnboarding(input: AgentInput, ctx: { organizationId: string; workspaceId: string; userId: string }) {
    const agent = await this.create(input, ctx);
    try {
      await this.onboarding.markStep(ctx, 'hire_employee');
    } catch { /* onboarding advance is best-effort; never blocks agent creation */ }
    return agent;
  }

  /**
   * Hire an employee from a role template (marketplace). Provisions the agent
   * with router flag + routing keywords, an immutable v1, and default controls,
   * in one transaction — then advances onboarding.
   */
  async hire(input: HireInput, ctx: { organizationId: string; workspaceId: string; userId: string }) {
    const agentId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const slug = input.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50) + '-' + agentId.slice(0, 8);

    const agent = await this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [row] = await (tx as any)
        .insert(agents)
        .values({
          id: agentId,
          organizationId: ctx.organizationId,
          workspaceId: ctx.workspaceId,
          name: input.name,
          slug,
          role: input.role,
          goal: input.goal,
          mode: 'production',
          costTier: input.costTier ?? 'auto',
          avatar: input.avatar,
          isRouter: input.isRouter ?? false,
          routingKeywords: input.routingKeywords ?? [],
          activeVersionId: versionId,
          createdBy: ctx.userId,
        })
        .returning();

      await (tx as any).insert(agentVersions).values({
        id: versionId,
        agentId,
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        systemPrompt: input.systemPrompt ?? `You are ${input.name}, the ${input.role}.`,
        config: { tools: [], knowledgeBaseIds: [], guardrails: {} },
        createdBy: ctx.userId,
      });

      await (tx as any).insert(employeeControls).values({
        agentId,
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        activationState: 'active',
        approvalMode: 'risky',
        updatedBy: ctx.userId,
      });

      return row;
    });

    try { await this.onboarding.markStep(ctx, 'hire_employee'); } catch { /* best-effort */ }
    return agent;
  }

  async list(ctx: { organizationId: string; workspaceId: string }, cursor?: string, limit = 20) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const rows = await (tx as any)
        .select()
        .from(agents)
        .where(and(
          eq(agents.organizationId, ctx.organizationId),
          eq(agents.workspaceId, ctx.workspaceId),
          isNull(agents.deletedAt),
        ))
        .orderBy(desc(agents.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      return {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : null,
        total: items.length,
      };
    });
  }

  async findById(id: string, ctx: { organizationId: string; workspaceId: string }) {
    const [agent] = await this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      return (tx as any)
        .select()
        .from(agents)
        .where(and(eq(agents.id, id), isNull(agents.deletedAt)))
        .limit(1);
    });
    if (!agent) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Agent not found.' });
    return agent;
  }

  async update(
    id: string,
    data: Partial<AgentInput>,
    ctx: { organizationId: string; workspaceId: string },
  ) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [updated] = await (tx as any)
        .update(agents)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(agents.id, id), isNull(agents.deletedAt)))
        .returning();
      if (!updated) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Agent not found.' });
      return updated;
    });
  }

  async softDelete(id: string, ctx: { organizationId: string; workspaceId: string }) {
    await this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      await (tx as any)
        .update(agents)
        .set({ deletedAt: new Date() })
        .where(and(eq(agents.id, id), isNull(agents.deletedAt)));
    });
  }

  async listVersions(agentId: string, ctx: { organizationId: string; workspaceId: string }) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      return (tx as any)
        .select()
        .from(agentVersions)
        .where(eq(agentVersions.agentId, agentId))
        .orderBy(desc(agentVersions.createdAt));
    });
  }

  async createVersion(
    agentId: string,
    input: { systemPrompt: string; config: unknown },
    ctx: { organizationId: string; workspaceId: string; userId: string },
  ) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      // Get latest version number
      const existing = await (tx as any)
        .select({ versionNumber: agentVersions.versionNumber })
        .from(agentVersions)
        .where(eq(agentVersions.agentId, agentId))
        .orderBy(desc(agentVersions.versionNumber))
        .limit(1);

      const nextVersion = (existing[0]?.versionNumber ?? 0) + 1;
      const id = crypto.randomUUID();

      const [version] = await (tx as any)
        .insert(agentVersions)
        .values({
          id,
          agentId,
          organizationId: ctx.organizationId,
          workspaceId: ctx.workspaceId,
          versionNumber: nextVersion,
          systemPrompt: input.systemPrompt,
          config: input.config,
          createdBy: ctx.userId,
        })
        .returning();
      return version;
    });
  }

  async activateVersion(
    agentId: string,
    versionId: string,
    ctx: { organizationId: string; workspaceId: string },
  ) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [updated] = await (tx as any)
        .update(agents)
        .set({ activeVersionId: versionId, updatedAt: new Date() })
        .where(and(eq(agents.id, agentId), isNull(agents.deletedAt)))
        .returning();
      if (!updated) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Agent not found.' });
      return updated;
    });
  }

  /** Create a queued agent_runs row for the agent's active version. Returns runId. */
  async createRun(
    agentId: string,
    input: unknown,
    ctx: { organizationId: string; workspaceId: string },
  ): Promise<string> {
    const runId = crypto.randomUUID();
    await this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [agent] = await (tx as any)
        .select({ activeVersionId: agents.activeVersionId })
        .from(agents)
        .where(and(eq(agents.id, agentId), isNull(agents.deletedAt)))
        .limit(1);
      if (!agent) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Agent not found.' });
      if (!agent.activeVersionId) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Agent has no active version.' });
      }
      await (tx as any).insert(agentRuns).values({
        id: runId,
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        agentId,
        agentVersionId: agent.activeVersionId,
        triggerType: 'manual',
        status: 'queued',
        input: input ?? null,
      });
    });
    return runId;
  }

  /** Read the knowledge bases attached to an agent's active version. */
  async getKnowledge(agentId: string, ctx: { organizationId: string; workspaceId: string }): Promise<string[]> {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [agent] = await (tx as any)
        .select({ activeVersionId: agents.activeVersionId })
        .from(agents)
        .where(and(eq(agents.id, agentId), isNull(agents.deletedAt)))
        .limit(1);
      if (!agent?.activeVersionId) return [];
      const [version] = await (tx as any)
        .select({ config: agentVersions.config })
        .from(agentVersions)
        .where(eq(agentVersions.id, agent.activeVersionId))
        .limit(1);
      const cfg = (version?.config ?? {}) as { knowledgeBaseIds?: string[] };
      return Array.isArray(cfg.knowledgeBaseIds) ? cfg.knowledgeBaseIds : [];
    });
  }

  /** Attach a set of knowledge bases to the agent's active version (merged into config). */
  async setKnowledge(agentId: string, knowledgeBaseIds: string[], ctx: { organizationId: string; workspaceId: string }) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [agent] = await (tx as any)
        .select({ activeVersionId: agents.activeVersionId })
        .from(agents)
        .where(and(eq(agents.id, agentId), isNull(agents.deletedAt)))
        .limit(1);
      if (!agent?.activeVersionId) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Agent has no active version.' });
      const [version] = await (tx as any)
        .select({ config: agentVersions.config })
        .from(agentVersions)
        .where(eq(agentVersions.id, agent.activeVersionId))
        .limit(1);
      const cfg = { ...((version?.config ?? {}) as Record<string, unknown>), knowledgeBaseIds };
      await (tx as any)
        .update(agentVersions)
        .set({ config: cfg })
        .where(eq(agentVersions.id, agent.activeVersionId));
      return { knowledgeBaseIds };
    });
  }

  /** Read the connectors (tools) attached to an agent's active version. */
  async getConnectors(agentId: string, ctx: { organizationId: string; workspaceId: string }): Promise<string[]> {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [agent] = await (tx as any)
        .select({ activeVersionId: agents.activeVersionId })
        .from(agents)
        .where(and(eq(agents.id, agentId), isNull(agents.deletedAt)))
        .limit(1);
      if (!agent?.activeVersionId) return [];
      const [version] = await (tx as any)
        .select({ config: agentVersions.config })
        .from(agentVersions)
        .where(eq(agentVersions.id, agent.activeVersionId))
        .limit(1);
      const cfg = (version?.config ?? {}) as { connectorIds?: string[] };
      return Array.isArray(cfg.connectorIds) ? cfg.connectorIds : [];
    });
  }

  /** Attach a set of connectors to the agent's active version (merged into config). */
  async setConnectors(agentId: string, connectorIds: string[], ctx: { organizationId: string; workspaceId: string }) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [agent] = await (tx as any)
        .select({ activeVersionId: agents.activeVersionId })
        .from(agents)
        .where(and(eq(agents.id, agentId), isNull(agents.deletedAt)))
        .limit(1);
      if (!agent?.activeVersionId) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Agent has no active version.' });
      const [version] = await (tx as any)
        .select({ config: agentVersions.config })
        .from(agentVersions)
        .where(eq(agentVersions.id, agent.activeVersionId))
        .limit(1);
      const cfg = { ...((version?.config ?? {}) as Record<string, unknown>), connectorIds };
      await (tx as any)
        .update(agentVersions)
        .set({ config: cfg })
        .where(eq(agentVersions.id, agent.activeVersionId));
      return { connectorIds };
    });
  }
}
