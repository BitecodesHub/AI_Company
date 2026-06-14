import { pgTable, text, integer, numeric, jsonb, index, pgEnum, customType } from 'drizzle-orm/pg-core';
import { uuid, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { primaryKey, timestamps, tenantColumns } from './helpers';

export const documentStatusEnum = pgEnum('document_status', [
  'pending',
  'processing',
  'ready',
  'failed',
]);
export const documentSourceTypeEnum = pgEnum('document_source_type', [
  'file',
  'url',
  'crawl',
  'text',
]);

// pgvector column type (vector(1536) — dimension must match the embedding model)
// ARCHITECTURE.md §13: 1536 = text-embedding-3-small. Never mix dimensions.
// Dimension-flexible pgvector column. Declaring `vector` without a fixed
// dimension lets one schema serve every embedding provider (mock=8,
// ollama/nomic=768, openrouter/openai=1536) without a column mismatch. ANN
// (HNSW) indexes require a fixed dimension and are added per-deployment once the
// embedding model is pinned; recall falls back to an exact cosine scan otherwise.
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value) as number[];
  },
});

export const memoryKindEnum = pgEnum('memory_kind', ['fact', 'preference', 'routing_correction', 'summary']);
export const memoryVisibilityEnum = pgEnum('memory_visibility', ['private', 'workspace', 'org']);

// ── knowledge_bases ───────────────────────────────────────────────────────────
export const knowledgeBases = pgTable(
  'knowledge_bases',
  {
    id: primaryKey(),
    ...tenantColumns(),
    name: text('name').notNull(),
    description: text('description'),
    embeddingModel: text('embedding_model').notNull().default('text-embedding-3-small'),
    ...timestamps(),
  },
  (t) => [index('knowledge_bases_workspace_idx').on(t.workspaceId)],
);

// ── documents ─────────────────────────────────────────────────────────────────
export const documents = pgTable(
  'documents',
  {
    id: primaryKey(),
    knowledgeBaseId: uuid('knowledge_base_id').notNull(),
    ...tenantColumns(),
    sourceType: documentSourceTypeEnum('source_type').notNull(),
    sourceRef: text('source_ref'),
    title: text('title'),
    status: documentStatusEnum('status').notNull().default('pending'),
    bytes: integer('bytes'),
    ...timestamps(),
  },
  (t) => [index('documents_kb_idx').on(t.knowledgeBaseId)],
);

// ── document_chunks ───────────────────────────────────────────────────────────
export const documentChunks = pgTable(
  'document_chunks',
  {
    id: primaryKey(),
    documentId: uuid('document_id').notNull(),
    ...tenantColumns(),
    content: text('content').notNull(),
    embedding: vector('embedding'),
    metadata: jsonb('metadata'),
    tokenCount: integer('token_count'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('document_chunks_doc_idx').on(t.documentId),
    // HNSW index is created via raw SQL migration (not expressible in Drizzle schema)
    // See migrations/0001_hnsw_index.sql
  ],
);

// ── agent_memories ────────────────────────────────────────────────────────────
export const agentMemories = pgTable(
  'agent_memories',
  {
    id: primaryKey(),
    ...tenantColumns(),
    agentId: uuid('agent_id').notNull(),
    scope: text('scope').notNull().default('thread'), // 'thread' | 'long_term'
    threadId: text('thread_id'),
    content: text('content').notNull(),
    embedding: vector('embedding'),
    kind: memoryKindEnum('kind').notNull().default('fact'),
    visibility: memoryVisibilityEnum('visibility').notNull().default('private'),
    sourceRunId: uuid('source_run_id'),
    salience: numeric('salience', { precision: 4, scale: 3 }).notNull().default('0.500'),
    metadata: jsonb('metadata'),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('agent_memories_agent_idx').on(t.agentId),
    index('agent_memories_thread_idx').on(t.threadId),
  ],
);
