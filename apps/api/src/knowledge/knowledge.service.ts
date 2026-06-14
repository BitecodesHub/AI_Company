import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DrizzleService, knowledgeBases, documents } from '../drizzle/drizzle.service.js';
import crypto from 'node:crypto';

@Injectable()
export class KnowledgeService {
  constructor(private readonly drizzle: DrizzleService) {}

  async createKb(input: { name: string; description?: string; embeddingModel?: string }, ctx: { organizationId: string; workspaceId: string }) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [kb] = await (tx as any).insert(knowledgeBases).values({
        id: crypto.randomUUID(),
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        name: input.name,
        description: input.description,
        embeddingModel: input.embeddingModel ?? 'text-embedding-3-small',
      }).returning();
      return kb;
    });
  }

  async listKbs(ctx: { organizationId: string; workspaceId: string }) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      return (tx as any).select().from(knowledgeBases)
        .where(and(eq(knowledgeBases.organizationId, ctx.organizationId), eq(knowledgeBases.workspaceId, ctx.workspaceId)))
        .orderBy(desc(knowledgeBases.createdAt));
    });
  }

  async createDocument(kbId: string, input: { sourceType: 'file' | 'url' | 'crawl' | 'text'; sourceRef?: string; title?: string }, ctx: { organizationId: string; workspaceId: string }) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [doc] = await (tx as any).insert(documents).values({
        id: crypto.randomUUID(),
        knowledgeBaseId: kbId,
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        sourceType: input.sourceType,
        sourceRef: input.sourceRef,
        title: input.title,
        status: 'pending',
      }).returning();
      return doc;
    });
  }

  async listDocuments(kbId: string, ctx: { organizationId: string; workspaceId: string }) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      return (tx as any).select().from(documents)
        .where(and(eq(documents.knowledgeBaseId, kbId), eq(documents.organizationId, ctx.organizationId)))
        .orderBy(desc(documents.createdAt));
    });
  }
}
