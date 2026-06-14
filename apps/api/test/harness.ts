/**
 * Shared test harness for API integration tests.
 *
 * Usage:
 *   const harness = await TestHarness.create();
 *   const { app, tenantA, tenantB } = harness;
 *   harness.actAs(tenantA); // swap the mock AuthGuard to act as tenant A
 *   harness.actAs(tenantB); // swap to act as tenant B
 *   await harness.teardown();
 *
 * The harness boots the full AppModule with a mock AuthGuard (no live session
 * needed). TenantGuard and RbacGuard remain real so tenant isolation is tested.
 * Fixtures are seeded as superuser (SEED_URL) to bypass RLS.
 */
import 'reflect-metadata';
import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import crypto from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { BetterAuthService } from '../src/auth/better-auth.service.js';

export interface TenantFixture {
  userId: string;
  orgId: string;
  wsId: string;
}

/**
 * Mock BetterAuthService that makes the REAL AuthGuard resolve a session for the
 * acting user. Overriding the auth *service* (rather than the AuthGuard class)
 * avoids guard-class-token identity issues under vitest's ESM/swc transform,
 * while keeping TenantGuard + RbacGuard fully real so isolation is tested.
 */
class MockBetterAuth {
  userId = '';
  setUserId(id: string) { this.userId = id; }
  get auth() {
    const self = this;
    return {
      api: {
        async getSession() {
          return self.userId ? { user: { id: self.userId }, session: { userId: self.userId } } : null;
        },
      },
    };
  }
}

export async function seedTenant(pool: Pool, name: string): Promise<TenantFixture> {
  const userId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  const wsId = crypto.randomUUID();
  const uniq = crypto.randomUUID().slice(0, 8);

  await pool.query(
    `INSERT INTO users (id, email, name, email_verified, created_at, updated_at)
     VALUES ($1, $2, $3, true, now(), now())`,
    [userId, `${name}-${uniq}@test.invalid`, name],
  );
  await pool.query(
    `INSERT INTO organizations (id, name, slug, plan, created_at, updated_at)
     VALUES ($1, $2, $3, 'free', now(), now())`,
    [orgId, `${name} Corp`, `${name.toLowerCase()}-${uniq}`],
  );
  await pool.query(
    `INSERT INTO workspaces (id, organization_id, name, slug, created_at, updated_at)
     VALUES ($1, $2, 'Default', 'default', now(), now())`,
    [wsId, orgId],
  );
  await pool.query(
    `INSERT INTO memberships (id, user_id, organization_id, workspace_id, role, created_at)
     VALUES ($1, $2, $3, $4, 'owner', now())`,
    [crypto.randomUUID(), userId, orgId, wsId],
  );

  return { userId, orgId, wsId };
}

export async function cleanupTenants(pool: Pool, tenants: Array<TenantFixture | undefined>): Promise<void> {
  const orgIds = tenants.map(t => t?.orgId).filter(Boolean) as string[];
  const userIds = tenants.map(t => t?.userId).filter(Boolean) as string[];
  if (orgIds.length) {
    // Delete all tenant-scoped data in dependency order
    const tables = ['agents', 'agent_runs', 'agent_versions', 'knowledge_bases', 'documents',
      'content_items', 'brand_voices', 'workflows', 'workflow_runs', 'inbox_messages',
      'memberships', 'workspaces', 'organizations'];
    for (const table of tables) {
      await pool.query(`DELETE FROM ${table} WHERE organization_id = ANY($1)`, [orgIds]).catch(() => {});
    }
  }
  if (userIds.length) {
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [userIds]).catch(() => {});
  }
}

export class TestHarness {
  public app!: INestApplication;
  public pool!: Pool;
  public tenantA!: TenantFixture;
  public tenantB!: TenantFixture;
  private auth!: MockBetterAuth;

  /** Boot the test harness. Call in beforeAll. */
  static async create(): Promise<TestHarness> {
    const h = new TestHarness();
    const dbUrl = process.env['DATABASE_URL'];
    const seedUrl = process.env['DATABASE_SUPERUSER_URL'] ?? dbUrl;
    if (!dbUrl) throw new Error('DATABASE_URL not set — set it or use describe.skipIf(!DATABASE_URL)');

    h.pool = new Pool({ connectionString: seedUrl ?? dbUrl });
    h.tenantA = await seedTenant(h.pool, 'TenantA');
    h.tenantB = await seedTenant(h.pool, 'TenantB');

    h.auth = new MockBetterAuth();
    h.auth.setUserId(h.tenantA.userId);

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(BetterAuthService)
      .useValue(h.auth)
      .compile();

    h.app = module.createNestApplication();
    await h.app.init();
    return h;
  }

  /** Switch the acting user for subsequent requests. */
  actAs(tenant: TenantFixture) {
    this.auth.setUserId(tenant.userId);
  }

  /** Tear down the app and clean up seeded data. Call in afterAll. */
  async teardown(): Promise<void> {
    if (this.pool) {
      await cleanupTenants(this.pool, [this.tenantA, this.tenantB]);
      await this.pool.end();
    }
    await this.app?.close();
  }
}

export const DB_AVAILABLE = !!process.env['DATABASE_URL'];
