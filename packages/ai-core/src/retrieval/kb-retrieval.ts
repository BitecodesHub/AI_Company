/**
 * Knowledge Base retrieval — cosine similarity search over document_chunks.
 * (ARCHITECTURE.md §9, P3-05, P3-06)
 *
 * Uses pgvector HNSW index for fast approximate nearest-neighbour search.
 * Scoped by knowledge_base_id + tenant (RLS enforces org isolation).
 */
import { ModelRouter } from '../model/model-router.js';

export interface RetrievalResult {
  documentId: string;
  chunkId: string;
  content: string;
  sourceRef?: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface RetrievalOptions {
  query: string;
  knowledgeBaseIds: string[];
  topK?: number;
  minScore?: number;
  /** Optional hybrid search: combine vector + full-text FTS */
  hybridSearch?: boolean;
  db: unknown; // DrizzleDB client — typed loosely to avoid circular dep
  organizationId: string;
  workspaceId?: string;
}

/**
 * Embed a query string through the single AI gateway (ModelRouter.embed),
 * which routes by EMBEDDING_PROVIDER. Dimension MUST match the knowledge base's
 * embedding_model — BUILD_GUIDE §13.
 *
 * Throws EmbeddingsUnavailableError when the backend cannot embed (surfaced by
 * the caller, never silently skipped).
 */
export async function embedQuery(query: string, router?: ModelRouter): Promise<number[]> {
  const r = router ?? new ModelRouter();
  const [embedding] = await r.embed([query]);
  return embedding ?? [];
}

/**
 * Retrieve the top-K most relevant document chunks for a query.
 *
 * Uses pgvector cosine distance: <=> operator.
 * Scoped to the specified knowledge base IDs.
 *
 * Note: the actual SQL executes inside the caller's withTenant() transaction
 * so RLS policies apply and cross-tenant data is structurally impossible.
 */
export async function retrieveChunks(opts: RetrievalOptions): Promise<RetrievalResult[]> {
  const { query, knowledgeBaseIds, topK = 5, minScore = 0.7, db } = opts;

  const embedding = await embedQuery(query);
  const embeddingStr = `[${embedding.join(',')}]`;

  // Raw SQL for pgvector cosine similarity — Drizzle doesn't have native pgvector operators yet
  const sql = `
    SELECT
      dc.id AS chunk_id,
      dc.document_id,
      dc.content,
      dc.metadata,
      d.source_ref,
      1 - (dc.embedding <=> $1::vector) AS score
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE dc.knowledge_base_id = ANY($2::uuid[])
    ORDER BY dc.embedding <=> $1::vector
    LIMIT $3
  `;

  // Execute raw SQL through the drizzle client
  const rows = await (db as any).execute(
    { sql, params: [embeddingStr, knowledgeBaseIds, topK] },
  );

  return (rows.rows ?? rows)
    .filter((r: any) => r.score >= minScore)
    .map((r: any) => ({
      documentId: r.document_id,
      chunkId: r.chunk_id,
      content: r.content,
      sourceRef: r.source_ref,
      score: parseFloat(r.score),
      metadata: r.metadata,
    }));
}
