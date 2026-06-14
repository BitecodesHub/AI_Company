/**
 * memory/consolidate — periodic memory curation (daily cron).
 *
 * Curation gate before long-term clutter accumulates:
 *  - dedup routing_correction memories: for each (agent_id, content) keep the
 *    highest-salience / newest, delete the rest.
 *  - expire stale thread-scoped memories older than MEMORY_RETENTION_DAYS.
 *
 * Runs as a system maintenance job over all tenants (systemDb). Exported core
 * for testing.
 */
import { inngest } from './client.js';
import { sql } from 'drizzle-orm';
import { systemDb } from './runtime-db.js';

export async function runMemoryConsolidate(nowMs: number): Promise<{ deduped: number; expired: number }> {
  const db = systemDb();
  const retentionDays = Number(process.env['MEMORY_RETENTION_DAYS'] ?? 90);
  const cutoff = new Date(nowMs - retentionDays * 24 * 60 * 60 * 1000);

  // Dedup routing_corrections: keep the best row per (agent_id, content).
  const dedup = await db.execute(sql`
    DELETE FROM agent_memories m
    USING (
      SELECT id, row_number() OVER (
        PARTITION BY agent_id, content
        ORDER BY salience DESC, created_at DESC
      ) AS rn
      FROM agent_memories
      WHERE kind = 'routing_correction'
    ) dup
    WHERE m.id = dup.id AND dup.rn > 1
  `);

  // Expire stale thread memories (long_term is retained).
  const expired = await db.execute(sql`
    DELETE FROM agent_memories
    WHERE scope = 'thread' AND created_at < ${cutoff}
  `);

  const dedupCount = (dedup as { rowCount?: number }).rowCount ?? 0;
  const expiredCount = (expired as { rowCount?: number }).rowCount ?? 0;
  return { deduped: dedupCount, expired: expiredCount };
}

export const memoryConsolidateFunction = inngest.createFunction(
  { id: 'memory/consolidate', name: 'Consolidate agent memory' },
  { cron: '0 4 * * *' }, // daily at 04:00
  async () => {
    const result = await runMemoryConsolidate(Date.now());
    return result;
  },
);
