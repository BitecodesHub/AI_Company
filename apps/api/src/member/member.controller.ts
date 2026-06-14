import { Controller, Get, Post, Patch, Delete, Param, Body, HttpCode, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RequireRole } from '../common/guards/rbac.guard.js';
import { RoleSchema } from '@bitecodes/shared';
import { MemberService, type TenantCtx } from './member.service.js';

const InviteSchema = z.object({
  email: z.string().email(),
  role: RoleSchema.default('member'),
  workspaceId: z.string().uuid().optional(),
});
type Invite = z.infer<typeof InviteSchema>;

const UpdateRoleSchema = z.object({ role: RoleSchema });
type UpdateRole = z.infer<typeof UpdateRoleSchema>;

@ApiTags('members')
@ApiBearerAuth()
@Controller('v1')
export class MemberController {
  constructor(private readonly members: MemberService) {}

  private ctx(req: Request): TenantCtx {
    const tc = (req as any).tenantContext;
    const user = (req as any).user;
    return {
      organizationId: tc?.organizationId ?? '',
      workspaceId: tc?.workspaceId,
      userId: user?.id ?? '',
    };
  }

  @Get('members')
  @ApiOperation({ summary: 'List members of the organization' })
  async list(@Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { items: [], nextCursor: null };
    return this.members.list(ctx);
  }

  @Get('invitations')
  @RequireRole('admin', 'owner')
  @ApiOperation({ summary: 'List pending invitations' })
  async listInvitations(@Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { items: [], nextCursor: null };
    return this.members.listInvitations(ctx);
  }

  @Post('invitations')
  @HttpCode(201)
  @RequireRole('admin', 'owner')
  @ApiOperation({ summary: 'Invite a user to the organization' })
  async invite(@Body(new ZodValidationPipe(InviteSchema)) body: Invite, @Req() req: Request) {
    return this.members.invite(this.ctx(req), body);
  }

  @Post('invitations/:token/accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept an invitation' })
  async acceptInvite(@Param('token') token: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.members.accept(token, user?.id ?? '');
  }

  @Patch('members/:id/role')
  @RequireRole('admin', 'owner')
  @ApiOperation({ summary: 'Change a member role' })
  async updateRole(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateRoleSchema)) body: UpdateRole,
    @Req() req: Request,
  ) {
    const row = await this.members.updateRole(this.ctx(req), id, body.role);
    return row ?? { id, role: body.role };
  }

  @Delete('members/:id')
  @HttpCode(204)
  @RequireRole('admin', 'owner')
  @ApiOperation({ summary: 'Remove (deactivate) a member' })
  async remove(@Param('id') id: string, @Req() req: Request) {
    await this.members.deactivate(this.ctx(req), id);
  }
}
