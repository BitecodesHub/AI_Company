import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index';

export type DbClient = ReturnType<typeof drizzle<typeof schema>>;

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env['DATABASE_URL'],
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export function createDb(): DbClient {
  return drizzle(getPool(), { schema, logger: process.env['NODE_ENV'] === 'development' });
}

/**
 * withTenant — opens a transaction, sets RLS GUCs, executes fn, then commits.
 *
 * Every tenant-scoped query MUST run inside this wrapper so that Postgres
 * Row-Level Security policies can filter rows correctly.
 * Using `set_config($1, $2, true)` means the GUC is transaction-local
 * and cannot leak across pooled connections.
 */
export async function withTenant<T>(
  db: DbClient,
  orgId: string,
  workspaceId: string | undefined,
  fn: (tx: DbClient) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      /* sql */ `SELECT set_config('app.current_org', ${JSON.stringify(orgId)}, true)`,
    );
    if (workspaceId) {
      await tx.execute(
        /* sql */ `SELECT set_config('app.current_workspace', ${JSON.stringify(workspaceId)}, true)`,
      );
    } else {
      await tx.execute(
        /* sql */ `SELECT set_config('app.current_workspace', '', true)`,
      );
    }
    return fn(tx as unknown as DbClient);
  });
}
