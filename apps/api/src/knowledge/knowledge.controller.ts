import { Controller, Get, Post, Param, Body, HttpCode, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import type { Request } from 'express';
import { KnowledgeService } from './knowledge.service.js';

const CreateKbSchema = z.object({ name: z.string().min(1).max(100), description: z.string().optional(), embeddingModel: z.string().default('text-embedding-3-small') });
const AddDocumentSchema = z.object({ sourceType: z.enum(['file','url','text']), sourceRef: z.string().optional(), content: z.string().optional(), title: z.string().optional() });
const AddUrlSchema = z.object({ url: z.string().url(), depth: z.number().int().min(1).max(5).default(2) });

@ApiTags('knowledge')
@ApiBearerAuth()
@Controller('v1/knowledge-bases')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  private ctx(req: Request) {
    const tc = (req as any).tenantContext;
    return { organizationId: tc?.organizationId ?? '', workspaceId: tc?.workspaceId ?? '' };
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a knowledge base' })
  async create(@Body(new ZodValidationPipe(CreateKbSchema)) body: z.infer<typeof CreateKbSchema>, @Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { id: 'todo', ...body, createdAt: new Date() };
    return this.knowledgeService.createKb(body, ctx);
  }

  @Get()
  @ApiOperation({ summary: 'List knowledge bases' })
  async list(@Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { items: [], nextCursor: null };
    const items = await this.knowledgeService.listKbs(ctx);
    return { items, nextCursor: null };
  }

  @Post(':id/documents')
  @HttpCode(201)
  @ApiOperation({ summary: 'Upload a document to a knowledge base' })
  async addDocument(@Param('id') kbId: string, @Body(new ZodValidationPipe(AddDocumentSchema)) body: z.infer<typeof AddDocumentSchema>, @Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { id: `doc-${Date.now()}`, kbId, status: 'pending' };
    // Ingest in-process: chunk + store now (no external Inngest server needed).
    return this.knowledgeService.createDocument(
      kbId,
      { sourceType: body.sourceType, sourceRef: body.sourceRef, title: body.title, content: body.content },
      ctx,
    );
  }

  @Post(':id/urls')
  @HttpCode(201)
  @ApiOperation({ summary: 'Crawl a URL into a knowledge base' })
  async addUrl(@Param('id') kbId: string, @Body(new ZodValidationPipe(AddUrlSchema)) body: z.infer<typeof AddUrlSchema>, @Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { id: `doc-url-${Date.now()}`, kbId, url: body.url, status: 'pending' };
    // Fetch + chunk + store in-process.
    return this.knowledgeService.createDocument(kbId, { sourceType: 'url', sourceRef: body.url, title: body.url }, ctx);
  }

  @Get(':id/documents')
  @ApiOperation({ summary: 'List documents in a knowledge base' })
  async listDocuments(@Param('id') kbId: string, @Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { items: [], nextCursor: null };
    const items = await this.knowledgeService.listDocuments(kbId, ctx);
    return { items, nextCursor: null };
  }

}
