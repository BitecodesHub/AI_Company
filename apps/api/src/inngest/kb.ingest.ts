/**
 * kb/ingest — durable Inngest function for document ingestion pipeline.
 *
 * Pipeline (ARCHITECTURE.md §9):
 * 1. Fetch document content from blob store or URL.
 * 2. Parse: Node for common types; Python worker for complex PDFs (optional).
 * 3. Token-aware chunk with overlap.
 * 4. Embed via LiteLLM gateway (text-embedding-3-small, 1536 dims).
 * 5. Insert document_chunks rows with HNSW-indexed embedding.
 * 6. Mark document status → ready (or failed).
 *
 * BUILD_GUIDE §13: dimension MUST match knowledge_bases.embedding_model.
 * Never mix dimensions in one knowledge base.
 */
import { NonRetriableError } from 'inngest';
import { inngest } from './client.js';
import { ModelRouter, EmbeddingsUnavailableError } from '@bitecodes/ai-core';

const CHUNK_SIZE_TOKENS = 512;
const CHUNK_OVERLAP_TOKENS = 64;

const modelRouter = new ModelRouter();

export const kbIngestFunction = inngest.createFunction(
  { id: 'kb/ingest', name: 'Ingest document into knowledge base', retries: 3 },
  { event: 'kb/ingest' },
  async ({ event, step, logger }) => {
    const { documentId } = event.data as { documentId: string };

    // Step 1: Fetch document metadata
    const doc = await step.run('fetch-document', async () => {
      // TODO Phase 3: query documents table + fetch content from S3
      return { id: documentId, content: '[stub content for ' + documentId + ']', title: 'Stub Doc' };
    });

    // Step 2: Parse content into plain text
    const plainText = await step.run('parse-content', async () => {
      // TODO: Node parsers for PDF/DOCX/MD; call worker /ingest for complex PDFs
      return doc.content;
    });

    // Step 3: Chunk text (token-aware with overlap)
    const chunks = await step.run('chunk-text', async () => {
      return chunkText(plainText, CHUNK_SIZE_TOKENS, CHUNK_OVERLAP_TOKENS);
    });

    logger.info({ documentId, chunkCount: chunks.length }, 'Document chunked');

    // Step 4: Embed each chunk through the single AI gateway (ModelRouter.embed,
    // routed by EMBEDDING_PROVIDER). Batched; each batch is its own step for retry.
    const BATCH_SIZE = 20;
    const embeddedChunks: { content: string; embedding: number[] }[] = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchEmbeddings = await step.run(`embed-batch-${i}`, async () => {
        try {
          const vectors = await modelRouter.embed(batch);
          return vectors.map((embedding, idx) => ({
            content: batch[idx] ?? '',
            embedding,
          }));
        } catch (err) {
          if (err instanceof EmbeddingsUnavailableError) {
            // No silent skip: mark the document failed with a clear reason.
            logger.error(
              { documentId, provider: err.provider, reason: err.code },
              'Embeddings unavailable — marking document failed',
            );
            await markDocumentFailed(documentId, 'EMBEDDINGS_UNAVAILABLE', err.message);
            // Do not retry: the config will not change between retries.
            throw new NonRetriableError(`EMBEDDINGS_UNAVAILABLE: ${err.message}`);
          }
          throw err;
        }
      });
      embeddedChunks.push(...batchEmbeddings);
    }

    // Step 5: Persist chunks to database
    await step.run('persist-chunks', async () => {
      // TODO Phase 3: INSERT INTO document_chunks using withTenant()
      logger.info({ documentId, chunks: embeddedChunks.length }, 'Chunks embedded and persisted');
    });

    // Step 6: Mark document ready
    await step.run('mark-ready', async () => {
      // TODO: UPDATE documents SET status='ready' WHERE id=$1
    });

    return { documentId, chunkCount: embeddedChunks.length };
  },
);

/**
 * Mark a document as failed with a machine-readable reason.
 *
 * The documents persistence layer (fetch/persist) is wired in Phase B; until
 * then this records the failure honestly via the module logger and the caller
 * propagates a NonRetriableError so the run terminates as failed (never a
 * silent skip). Once the documents repository lands, this performs the real
 * `UPDATE documents SET status='failed', failure_reason=$reason` inside
 * withTenant().
 */
async function markDocumentFailed(documentId: string, reason: string, detail: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.error(`[kb/ingest] document ${documentId} failed: ${reason} — ${detail}`);
}

/**
 * Naive token-aware chunker.
 * Estimates tokens as chars/4. Splits on sentence boundaries when possible.
 * Real implementation uses tiktoken or the worker's unstructured pipeline.
 */
function chunkText(text: string, chunkTokens: number, overlapTokens: number): string[] {
  const chunkChars = chunkTokens * 4;
  const overlapChars = overlapTokens * 4;
  const chunks: string[] = [];

  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkChars, text.length);
    // Try to break at a sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      if (lastPeriod > start + overlapChars) end = lastPeriod + 1;
    }
    chunks.push(text.slice(start, end).trim());
    start = end - overlapChars;
    if (start < 0) start = 0;
  }
  return chunks.filter(Boolean);
}
