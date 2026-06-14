import { Controller, Get, Post, Param, Body, HttpCode, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { RequireRole } from '../common/guards/rbac.guard.js';
import { CompanyService, type CompanyCtx } from './company.service.js';

const CreateConversationSchema = z.object({ subject: z.string().max(200).optional() });
const PostMessageSchema = z.object({ body: z.string().min(1).max(8000) });

@ApiTags('company')
@ApiBearerAuth()
@Controller('v1')
export class CompanyController {
  constructor(private readonly company: CompanyService) {}

  private ctx(req: Request): CompanyCtx {
    const tc = (req as any).tenantContext;
    return { organizationId: tc?.organizationId ?? '', workspaceId: tc?.workspaceId, userId: (req as any).user?.id ?? '' };
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List company conversations' })
  async list(@Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { items: [], nextCursor: null };
    return this.company.listConversations(ctx);
  }

  @Post('conversations')
  @HttpCode(201)
  @ApiOperation({ summary: 'Start a conversation' })
  async create(@Body(new ZodValidationPipe(CreateConversationSchema)) body: { subject?: string }, @Req() req: Request) {
    return this.company.createConversation(this.ctx(req), body.subject);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a conversation' })
  async get(@Param('id') id: string, @Req() req: Request) {
    return (await this.company.getConversation(this.ctx(req), id)) ?? { id };
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Unified timeline (turns + bus events) for a conversation' })
  async messages(@Param('id') id: string, @Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { items: [] };
    return this.company.messages(ctx, id);
  }

  @Post('conversations/:id/messages')
  @HttpCode(201)
  @RequireRole('member')
  @ApiOperation({ summary: 'Post a human message to a conversation' })
  async post(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PostMessageSchema)) body: { body: string },
    @Req() req: Request,
  ) {
    return this.company.postMessage(this.ctx(req), id, body.body);
  }

  @Get('agent-handoffs')
  @ApiOperation({ summary: 'Inter-agent bus — handoffs across the workspace' })
  async handoffs(@Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { items: [], nextCursor: null };
    return this.company.listAgentMessages(ctx, 'handoff');
  }
}
