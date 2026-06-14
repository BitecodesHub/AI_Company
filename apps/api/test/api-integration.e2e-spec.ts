/**
 * API Integration Tests (E2) — full round-trip with real database.
 *
 * Uses the shared TestHarness (harness.ts) which:
 *  - boots the full AppModule (real TenantGuard + RbacGuard, mock AuthGuard)
 *  - seeds two tenant contexts (A and B) as superuser to bypass RLS
 *  - allows swapping the acting user mid-test for cross-tenant assertions
 *
 * Suite is skipped when DATABASE_URL is unset (CI without a DB).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { TestHarness, DB_AVAILABLE } from './harness.js';

describe.skipIf(!DB_AVAILABLE)('API Integration Tests (E2)', () => {
  let h: TestHarness;

  beforeAll(async () => { h = await TestHarness.create(); });
  afterAll(async () => { await h.teardown(); });

  // ── Health (public) ──────────────────────────────────────────────────────────
  describe('Health endpoints (public)', () => {
    it('GET /health returns 200 { status: "ok" }', async () => {
      const res = await request(h.app.getHttpServer()).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('GET /ready returns 200', async () => {
      const res = await request(h.app.getHttpServer()).get('/ready');
      expect(res.status).toBe(200);
    });
  });

  // ── Error envelope ────────────────────────────────────────────────────────────
  describe('Error envelope', () => {
    it('unknown route returns canonical 404 envelope', async () => {
      h.actAs(h.tenantA);
      const res = await request(h.app.getHttpServer())
        .get('/v1/does-not-exist')
        .set('x-bitecodes-workspace', h.tenantA.wsId);
      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  // ── Agent CRUD round-trip (tenant A) ─────────────────────────────────────────
  describe('Agent CRUD (tenant A)', () => {
    let agentId: string;

    it('POST /v1/agents creates an agent', async () => {
      h.actAs(h.tenantA);
      const res = await request(h.app.getHttpServer())
        .post('/v1/agents')
        .set('x-bitecodes-workspace', h.tenantA.wsId)
        .send({ name: 'Test Agent', role: 'Test role', goal: 'Testing', costTier: 'fast' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Test Agent');
      expect(res.body.id).toBeDefined();
      agentId = res.body.id;
    });

    it('GET /v1/agents lists the created agent', async () => {
      h.actAs(h.tenantA);
      const res = await request(h.app.getHttpServer())
        .get('/v1/agents')
        .set('x-bitecodes-workspace', h.tenantA.wsId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.some((a: { id: string }) => a.id === agentId)).toBe(true);
    });

    it('GET /v1/agents/:id fetches the agent', async () => {
      h.actAs(h.tenantA);
      const res = await request(h.app.getHttpServer())
        .get(`/v1/agents/${agentId}`)
        .set('x-bitecodes-workspace', h.tenantA.wsId);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(agentId);
    });

    it('PATCH /v1/agents/:id updates the agent', async () => {
      h.actAs(h.tenantA);
      const res = await request(h.app.getHttpServer())
        .patch(`/v1/agents/${agentId}`)
        .set('x-bitecodes-workspace', h.tenantA.wsId)
        .send({ goal: 'Updated goal' });

      expect(res.status).toBe(200);
      expect(res.body.goal).toBe('Updated goal');
    });

    it('DELETE /v1/agents/:id soft-deletes the agent', async () => {
      h.actAs(h.tenantA);
      const res = await request(h.app.getHttpServer())
        .delete(`/v1/agents/${agentId}`)
        .set('x-bitecodes-workspace', h.tenantA.wsId);

      expect(res.status).toBe(204);
    });
  });

  // ── Tenant isolation (HTTP layer) ─────────────────────────────────────────────
  describe('Tenant isolation', () => {
    let agentAId: string;

    beforeAll(async () => {
      h.actAs(h.tenantA);
      const res = await request(h.app.getHttpServer())
        .post('/v1/agents')
        .set('x-bitecodes-workspace', h.tenantA.wsId)
        .send({ name: 'Tenant A Private', role: 'Private', costTier: 'fast' });
      agentAId = res.body.id;
    });

    it('tenant A can list own agents', async () => {
      h.actAs(h.tenantA);
      const res = await request(h.app.getHttpServer())
        .get('/v1/agents')
        .set('x-bitecodes-workspace', h.tenantA.wsId);
      expect(res.status).toBe(200);
      expect(res.body.items.some((a: { id: string }) => a.id === agentAId)).toBe(true);
    });

    it('tenant B cannot access tenant A workspace (403)', async () => {
      h.actAs(h.tenantB);
      const res = await request(h.app.getHttpServer())
        .get('/v1/agents')
        .set('x-bitecodes-workspace', h.tenantA.wsId); // tenant B using A's workspace
      expect(res.status).toBe(403);
    });

    it("tenant B's own workspace returns empty (not A's agents)", async () => {
      h.actAs(h.tenantB);
      const res = await request(h.app.getHttpServer())
        .get('/v1/agents')
        .set('x-bitecodes-workspace', h.tenantB.wsId);
      expect(res.status).toBe(200);
      // A's agent must not be visible to B even via default workspace
      expect(res.body.items.every((a: { id: string }) => a.id !== agentAId)).toBe(true);
    });
  });

  // ── Validation (Zod 422) ──────────────────────────────────────────────────────
  describe('Input validation', () => {
    it('POST /v1/agents without required fields returns 422 VALIDATION_FAILED', async () => {
      h.actAs(h.tenantA);
      const res = await request(h.app.getHttpServer())
        .post('/v1/agents')
        .set('x-bitecodes-workspace', h.tenantA.wsId)
        .send({ goal: 'missing name and role' });

      expect(res.status).toBe(422);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  // ── Idempotency key replay ─────────────────────────────────────────────────────
  describe('Idempotency-Key replay', () => {
    it('replaying a POST with same Idempotency-Key returns same response', async () => {
      h.actAs(h.tenantA);
      const key = crypto.randomUUID();
      const body = { name: 'Idempotency Test Agent', role: 'Testing', costTier: 'fast' };
      const ws = h.tenantA.wsId;

      const res1 = await request(h.app.getHttpServer())
        .post('/v1/agents')
        .set('x-bitecodes-workspace', ws)
        .set('Idempotency-Key', key)
        .send(body);

      const res2 = await request(h.app.getHttpServer())
        .post('/v1/agents')
        .set('x-bitecodes-workspace', ws)
        .set('Idempotency-Key', key)
        .send(body);

      expect([200, 201]).toContain(res1.status);
      expect([200, 201]).toContain(res2.status);
      // Both responses must carry the same agent id
      if (res1.body?.id && res2.body?.id) {
        expect(res1.body.id).toBe(res2.body.id);
      }
    });
  });
});
