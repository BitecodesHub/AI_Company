import { Injectable } from '@nestjs/common';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { DrizzleService, knowledgeBases, documents, documentChunks } from '../drizzle/drizzle.service.js';
import crypto from 'node:crypto';

type DocSourceType = 'file' | 'url' | 'crawl' | 'text';

/** Split text into ~900-char chunks on paragraph boundaries (capped). */
function chunkText(text: string, size = 900, max = 80): string[] {
  const clean = (text ?? '').replace(/\r/g, '').trim();
  if (!clean) return [];
  const paras = clean.split(/\n\s*\n/);
  const chunks: string[] = [];
  let buf = '';
  for (const p of paras) {
    if (chunks.length >= max) break;
    if (p.length > size) {
      if (buf) { chunks.push(buf.trim()); buf = ''; }
      for (let i = 0; i < p.length && chunks.length < max; i += size) chunks.push(p.slice(i, i + size).trim());
      continue;
    }
    if ((buf + '\n\n' + p).length > size && buf) { chunks.push(buf.trim()); buf = ''; }
    buf = buf ? `${buf}\n\n${p}` : p;
  }
  if (buf && chunks.length < max) chunks.push(buf.trim());
  return chunks.filter(Boolean).slice(0, max);
}

/** Keyword overlap score between a query and a chunk's content. */
function scoreText(query: string, content: string): number {
  const terms = Array.from(new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3)));
  if (!terms.length) return 0;
  const lc = content.toLowerCase();
  let score = 0;
  for (const t of terms) if (lc.includes(t)) score++;
  return score;
}

/** Fetch a URL and strip it to plain text (best-effort, bounded). */
async function fetchUrlText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60000);
  } catch {
    return '';
  }
}

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

  /**
   * Create a document AND ingest it in-process: paste text or fetch a URL, chunk
   * it, and store the chunks (keyword-searchable). No external embedding service
   * is required — retrieval is lexical, upgradeable to vectors later.
   */
  async createDocument(
    kbId: string,
    input: { sourceType: DocSourceType; sourceRef?: string; title?: string; content?: string },
    ctx: { organizationId: string; workspaceId: string },
  ) {
    // Resolve the raw text OUTSIDE the transaction (URL fetch is network I/O).
    let text = '';
    if (input.sourceType === 'text') text = input.content ?? input.sourceRef ?? '';
    else if (input.sourceType === 'url' && input.sourceRef) text = await fetchUrlText(input.sourceRef);
    const chunks = chunkText(text);

    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const docId = crypto.randomUUID();
      const [doc] = await (tx as any).insert(documents).values({
        id: docId,
        knowledgeBaseId: kbId,
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId,
        sourceType: input.sourceType,
        sourceRef: input.sourceRef,
        title: input.title ?? (input.sourceType === 'url' ? input.sourceRef : 'Untitled'),
        status: chunks.length ? 'ready' : 'pending',
        bytes: text.length || null,
      }).returning();

      if (chunks.length) {
        await (tx as any).insert(documentChunks).values(
          chunks.map((content, i) => ({
            id: crypto.randomUUID(),
            documentId: docId,
            organizationId: ctx.organizationId,
            workspaceId: ctx.workspaceId,
            content,
            metadata: { index: i },
            tokenCount: Math.ceil(content.length / 4),
          })),
        );
      }
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

  /** Retrieve the top keyword-matching chunks across the given knowledge bases. */
  async retrieve(
    kbIds: string[],
    query: string,
    ctx: { organizationId: string; workspaceId: string },
    limit = 4,
  ): Promise<Array<{ title: string; content: string }>> {
    if (!kbIds.length) return [];
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const rows = await (tx as any)
        .select({ content: documentChunks.content, title: documents.title })
        .from(documentChunks)
        .innerJoin(documents, eq(documentChunks.documentId, documents.id))
        .where(and(eq(documentChunks.organizationId, ctx.organizationId), inArray(documents.knowledgeBaseId, kbIds)))
        .limit(400);
      return (rows as Array<{ content: string; title: string | null }>)
        .map((r) => ({ title: r.title ?? 'Untitled', content: r.content, score: scoreText(query, r.content) }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((r) => ({ title: r.title, content: r.content }));
    });
  }
}
