/**
 * TriggerService — CRUD for agent_triggers (manual/schedule/webhook/event).
 *
 * Schedule triggers store `{ intervalMinutes, nextRunAt, input? }` in config; the
 * scheduler cron (inngest/scheduler.tick) fires due ones and advances nextRunAt.
 */
import { Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DrizzleService, agentTriggers } from '../drizzle/drizzle.service.js';

export interface TriggerCtx {
  organizationId: string;
  workspaceId?: string;
  userId: string;
}

export interface TriggerInput {
  type: 'manual' | 'schedule' | 'webhook' | 'event';
  config?: Record<string, unknown>;
  enabled?: boolean;
}

@Injectable()
export class TriggerService {
  constructor(private readonly drizzle: DrizzleService) {}

  list(ctx: TriggerCtx, agentId: string) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const items = await tx
        .select()
        .from(agentTriggers)
        .where(and(eq(agentTriggers.agentId, agentId), eq(agentTriggers.organizationId, ctx.organizationId)));
      return { items, nextCursor: null };
    });
  }

  create(ctx: TriggerCtx, agentId: string, input: TriggerInput) {
    const config = this.normalizeConfig(input);
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [row] = await tx
        .insert(agentTriggers)
        .values({
          agentId,
          organizationId: ctx.organizationId,
          workspaceId: ctx.workspaceId ?? null,
          type: input.type,
          config,
          enabled: input.enabled ?? true,
        })
        .returning();
      return row!;
    });
  }

  update(ctx: TriggerCtx, agentId: string, triggerId: string, patch: Partial<TriggerInput>) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (patch.enabled !== undefined) set['enabled'] = patch.enabled;
      if (patch.config !== undefined) set['config'] = this.normalizeConfig({ type: patch.type ?? 'schedule', config: patch.config });
      const [row] = await tx
        .update(agentTriggers)
        .set(set)
        .where(and(
          eq(agentTriggers.id, triggerId),
          eq(agentTriggers.agentId, agentId),
          eq(agentTriggers.organizationId, ctx.organizationId),
        ))
        .returning();
      return row ?? null;
    });
  }

  remove(ctx: TriggerCtx, agentId: string, triggerId: string) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      await tx
        .delete(agentTriggers)
        .where(and(
          eq(agentTriggers.id, triggerId),
          eq(agentTriggers.agentId, agentId),
          eq(agentTriggers.organizationId, ctx.organizationId),
        ));
    });
  }

  /** For a schedule trigger, seed nextRunAt from intervalMinutes if absent. */
  private normalizeConfig(input: TriggerInput): Record<string, unknown> {
    const config = { ...(input.config ?? {}) };
    if (input.type === 'schedule') {
      const interval = Number(config['intervalMinutes'] ?? 0);
      if (interval > 0 && !config['nextRunAt']) {
        config['nextRunAt'] = new Date(Date.now() + interval * 60 * 1000).toISOString();
      }
    }
    return config;
  }
}
