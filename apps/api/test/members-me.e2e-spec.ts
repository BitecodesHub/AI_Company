/**
 * Session + member management (E2).
 *
 * Proves GET /v1/me returns the real user/workspace/role, and that member
 * mutations are RBAC-gated: an owner can invite/list, a viewer is FORBIDDEN.
 * Skipped without a DB.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { TestHarness, DB_AVAILABLE } from './harness.js';

describe.skipIf(!DB_AVAILABLE)('Session + members (E2)', () => {
  let h: TestHarness;
  let viewerId: string;

  beforeAll(async () => {
    h = await TestHarness.create();
    // Seed a viewer in tenant A's org to exercise RBAC denial.
    viewerId = crypto.randomUUID();
    const uniq = crypto.randomUUID().slice(0, 8);
    await h.pool.query(
      `INSERT INTO users (id,email,name,email_verified,created_at,updated_at) VALUES ($1,$2,'Viewer',true,now(),now())`,
      [viewerId, `viewer-${uniq}@test.invalid`],
    );
    await h.pool.query(
      `INSERT INTO memberships (id,user_id,organization_id,workspace_id,role,created_at) VALUES ($1,$2,$3,$4,'viewer',now())`,
      [crypto.randomUUID(), viewerId, h.tenantA.orgId, h.tenantA.wsId],
    );
  });

  afterAll(async () => {
    await h.pool.query(`DELETE FROM memberships WHERE user_id=$1`, [viewerId]).catch(() => {});
    await h.pool.query(`DELETE FROM invitations WHERE organization_id=$1`, [h.tenantA.orgId]).catch(() => {});
    await h.pool.query(`DELETE FROM users WHERE id=$1`, [viewerId]).catch(() => {});
    await h.teardown();
  });

  it('GET /v1/me returns the real user, workspace, role, and workspaces', async () => {
    h.actAs(h.tenantA);
    const res = await request(h.app.getHttpServer())
      .get('/v1/me')
      .set('x-bitecodes-workspace', h.tenantA.wsId);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(h.tenantA.userId);
    expect(res.body.workspace.id).toBe(h.tenantA.wsId);
    expect(res.body.role).toBe('owner');
    expect(res.body.workspaces.some((w: { id: string }) => w.id === h.tenantA.wsId)).toBe(true);
  });

  it('owner can invite a member (201 + token)', async () => {
    h.actAs(h.tenantA);
    const res = await request(h.app.getHttpServer())
      .post('/v1/invitations')
      .set('x-bitecodes-workspace', h.tenantA.wsId)
      .send({ email: 'new.hire@example.com', role: 'member' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.email).toBe('new.hire@example.com');
  });

  it('owner sees members list including themselves', async () => {
    h.actAs(h.tenantA);
    const res = await request(h.app.getHttpServer())
      .get('/v1/members')
      .set('x-bitecodes-workspace', h.tenantA.wsId);
    expect(res.status).toBe(200);
    expect(res.body.items.some((m: { userId: string }) => m.userId === h.tenantA.userId)).toBe(true);
  });

  it('viewer is FORBIDDEN from inviting', async () => {
    h.actAs({ userId: viewerId, orgId: h.tenantA.orgId, wsId: h.tenantA.wsId });
    const res = await request(h.app.getHttpServer())
      .post('/v1/invitations')
      .set('x-bitecodes-workspace', h.tenantA.wsId)
      .send({ email: 'blocked@example.com', role: 'member' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
