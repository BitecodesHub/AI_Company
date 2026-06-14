/**
 * CompanyService — the unified company timeline: conversations, human/agent
 * messages, and the inter-agent bus (agent_messages, incl. handoffs).
 *
 * Posting a human message emits company/message.posted and streams over the
 * /company socket. The unified timeline merges conversation_messages (turns) and
 * agent_messages (bus events) chronologically.
 */
import { Injectable } from '@nestjs/common';
import { eq, and, desc, asc } from 'drizzle-orm';
import {
  DrizzleService,
  conversations,
  conversationMessages,
  agentMessages,
} from '../drizzle/drizzle.service.js';
import { companyEmitter } from '../gateway/company-emitter.js';
import { inngest } from '../inngest/client.js';

export interface CompanyCtx {
  organizationId: string;
  workspaceId?: string;
  userId: string;
}

@Injectable()
export class CompanyService {
  constructor(private readonly drizzle: DrizzleService) {}

  listConversations(ctx: CompanyCtx) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const items = await tx
        .select()
        .from(conversations)
        .where(eq(conversations.organizationId, ctx.organizationId))
        .orderBy(desc(conversations.updatedAt))
        .limit(100);
      return { items, nextCursor: null };
    });
  }

  createConversation(ctx: CompanyCtx, subject?: string) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [row] = await tx
        .insert(conversations)
        .values({ organizationId: ctx.organizationId, workspaceId: ctx.workspaceId ?? null, subject: subject ?? null, createdBy: ctx.userId })
        .returning();
      return row!;
    });
  }

  getConversation(ctx: CompanyCtx, id: string) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [row] = await tx
        .select()
        .from(conversations)
        .where(and(eq(conversations.id, id), eq(conversations.organizationId, ctx.organizationId)))
        .limit(1);
      return row ?? null;
    });
  }

  /** Unified timeline: conversation turns + bus events for one conversation. */
  async messages(ctx: CompanyCtx, conversationId: string) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const turns = await tx
        .select()
        .from(conversationMessages)
        .where(eq(conversationMessages.conversationId, conversationId))
        .orderBy(asc(conversationMessages.createdAt));
      const bus = await tx
        .select()
        .from(agentMessages)
        .where(eq(agentMessages.conversationId, conversationId))
        .orderBy(asc(agentMessages.createdAt));

      const timeline = [
        ...turns.map((t) => ({ kind: 'turn' as const, at: t.createdAt, data: t })),
        ...bus.map((b) => ({ kind: 'bus' as const, at: b.createdAt, data: b })),
      ].sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));

      return { items: timeline };
    });
  }

  async postMessage(ctx: CompanyCtx, conversationId: string, body: string) {
    const row = await this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [msg] = await tx
        .insert(conversationMessages)
        .values({
          conversationId,
          organizationId: ctx.organizationId,
          workspaceId: ctx.workspaceId ?? null,
          authorType: 'user',
          authorId: ctx.userId,
          body,
        })
        .returning();
      await tx.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));
      return msg!;
    });

    if (ctx.workspaceId) companyEmitter()?.emitMessage(ctx.workspaceId, { conversationId, message: row });
    // Best-effort lifecycle event (no fatal failure if Inngest is unreachable).
    try {
      await inngest.send({
        name: 'company/message.posted',
        data: { conversationId, messageId: row.id, organizationId: ctx.organizationId, workspaceId: ctx.workspaceId },
      });
    } catch { /* logged upstream; timeline already persisted */ }

    return row;
  }

  /** The inter-agent bus feed (handoffs + observations) across the workspace. */
  listAgentMessages(ctx: CompanyCtx, kind?: 'message' | 'handoff' | 'observation' | 'log') {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const where = kind
        ? and(eq(agentMessages.organizationId, ctx.organizationId), eq(agentMessages.kind, kind))
        : eq(agentMessages.organizationId, ctx.organizationId);
      const items = await tx.select().from(agentMessages).where(where).orderBy(desc(agentMessages.createdAt)).limit(200);
      return { items, nextCursor: null };
    });
  }
}
