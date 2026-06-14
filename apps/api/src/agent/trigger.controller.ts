import { Controller, Get, Post, Patch, Delete, Param, Body, HttpCode, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { RequireRole } from '../common/guards/rbac.guard.js';
import { TriggerService, type TriggerCtx } from './trigger.service.js';

const TriggerSchema = z.object({
  type: z.enum(['manual', 'schedule', 'webhook', 'event']),
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
});
type TriggerBody = z.infer<typeof TriggerSchema>;

const TriggerPatchSchema = TriggerSchema.partial();
type TriggerPatchBody = z.infer<typeof TriggerPatchSchema>;

@ApiTags('agent-triggers')
@ApiBearerAuth()
@Controller('v1/agents')
export class TriggerController {
  constructor(private readonly triggers: TriggerService) {}

  private ctx(req: Request): TriggerCtx {
    const tc = (req as any).tenantContext;
    return { organizationId: tc?.organizationId ?? '', workspaceId: tc?.workspaceId, userId: (req as any).user?.id ?? '' };
  }

  @Get(':id/triggers')
  @ApiOperation({ summary: 'List an employee’s triggers' })
  async list(@Param('id') id: string, @Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { items: [], nextCursor: null };
    return this.triggers.list(ctx, id);
  }

  @Post(':id/triggers')
  @HttpCode(201)
  @RequireRole('member')
  @ApiOperation({ summary: 'Create a trigger (e.g. a schedule)' })
  async create(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(TriggerSchema)) body: TriggerBody,
    @Req() req: Request,
  ) {
    return this.triggers.create(this.ctx(req), id, body);
  }

  @Patch(':id/triggers/:triggerId')
  @RequireRole('member')
  @ApiOperation({ summary: 'Update a trigger' })
  async update(
    @Param('id') id: string,
    @Param('triggerId') triggerId: string,
    @Body(new ZodValidationPipe(TriggerPatchSchema)) body: TriggerPatchBody,
    @Req() req: Request,
  ) {
    const row = await this.triggers.update(this.ctx(req), id, triggerId, body);
    return row ?? { id: triggerId };
  }

  @Delete(':id/triggers/:triggerId')
  @HttpCode(204)
  @RequireRole('member')
  @ApiOperation({ summary: 'Delete a trigger' })
  async remove(@Param('id') id: string, @Param('triggerId') triggerId: string, @Req() req: Request) {
    await this.triggers.remove(this.ctx(req), id, triggerId);
  }
}
