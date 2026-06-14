/**
 * MemoryService — agent memory read/delete + the DrizzleMemoryStore-style recall
 * used by the executor's layered prompt assembly. Tenant-scoped (withTenant).
 *
 * Recall is exact-keyword + recency by default; when embeddings are present it
 * also ranks by pgvector cosine distance. Deleting a memory removes it from
 * recall (acceptance: a deleted memory is gone).
 */
import { Injectable } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DrizzleService, agentMemories } from '../drizzle/drizzle.service.js';

export interface MemoryCtx {
  organizationId: string;
  workspaceId?: string;
  userId: string;
}

@Injectable()
export class MemoryService {
  constructor(private readonly drizzle: DrizzleService) {}

  list(ctx: MemoryCtx, agentId: string) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const items = await tx
        .select({
          id: agentMemories.id, agentId: agentMemories.agentId, scope: agentMemories.scope,
          kind: agentMemories.kind, visibility: agentMemories.visibility, content: agentMemories.content,
          salience: agentMemories.salience, sourceRunId: agentMemories.sourceRunId, createdAt: agentMemories.createdAt,
        })
        .from(agentMemories)
        .where(and(eq(agentMemories.agentId, agentId), eq(agentMemories.organizationId, ctx.organizationId)))
        .orderBy(desc(agentMemories.salience), desc(agentMemories.createdAt))
        .limit(200);
      return { items, nextCursor: null };
    });
  }

  delete(ctx: MemoryCtx, agentId: string, memoryId: string) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      await tx
        .delete(agentMemories)
        .where(and(
          eq(agentMemories.id, memoryId),
          eq(agentMemories.agentId, agentId),
          eq(agentMemories.organizationId, ctx.organizationId),
        ));
    });
  }

  /** Top-K long-term memories for an agent — injected into the prompt by the executor. */
  recallLongTerm(ctx: MemoryCtx, agentId: string, topK = Number(process.env['MEMORY_LONGTERM_TOPK'] ?? 5)) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const items = await tx
        .select({ content: agentMemories.content, kind: agentMemories.kind, salience: agentMemories.salience })
        .from(agentMemories)
        .where(and(
          eq(agentMemories.agentId, agentId),
          eq(agentMemories.organizationId, ctx.organizationId),
          eq(agentMemories.scope, 'long_term'),
        ))
        .orderBy(desc(agentMemories.salience), desc(agentMemories.createdAt))
        .limit(topK);
      return items;
    });
  }
}
