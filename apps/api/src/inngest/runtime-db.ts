/**
 * Database access for durable Inngest functions.
 *
 * Inngest functions run outside Nest's request scope, so they cannot inject
 * DrizzleService. This module provides the same two-pool model:
 *
 *   withTenant(orgId, wsId, fn) — app-role pool, RLS GUCs set per transaction.
 *   systemDb()                  — superuser pool, BYPASSES RLS. Use ONLY for the
 *                                 trusted bootstrap lookup that resolves a run's
 *                                 org/workspace from its (trusted) runId before
 *                                 any tenant-scoped work. NEVER for serving data.
 *
 * Pools are created lazily and shared across function invocations in the process.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@bitecodes/db';
import { sql } from 'drizzle-orm';

export type RuntimeDb = ReturnType<typeof drizzle<typeof schema>>;

let _appPool: Pool | null = null;
let _appDb: RuntimeDb | null = null;
let _sysPool: Pool | null = null;
let _sysDb: RuntimeDb | null = null;

function appDb(): RuntimeDb {
  if (!_appDb) {
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString) throw new Error('DATABASE_URL is required');
    _appPool = new Pool({ connectionString, max: 10 });
    _appDb = drizzle(_appPool, { schema });
  }
  return _appDb;
}

/** Superuser connection — bypasses RLS. Bootstrap lookups only. */
export function systemDb(): RuntimeDb {
  if (!_sysDb) {
    const url = process.env['DATABASE_SUPERUSER_URL'] ?? process.env['DATABASE_URL'];
    if (!url) throw new Error('DATABASE_URL is required');
    _sysPool = new Pool({ connectionString: url, max: 5 });
    _sysDb = drizzle(_sysPool, { schema });
  }
  return _sysDb;
}

/** Run fn inside a transaction with RLS tenant GUCs set. */
export async function withTenant<T>(
  organizationId: string,
  workspaceId: string | undefined,
  fn: (tx: RuntimeDb) => Promise<T>,
): Promise<T> {
  return appDb().transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org', ${organizationId}, true)`);
    if (workspaceId) {
      await tx.execute(sql`SELECT set_config('app.current_workspace', ${workspaceId}, true)`);
    }
    return fn(tx as unknown as RuntimeDb);
  });
}
