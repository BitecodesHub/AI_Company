/**
 * ControlsService — per-employee (agent) operational controls.
 *
 * 1:1 with agents. Reads return defaults when no row exists yet (no write on
 * GET). Writes upsert inside withTenant. Privilege rule (enforced in the
 * controller): only an owner may enable bypass_permission or approval_mode=never.
 */
import { Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DrizzleService, employeeControls } from '../drizzle/drizzle.service.js';

export interface ControlsCtx {
  organizationId: string;
  workspaceId?: string;
  userId: string;
}

export type ActivationState = 'active' | 'paused' | 'deactivated';
export type ApprovalMode = 'always' | 'risky' | 'never';

export interface ControlsPatch {
  activationState?: ActivationState;
  approvalMode?: ApprovalMode;
  bypassPermission?: boolean;
  planMode?: boolean;
  maxRunsPerDay?: number | null;
  dailyCostCapUsd?: number | null;
}

const DEFAULTS = {
  activationState: 'active' as ActivationState,
  approvalMode: 'risky' as ApprovalMode,
  bypassPermission: false,
  planMode: false,
  maxRunsPerDay: null as number | null,
  dailyCostCapUsd: null as number | null,
};

@Injectable()
export class ControlsService {
  constructor(private readonly drizzle: DrizzleService) {}

  async get(ctx: ControlsCtx, agentId: string) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [row] = await tx
        .select()
        .from(employeeControls)
        .where(and(eq(employeeControls.agentId, agentId), eq(employeeControls.organizationId, ctx.organizationId)))
        .limit(1);
      return row ? this.shape(row) : { agentId, ...DEFAULTS };
    });
  }

  async upsert(ctx: ControlsCtx, agentId: string, patch: ControlsPatch) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [existing] = await tx
        .select({ id: employeeControls.id })
        .from(employeeControls)
        .where(and(eq(employeeControls.agentId, agentId), eq(employeeControls.organizationId, ctx.organizationId)))
        .limit(1);

      const values = {
        ...patch,
        dailyCostCapUsd: patch.dailyCostCapUsd != null ? String(patch.dailyCostCapUsd) : undefined,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      };

      if (existing) {
        const [row] = await tx
          .update(employeeControls)
          .set(values)
          .where(eq(employeeControls.id, existing.id))
          .returning();
        return this.shape(row!);
      }
      const [row] = await tx
        .insert(employeeControls)
        .values({
          agentId,
          organizationId: ctx.organizationId,
          workspaceId: ctx.workspaceId ?? null,
          ...DEFAULTS,
          ...patch,
          dailyCostCapUsd: patch.dailyCostCapUsd != null ? String(patch.dailyCostCapUsd) : null,
          updatedBy: ctx.userId,
        })
        .returning();
      return this.shape(row!);
    });
  }

  setActivation(ctx: ControlsCtx, agentId: string, activationState: ActivationState) {
    return this.upsert(ctx, agentId, { activationState });
  }

  private shape(row: typeof employeeControls.$inferSelect) {
    return {
      agentId: row.agentId,
      activationState: row.activationState,
      approvalMode: row.approvalMode,
      bypassPermission: row.bypassPermission,
      planMode: row.planMode,
      maxRunsPerDay: row.maxRunsPerDay,
      dailyCostCapUsd: row.dailyCostCapUsd != null ? Number(row.dailyCostCapUsd) : null,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    };
  }
}
