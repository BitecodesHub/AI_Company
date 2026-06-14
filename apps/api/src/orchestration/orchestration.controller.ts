import { Controller, Get, Post, Delete, Param, Body, HttpCode, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { RequireRole } from '../common/guards/rbac.guard.js';
import { OrchestrationService, type OrchestrationCtx } from './orchestration.service.js';

const RelationshipSchema = z.object({
  fromAgentId: z.string().uuid(),
  toAgentId: z.string().uuid(),
  kind: z.enum(['supervises', 'watches', 'delegates_to']),
});
type RelationshipBody = z.infer<typeof RelationshipSchema>;

const RouteSchema = z.object({ request: z.string().min(1).max(8000) });
type RouteBody = z.infer<typeof RouteSchema>;

const ConfirmSchema = z.object({ divertToAgentId: z.string().uuid().optional() });
type ConfirmBody = z.infer<typeof ConfirmSchema>;

@ApiTags('orchestration')
@ApiBearerAuth()
@Controller('v1')
export class OrchestrationController {
  constructor(private readonly orchestration: OrchestrationService) {}

  private ctx(req: Request): OrchestrationCtx {
    const tc = (req as any).tenantContext;
    return {
      organizationId: tc?.organizationId ?? '',
      workspaceId: tc?.workspaceId,
      userId: (req as any).user?.id ?? '',
      role: tc?.role,
    };
  }

  // ── Relationships ──────────────────────────────────────────────────────────
  @Get('agent-relationships')
  @ApiOperation({ summary: 'List employee relationships (org chart edges)' })
  async listRelationships(@Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { items: [], nextCursor: null };
    return this.orchestration.listRelationships(ctx);
  }

  @Post('agent-relationships')
  @HttpCode(201)
  @RequireRole('member')
  @ApiOperation({ summary: 'Create an employee relationship' })
  async createRelationship(@Body(new ZodValidationPipe(RelationshipSchema)) body: RelationshipBody, @Req() req: Request) {
    return this.orchestration.createRelationship(this.ctx(req), body);
  }

  @Delete('agent-relationships/:id')
  @HttpCode(204)
  @RequireRole('member')
  @ApiOperation({ summary: 'Remove an employee relationship' })
  async removeRelationship(@Param('id') id: string, @Req() req: Request) {
    await this.orchestration.removeRelationship(this.ctx(req), id);
  }

  // ── Routing ──────────────────────────────────────────────────────────────────
  @Post('orchestration/route')
  @HttpCode(201)
  @ApiOperation({ summary: 'Route a request to the best-fit employee (propose or auto-dispatch)' })
  async route(@Body(new ZodValidationPipe(RouteSchema)) body: RouteBody, @Req() req: Request) {
    return this.orchestration.route(this.ctx(req), body.request);
  }

  @Get('orchestration/decisions')
  @ApiOperation({ summary: 'List routing decisions' })
  async listDecisions(@Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { items: [], nextCursor: null };
    return this.orchestration.listDecisions(ctx);
  }

  @Post('orchestration/decisions/:id/confirm')
  @HttpCode(200)
  @RequireRole('member')
  @ApiOperation({ summary: 'Confirm or divert a proposed routing decision (dispatches the run)' })
  async confirm(@Param('id') id: string, @Body(new ZodValidationPipe(ConfirmSchema)) body: ConfirmBody, @Req() req: Request) {
    return this.orchestration.confirm(this.ctx(req), id, body.divertToAgentId);
  }
}
