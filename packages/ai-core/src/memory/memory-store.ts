/**
 * MemoryStore — thread + long-term memory with TTL and summarization hooks.
 * Backed by agent_memories in PostgreSQL (pgvector for semantic search).
 *
 * Phase 2 stub: interface defined, DB integration wired in Phase 3 (P3-07).
 */

export interface MemoryEntry {
  id?: string;
  agentId: string;
  organizationId: string;
  workspaceId?: string;
  scope: 'thread' | 'long_term';
  threadId?: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}

export interface MemorySearchOptions {
  agentId: string;
  organizationId: string;
  scope?: 'thread' | 'long_term';
  threadId?: string;
  topK?: number;
  query?: string;          // semantic search query (produces embedding)
}

export abstract class MemoryStore {
  abstract save(entry: MemoryEntry): Promise<string>;
  abstract search(opts: MemorySearchOptions): Promise<MemoryEntry[]>;
  abstract delete(id: string, organizationId: string): Promise<void>;
  abstract summarize(entries: MemoryEntry[]): Promise<string>;
}

/**
 * NoOpMemoryStore — safe default when DB isn't connected (Phase 0/1).
 * Replaced by DrizzleMemoryStore in Phase 3.
 */
export class NoOpMemoryStore extends MemoryStore {
  async save(_entry: MemoryEntry): Promise<string> { return 'noop'; }
  async search(_opts: MemorySearchOptions): Promise<MemoryEntry[]> { return []; }
  async delete(_id: string, _orgId: string): Promise<void> {}
  async summarize(entries: MemoryEntry[]): Promise<string> {
    return entries.map(e => e.content).join('\n');
  }
}
