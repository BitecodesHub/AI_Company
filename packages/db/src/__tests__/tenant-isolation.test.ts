/**
 * P1-07 — Tenant isolation test (mandatory CI gate per BUILD_GUIDE §14).
 *
 * Seeds two orgs using a SUPERUSER connection, then verifies RLS enforcement
 * through the APP ROLE connection (bitecodes_app, NOBYPASSRLS).
 *
 * Requires:
 *   DATABASE_URL = postgresql://bitecodes_app:...@localhost/bitecodes  (app role)
 *   DATABASE_SUPERUSER_URL = postgresql://superuser@localhost/bitecodes (seed/cleanup)
 *
 * Skip gracefully when DATABASE_URL is unset (unit CI without DB).
 * This test MUST fail if RLS is disabled or if the app role bypasses RLS.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql, eq } from 'drizzle-orm';
import { pgTable, uuid, text, boolean, timestamp, pgEnum, integer, jsonb } from 'drizzle-orm/pg-core';

const APP_URL  = process.env['DATABASE_URL'];
const ROOT_URL = process.env['DATABASE_SUPERUSER_URL'] ?? APP_URL;

// Minimal inline schema for the test
const roleEnum = pgEnum('role', ['owner', 'admin', 'member', 'viewer']);
const agentModeEnum = pgEnum('agent_mode', ['sandbox', 'production']);
const costTierEnum = pgEnum('cost_tier', ['fast', 'smart', 'auto']);

const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  plan: text('plan').notNull().default('free'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

const memberships = pgTable('memberships', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull(),
  organizationId: uuid('organization_id').notNull(),
  workspaceId: uuid('workspace_id'),
  role: roleEnum('role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
});

const agents = pgTable('agents', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid('organization_id').notNull(),
  workspaceId: uuid('workspace_id'),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  role: text('role').notNull(),
  mode: agentModeEnum('mode').notNull().default('sandbox'),
  costTier: costTierEnum('cost_tier').notNull().default('auto'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

const testSchema = { organizations, workspaces, memberships, agents };

describe.skipIf(!APP_URL)('Tenant isolation (RLS) — P1-07', () => {
  // Superuser pool for seeding/cleanup (bypasses RLS)
  let rootPool: Pool;
  let rootDb: ReturnType<typeof drizzle<typeof testSchema>>;
  // App role pool (NOBYPASSRLS — subject to RLS policies)
  let appPool: Pool;
  let appDb: ReturnType<typeof drizzle<typeof testSchema>>;

  let orgAId: string;
  let orgBId: string;
  let wsAId:  string;

  beforeAll(async () => {
    rootPool = new Pool({ connectionString: ROOT_URL });
    rootDb   = drizzle(rootPool, { schema: testSchema });
    appPool  = new Pool({ connectionString: APP_URL });
    appDb    = drizzle(appPool, { schema: testSchema });

    // Seed two organizations as superuser
    const [orgA] = await rootDb.insert(organizations).values({ name: 'Org A', slug: 'rls-test-org-a' }).returning({ id: organizations.id });
    const [orgB] = await rootDb.insert(organizations).values({ name: 'Org B', slug: 'rls-test-org-b' }).returning({ id: organizations.id });
    orgAId = orgA!.id;
    orgBId = orgB!.id;

    // Workspace for org A
    const [wsA] = await rootDb.insert(workspaces).values({ organizationId: orgAId, name: 'WS A', slug: 'ws-a' }).returning({ id: workspaces.id });
    wsAId = wsA!.id;

    // Insert agent in org A (using superuser to bypass RLS for setup)
    await rootDb.insert(agents).values({
      organizationId: orgAId,
      workspaceId: wsAId,
      name: 'Agent A',
      slug: 'agent-a',
      role: 'Tester',
      createdBy: orgAId, // placeholder
    });
  });

  afterAll(async () => {
    if (rootPool) {
      // Cleanup test data
      await rootPool.query(`DELETE FROM agents WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
      await rootPool.query(`DELETE FROM workspaces WHERE organization_id IN ($1, $2)`, [orgAId, orgBId]);
      await rootPool.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [orgAId, orgBId]);
      await rootPool.end();
    }
    if (appPool) await appPool.end();
  });

  it('org A can read its own agents when GUC is set', async () => {
    // Use withTenant pattern to set GUC
    const rows = await appDb.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.current_org', ${orgAId}, true)`);
      return tx.select().from(agents).where(eq(agents.organizationId, orgAId));
    });
    expect(rows.length).toBeGreaterThan(0);
  });

  it('🔴 org B sees ZERO rows from org A (RLS enforced) — MUST FAIL if RLS disabled', async () => {
    // Set GUC to org B — should see none of org A's data
    const rows = await appDb.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.current_org', ${orgBId}, true)`);
      // Query WITHOUT explicit org filter — RLS must block org A's agents
      return tx.select().from(agents);
    });
    // If RLS is disabled, org B would see org A's agents and this test FAILS
    expect(rows).toHaveLength(0);
  });

  it('no GUC set → default-deny (empty result)', async () => {
    // Connect without setting any GUC — current_setting returns '' → policy = false → 0 rows
    const rows = await appDb.select().from(agents);
    expect(rows).toHaveLength(0);
  });
});
