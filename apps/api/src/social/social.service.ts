import { Injectable } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DrizzleService, brandVoices, contentItems } from '../drizzle/drizzle.service.js';
import crypto from 'node:crypto';

@Injectable()
export class SocialService {
  constructor(private readonly drizzle: DrizzleService) {}

  async createBrandVoice(input: { name: string; description?: string; samplePosts?: string[] }, ctx: { organizationId: string; workspaceId: string }) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [bv] = await (tx as any).insert(brandVoices).values({
        id: crypto.randomUUID(),
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        name: input.name,
        description: input.description,
        samplePosts: input.samplePosts ?? [],
      }).returning();
      return bv;
    });
  }

  async listBrandVoices(ctx: { organizationId: string; workspaceId: string }) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      return (tx as any).select().from(brandVoices)
        .where(and(eq(brandVoices.organizationId, ctx.organizationId), eq(brandVoices.workspaceId, ctx.workspaceId)))
        .orderBy(desc(brandVoices.createdAt));
    });
  }

  async createContentItem(input: { type?: string; title?: string; body?: string; brandVoiceId?: string; scheduledFor?: Date }, ctx: { organizationId: string; workspaceId: string }) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [item] = await (tx as any).insert(contentItems).values({
        id: crypto.randomUUID(),
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        type: (input.type as any) ?? 'post',
        title: input.title,
        body: input.body,
        status: 'idea',
        brandVoiceId: input.brandVoiceId,
        scheduledFor: input.scheduledFor,
      }).returning();
      return item;
    });
  }

  async listContentItems(ctx: { organizationId: string; workspaceId: string }) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      return (tx as any).select().from(contentItems)
        .where(and(eq(contentItems.organizationId, ctx.organizationId), eq(contentItems.workspaceId, ctx.workspaceId)))
        .orderBy(desc(contentItems.createdAt));
    });
  }

  async updateContentItem(id: string, data: Partial<{ title: string; body: string; status: string; scheduledFor: Date }>, ctx: { organizationId: string; workspaceId: string }) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [updated] = await (tx as any).update(contentItems)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(contentItems.id, id), eq(contentItems.organizationId, ctx.organizationId)))
        .returning();
      return updated;
    });
  }
}
