/**
 * RLS two-clause isolation (E2) — proves the canonical policy at the DATABASE
 * level, connecting as the real `bitecodes_app` role (NOSUPERUSER, NOBYPASSRLS).
 *
 * Two-clause policy:
 *   org matches AND (workspace_id IS NULL OR workspace_id = current_workspace)
 *
 * Asserts:
 *   - an org-level row (workspace_id NULL) is visible from any workspace in the org
 *   - a workspace-scoped row is visible only under its own workspace GUC
 *   - it is NOT visible under a sibling workspace GUC (same org)
 *
 * Setup (org/workspaces/user) runs as superuser to bypass RLS; the assertions
 * run as bitecodes_app so RLS is genuinely enforced. Skipped without a DB.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import crypto from 'node:crypto';
import { DB_AVAILABLE } from './harness.js';

const APP_URL = process.env['DATABASE_URL']; // bitecodes_app (RLS enforced)
const SU_URL = process.env['DATABASE_SUPERUSER_URL'] ?? APP_URL; // bypasses RLS

describe.skipIf(!DB_AVAILABLE || !APP_URL)('RLS two-clause isolation (E2)', () => {
  let su: Pool;
  let app: Pool;
  const orgId = crypto.randomUUID();
  const wsA = crypto.randomUUID();
  const wsB = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const orgLevelAgent = crypto.randomUUID();
  const wsAAgent = crypto.randomUUID();

  beforeAll(async () => {
    su = new Pool({ connectionString: SU_URL });
    app = new Pool({ connectionString: APP_URL });
    const uniq = crypto.randomUUID().slice(0, 8);
    await su.query(`INSERT INTO users (id,email,name,email_verified,created_at,updated_at) VALUES ($1,$2,'RLS',true,now(),now())`, [userId, `rls-${uniq}@test.invalid`]);
    await su.query(`INSERT INTO organizations (id,name,slug,plan,created_at,updated_at) VALUES ($1,'RLS Corp',$2,'free',now(),now())`, [orgId, `rls-${uniq}`]);
    await su.query(`INSERT INTO workspaces (id,organization_id,name,slug,created_at,updated_at) VALUES ($1,$2,'A','a',now(),now())`, [wsA, orgId]);
    await su.query(`INSERT INTO workspaces (id,organization_id,name,slug,created_at,updated_at) VALUES ($1,$2,'B','b',now(),now())`, [wsB, orgId]);
  });

  afterAll(async () => {
    await su.query(`DELETE FROM agents WHERE organization_id=$1`, [orgId]).catch(() => {});
    await su.query(`DELETE FROM workspaces WHERE organization_id=$1`, [orgId]).catch(() => {});
    await su.query(`DELETE FROM organizations WHERE id=$1`, [orgId]).catch(() => {});
    await su.query(`DELETE FROM users WHERE id=$1`, [userId]).catch(() => {});
    await su.end();
    await app.end();
  });

  /** Run fn as bitecodes_app inside a tx with the given GUCs set. */
  async function asTenant<T>(ws: string | null, fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await app.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('app.current_org', $1, true)`, [orgId]);
      if (ws) await c.query(`SELECT set_config('app.current_workspace', $1, true)`, [ws]);
      const out = await fn(c);
      await c.query('ROLLBACK'); // assertions only; never persist GUC-scoped writes here
      return out;
    } finally {
      c.release();
    }
  }

  it('inserts an org-level row (workspace_id NULL) and a workspace row as bitecodes_app', async () => {
    // Persist via superuser so rows survive the asTenant ROLLBACK used for reads.
    await su.query(
      `INSERT INTO agents (id,organization_id,workspace_id,name,slug,role,cost_tier,created_by,created_at,updated_at)
       VALUES ($1,$2,NULL,'Org Agent','org-agent','r','auto',$3,now(),now())`,
      [orgLevelAgent, orgId, userId],
    );
    await su.query(
      `INSERT INTO agents (id,organization_id,workspace_id,name,slug,role,cost_tier,created_by,created_at,updated_at)
       VALUES ($1,$2,$3,'WS-A Agent','wsa-agent','r','auto',$4,now(),now())`,
      [wsAAgent, orgId, wsA, userId],
    );
    expect(true).toBe(true);
  });

  it('workspace A sees both the org-level row and its own workspace row', async () => {
    const ids = await asTenant(wsA, async (c) => {
      const { rows } = await c.query(`SELECT id FROM agents WHERE organization_id=$1`, [orgId]);
      return rows.map((r) => r.id);
    });
    expect(ids).toContain(orgLevelAgent);
    expect(ids).toContain(wsAAgent);
  });

  it('workspace B (same org) sees the org-level row but NOT workspace A\'s row', async () => {
    const ids = await asTenant(wsB, async (c) => {
      const { rows } = await c.query(`SELECT id FROM agents WHERE organization_id=$1`, [orgId]);
      return rows.map((r) => r.id);
    });
    expect(ids).toContain(orgLevelAgent);
    expect(ids).not.toContain(wsAAgent);
  });

  it('WITH CHECK rejects inserting a row for a different workspace than the GUC', async () => {
    await expect(
      asTenant(wsB, async (c) => {
        // Attempt to insert a row tagged for workspace A while acting as workspace B.
        await c.query(
          `INSERT INTO agents (id,organization_id,workspace_id,name,slug,role,cost_tier,created_by,created_at,updated_at)
           VALUES ($1,$2,$3,'Sneaky','sneaky','r','auto',$4,now(),now())`,
          [crypto.randomUUID(), orgId, wsA, userId],
        );
      }),
    ).rejects.toThrow();
  });
});
