/**
 * Marketplace hire (E2). POST /v1/agents/hire provisions a real employee from a
 * role template — agent (with router flag + routing keywords), an active version,
 * and default controls — and it appears in the employee list. Skipped without a DB.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { TestHarness, DB_AVAILABLE } from './harness.js';

describe.skipIf(!DB_AVAILABLE)('Marketplace hire (E2)', () => {
  let h: TestHarness;
  let ws: string;

  beforeAll(async () => { h = await TestHarness.create(); h.actAs(h.tenantA); ws = h.tenantA.wsId; });
  afterAll(async () => {
    for (const t of ['employee_controls', 'agent_versions', 'agents']) {
      await h.pool.query(`DELETE FROM ${t} WHERE organization_id=$1`, [h.tenantA.orgId]).catch(() => {});
    }
    await h.teardown();
  });

  it('hires an employee from a template (router + keywords + controls)', async () => {
    h.actAs(h.tenantA);
    const res = await request(h.app.getHttpServer())
      .post('/v1/agents/hire').set('x-bitecodes-workspace', ws)
      .send({
        name: 'Avery', role: 'Chief of Staff', goal: 'Route work', systemPrompt: 'You are Avery.',
        costTier: 'smart', avatar: '🧭', isRouter: true, routingKeywords: ['help', 'route', 'assign'],
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Avery');
    const agentId = res.body.id;

    // Router flag + keywords persisted on the agent row.
    const { rows: arows } = await h.pool.query(`SELECT is_router, routing_keywords, avatar, mode FROM agents WHERE id=$1`, [agentId]);
    expect(arows[0].is_router).toBe(true);
    expect(arows[0].routing_keywords).toEqual(['help', 'route', 'assign']);
    expect(arows[0].avatar).toBe('🧭');
    expect(arows[0].mode).toBe('production');

    // A version and default controls row exist.
    const { rows: vrows } = await h.pool.query(`SELECT count(*)::int n FROM agent_versions WHERE agent_id=$1`, [agentId]);
    expect(vrows[0].n).toBe(1);
    const { rows: crows } = await h.pool.query(`SELECT activation_state FROM employee_controls WHERE agent_id=$1`, [agentId]);
    expect(crows[0].activation_state).toBe('active');

    // Appears in the employee list.
    const list = await request(h.app.getHttpServer()).get('/v1/agents').set('x-bitecodes-workspace', ws);
    expect(list.body.items.some((a: { id: string }) => a.id === agentId)).toBe(true);
  });
});
