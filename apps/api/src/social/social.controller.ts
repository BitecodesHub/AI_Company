import { Controller, Get, Post, Patch, Param, Body, HttpCode, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { inngest } from '../inngest/client.js';
import type { Request } from 'express';
import { SocialService } from './social.service.js';
import crypto from 'node:crypto';

const CreateBrandVoiceSchema = z.object({ name: z.string().min(1), description: z.string().optional(), samplePosts: z.array(z.string()).min(3).max(20) });
const CreateContentItemSchema = z.object({ type: z.enum(['post','thread','carousel','reel','blog']).default('post'), title: z.string().optional(), body: z.string().optional(), brandVoiceId: z.string().uuid().optional(), scheduledFor: z.coerce.date().optional() });
const GenerateWeekSchema = z.object({ brandVoiceId: z.string().uuid(), platforms: z.array(z.string()).min(1), topic: z.string().optional() });

@ApiTags('social')
@ApiBearerAuth()
@Controller('v1')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  private ctx(req: Request) {
    const tc = (req as any).tenantContext;
    return { organizationId: tc?.organizationId ?? '', workspaceId: tc?.workspaceId ?? '' };
  }

  @Get('social-accounts')
  @ApiOperation({ summary: 'List connected social accounts' })
  listAccounts() { return { items: [], nextCursor: null }; }

  @Post('brand-voices')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a brand voice' })
  async createBrandVoice(@Body(new ZodValidationPipe(CreateBrandVoiceSchema)) body: z.infer<typeof CreateBrandVoiceSchema>, @Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) { const id = `bv-${Date.now()}`; await inngest.send({ name: 'agent/run', data: { runId: `run-bv-${Date.now()}`, brandVoiceId: id, samplePosts: body.samplePosts, task: 'extract_brand_voice' } }); return { id, ...body, status: 'processing' }; }
    const bv = await this.socialService.createBrandVoice(body, ctx);
    await inngest.send({ name: 'agent/run', data: { runId: crypto.randomUUID(), brandVoiceId: bv.id, samplePosts: body.samplePosts, task: 'extract_brand_voice' } });
    return bv;
  }

  @Get('brand-voices')
  @ApiOperation({ summary: 'List brand voices' })
  async listBrandVoices(@Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { items: [], nextCursor: null };
    const items = await this.socialService.listBrandVoices(ctx);
    return { items, nextCursor: null };
  }

  @Post('content-items')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a content item' })
  async createContent(@Body(new ZodValidationPipe(CreateContentItemSchema)) body: z.infer<typeof CreateContentItemSchema>, @Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { id: `ci-${Date.now()}`, ...body, status: 'draft' };
    return this.socialService.createContentItem(body, ctx);
  }

  @Get('content-items')
  @ApiOperation({ summary: 'List content items' })
  async listContent(@Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { items: [], nextCursor: null };
    const items = await this.socialService.listContentItems(ctx);
    return { items, nextCursor: null };
  }

  @Patch('content-items/:id')
  @ApiOperation({ summary: 'Update a content item' })
  async updateContent(@Param('id') id: string, @Body() body: Record<string, unknown>, @Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { id, ...body };
    return this.socialService.updateContentItem(id, body as any, ctx);
  }

  @Post('content/generate-week')
  @HttpCode(202)
  @ApiOperation({ summary: 'Generate a week of content' })
  async generateWeek(@Body(new ZodValidationPipe(GenerateWeekSchema)) body: z.infer<typeof GenerateWeekSchema>) {
    const runId = crypto.randomUUID();
    await inngest.send({ name: 'content/generate', data: { runId, scope: 'week', ...body } });
    return { runId, status: 'queued' };
  }

  @Post('content-items/:id/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Approve content for publishing' })
  async approveContent(@Param('id') id: string) {
    await inngest.send({ name: 'content/publish', data: { contentVariantId: id } });
    return { id, status: 'scheduled' };
  }
}
