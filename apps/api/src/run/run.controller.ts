import { Controller, Get, Post, Param, Body, HttpCode, Req, Query, SetMetadata } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import { eq, and } from 'drizzle-orm';
import { inngest } from '../inngest/client.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { DrizzleService, agentRuns, runSteps } from '../drizzle/drizzle.service.js';
import { asc } from 'drizzle-orm';
import { ApprovalService, type ApprovalCtx } from './approval.service.js';

const Public = () => SetMetadata('isPublic', true);

const DecideSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().max(2000).optional(),
});
type DecideBody = z.infer<typeof DecideSchema>;

@ApiTags('runs')
@ApiBearerAuth()
@Controller('v1')
export class RunController {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly approvals: ApprovalService,
  ) {}

  private ctx(req: Request): ApprovalCtx {
    const tc = (req as any).tenantContext;
    return { organizationId: tc?.organizationId ?? '', workspaceId: tc?.workspaceId, userId: (req as any).user?.id ?? '' };
  }

  @Get('runs')
  @ApiOperation({ summary: 'List runs' })
  async list(@Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { items: [], nextCursor: null };
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const items = await tx
        .select()
        .from(agentRuns)
        .where(eq(agentRuns.organizationId, ctx.organizationId))
        .limit(50);
      return { items, nextCursor: null };
    });
  }

  @Get('runs/:id')
  @ApiOperation({ summary: 'Get a run with its full step trace' })
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { id, steps: [] };
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [row] = await tx
        .select()
        .from(agentRuns)
        .where(and(eq(agentRuns.id, id), eq(agentRuns.organizationId, ctx.organizationId)))
        .limit(1);
      if (!row) return { id, steps: [] };
      const steps = await tx
        .select()
        .from(runSteps)
        .where(eq(runSteps.runId, id))
        .orderBy(asc(runSteps.index));
      return { ...row, steps };
    });
  }

  private async setStatus(ctx: ApprovalCtx, id: string, status: 'paused' | 'running' | 'cancelled') {
    if (!ctx.organizationId) return { runId: id, status };
    await this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      await tx
        .update(agentRuns)
        .set(status === 'cancelled' ? { status, finishedAt: new Date() } : { status })
        .where(and(eq(agentRuns.id, id), eq(agentRuns.organizationId, ctx.organizationId)));
    });
    return { runId: id, status };
  }

  @Post('runs/:id/pause')
  @HttpCode(202)
  @ApiOperation({ summary: 'Pause a run' })
  async pause(@Param('id') id: string, @Req() req: Request) {
    return this.setStatus(this.ctx(req), id, 'paused');
  }

  @Post('runs/:id/resume')
  @HttpCode(202)
  @ApiOperation({ summary: 'Resume a paused run' })
  async resume(@Param('id') id: string, @Req() req: Request) {
    const res = await this.setStatus(this.ctx(req), id, 'running');
    await inngest.send({ name: 'run/resumed', data: { runId: id } });
    return res;
  }

  @Post('runs/:id/cancel')
  @HttpCode(202)
  @ApiOperation({ summary: 'Cancel a run' })
  async cancel(@Param('id') id: string, @Req() req: Request) {
    const res = await this.setStatus(this.ctx(req), id, 'cancelled');
    await inngest.send({ name: 'run/cancelled', data: { runId: id } });
    return res;
  }

  @Post('runs/:id/replay')
  @HttpCode(202)
  @ApiOperation({ summary: 'Replay a run from the beginning' })
  async replay(@Param('id') id: string) {
    // Replay re-enqueues the SAME run id; the executor resolves it fresh.
    await inngest.send({ name: 'agent/run', data: { runId: id, replayOf: id } });
    return { runId: id, replayOf: id, status: 'queued' };
  }

  @Get('approvals')
  @ApiOperation({ summary: 'List pending approvals' })
  async listApprovals(@Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { items: [], nextCursor: null };
    return this.approvals.listPending(ctx);
  }

  @Post('approvals/:id/decide')
  @HttpCode(200)
  @ApiOperation({ summary: 'Approve or reject a tool call' })
  async decide(
    @Param('id') approvalId: string,
    @Body(new ZodValidationPipe(DecideSchema)) body: DecideBody,
    @Req() req: Request,
  ) {
    const ctx = this.ctx(req);
    return this.approvals.decide(ctx, approvalId, body.decision, ctx.userId);
  }

  @Get('approvals/:id/email-decision')
  @Public()
  @ApiOperation({ summary: 'Decide an approval via a signed email link (public, HMAC)' })
  async emailDecision(@Param('id') _id: string, @Query('token') token: string) {
    const res = await this.approvals.decideByToken(token ?? '');
    if (!res.ok) {
      return { ok: false, message: `This approval link is invalid or expired (${res.reason ?? 'INVALID'}).` };
    }
    if ((res as { alreadyDecided?: boolean }).alreadyDecided) {
      return { ok: true, message: `This request was already ${res.decision}.` };
    }
    return { ok: true, message: `Request ${res.decision}. You can close this window.` };
  }
}
