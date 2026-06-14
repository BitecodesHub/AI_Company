/**
 * ApprovalService — real approval listing + decisions.
 *
 * decide() resolves the REAL runId from the approval row (no more runId:'todo'),
 * persists the decision, and emits approval/decided so the waiting executor
 * resumes. decideByToken() does the same for a signed email link (no session —
 * the HMAC authorizes it), using the system connection since there is no tenant
 * context on a public link.
 */
import { Injectable, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DrizzleService, approvals } from '../drizzle/drizzle.service.js';
import { inngest } from '../inngest/client.js';
import { verifyApprovalToken } from '../common/approval-link.js';

export interface ApprovalCtx {
  organizationId: string;
  workspaceId?: string;
  userId: string;
}

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);
  constructor(private readonly drizzle: DrizzleService) {}

  async listPending(ctx: ApprovalCtx) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const rows = await tx
        .select({
          id: approvals.id, runId: approvals.runId, kind: approvals.kind,
          payload: approvals.payload, status: approvals.status,
          expiresAt: approvals.expiresAt, createdAt: approvals.createdAt,
        })
        .from(approvals)
        .where(and(eq(approvals.organizationId, ctx.organizationId), eq(approvals.status, 'pending')));
      return { items: rows, nextCursor: null };
    });
  }

  /** Decide an approval as an authenticated tenant user. */
  async decide(ctx: ApprovalCtx, approvalId: string, decision: 'approved' | 'rejected', decidedBy: string) {
    const result = await this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [row] = await tx
        .select({ runId: approvals.runId, status: approvals.status })
        .from(approvals)
        .where(and(eq(approvals.id, approvalId), eq(approvals.organizationId, ctx.organizationId)))
        .limit(1);
      if (!row) return null;
      if (row.status !== 'pending') return { runId: row.runId, already: true };

      await tx
        .update(approvals)
        .set({ status: decision, decidedBy, decidedAt: new Date() })
        .where(eq(approvals.id, approvalId));
      return { runId: row.runId, already: false };
    });

    if (!result) return { approvalId, decision, ok: false, reason: 'NOT_FOUND' as const };
    let emitted = true;
    if (!result.already) {
      emitted = await this.emitDecided(result.runId, approvalId, decision);
    }
    return { approvalId, runId: result.runId, decision, ok: true, emitted };
  }

  /**
   * Emit approval/decided so the waiting executor resumes. The decision is
   * already durably persisted, so a failed emit must not fail the request — it
   * is logged loudly (never hidden) and `emitted:false` is returned so callers
   * can surface a "decision saved, resume pending" state.
   */
  private async emitDecided(runId: string, approvalId: string, decision: 'approved' | 'rejected'): Promise<boolean> {
    try {
      await inngest.send({ name: 'approval/decided', data: { runId, approvalId, decision } });
      return true;
    } catch (err) {
      this.logger.error(
        `approval/decided emit failed for approval ${approvalId} (run ${runId}); decision is persisted but the run will not auto-resume until the event is re-emitted: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  /** Decide via a signed email link (no session). The HMAC is the authorization. */
  async decideByToken(token: string) {
    const v = verifyApprovalToken(token);
    if (!v.ok) return { ok: false, reason: v.reason };

    const db = this.drizzle.systemDb;
    const [row] = await db
      .select({ runId: approvals.runId, status: approvals.status })
      .from(approvals)
      .where(eq(approvals.id, v.approvalId!))
      .limit(1);
    if (!row) return { ok: false, reason: 'NOT_FOUND' };
    if (row.status !== 'pending') return { ok: true, alreadyDecided: true, decision: row.status };

    await db
      .update(approvals)
      .set({ status: v.decision!, decidedAt: new Date() })
      .where(eq(approvals.id, v.approvalId!));
    await this.emitDecided(row.runId, v.approvalId!, v.decision!);
    return { ok: true, decision: v.decision };
  }
}
