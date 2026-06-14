import { Controller, Get, Post, Patch, Param, Body, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { RequireRole } from '../common/guards/rbac.guard.js';
import { roleAtLeast } from '../common/guards/rbac.guard.js';
import { ControlsService, type ControlsCtx } from './controls.service.js';

const ControlsPatchSchema = z.object({
  activationState: z.enum(['active', 'paused', 'deactivated']).optional(),
  approvalMode: z.enum(['always', 'risky', 'never']).optional(),
  bypassPermission: z.boolean().optional(),
  planMode: z.boolean().optional(),
  maxRunsPerDay: z.number().int().positive().nullable().optional(),
  dailyCostCapUsd: z.number().positive().nullable().optional(),
});
type ControlsPatchBody = z.infer<typeof ControlsPatchSchema>;

@ApiTags('employee-controls')
@ApiBearerAuth()
@Controller('v1/agents')
export class ControlsController {
  constructor(private readonly controls: ControlsService) {}

  private ctx(req: Request): ControlsCtx {
    const tc = (req as any).tenantContext;
    return { organizationId: tc?.organizationId ?? '', workspaceId: tc?.workspaceId, userId: (req as any).user?.id ?? '' };
  }

  @Get(':id/controls')
  @ApiOperation({ summary: 'Get an employee’s controls' })
  async get(@Param('id') id: string, @Req() req: Request) {
    return this.controls.get(this.ctx(req), id);
  }

  @Patch(':id/controls')
  @RequireRole('member')
  @ApiOperation({ summary: 'Update an employee’s controls' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ControlsPatchSchema)) body: ControlsPatchBody,
    @Req() req: Request,
  ) {
    // Elevated settings are owner-only — the general route floor is `member`, but
    // disabling the safety net (bypass_permission / approval_mode='never') must
    // be an owner decision. Enforced here because it depends on the body.
    const elevated = body.bypassPermission === true || body.approvalMode === 'never';
    if (elevated && !roleAtLeast((req as any).memberRole, 'owner')) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only an owner may bypass permissions or disable the approval gate.',
      });
    }
    return this.controls.upsert(this.ctx(req), id, body);
  }

  @Post(':id/controls/activate')
  @RequireRole('member')
  @ApiOperation({ summary: 'Activate an employee' })
  async activate(@Param('id') id: string, @Req() req: Request) {
    return this.controls.setActivation(this.ctx(req), id, 'active');
  }

  @Post(':id/controls/deactivate')
  @RequireRole('member')
  @ApiOperation({ summary: 'Deactivate an employee' })
  async deactivate(@Param('id') id: string, @Req() req: Request) {
    return this.controls.setActivation(this.ctx(req), id, 'deactivated');
  }
}
