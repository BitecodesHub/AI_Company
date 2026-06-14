/**
 * Orchestration (E2): hierarchy + routing/divert. Proves:
 *  - agent-relationships CRUD persists
 *  - a low-confidence route is PROPOSED (not auto-dispatched)
 *  - confirming a proposal dispatches a run carrying the routing_decision_id
 *  - diverting picks a different employee
 *  - a high-confidence (multi-keyword) route auto-dispatches for an owner
 * Skipped without a DB.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { TestHarness, DB_AVAILABLE } from './harness.js';
import { classify } from '../src/orchestration/orchestration.service.js';

describe.skipIf(!DB_AVAILABLE)('Orchestration (E2)', () => {
  let h: TestHarness;
  let billingId: string;
  let supportId: string;

  beforeAll(async () => {
    h = await TestHarness.create();
    h.actAs(h.tenantA);
    const ws = h.tenantA.wsId;
    const mk = async (name: string) => {
      const r = await request(h.app.getHttpServer()).post('/v1/agents').set('x-bitecodes-workspace', ws).send({ name, role: 'r', costTier: 'fast' });
      return r.body.id as string;
    };
    billingId = await mk('Billing');
    supportId = await mk('Support');
    // Keywords drive routing — set via superuser (not in the create DTO).
    await h.pool.query(`UPDATE agents SET routing_keywords = $2 WHERE id = $1`, [billingId, JSON.stringify(['billing', 'invoice', 'refund'])]);
    await h.pool.query(`UPDATE agents SET routing_keywords = $2 WHERE id = $1`, [supportId, JSON.stringify(['support', 'help'])]);
  });

  afterAll(async () => {
    for (const t of ['routing_decisions', 'agent_relationships', 'agent_runs', 'agent_versions', 'agents']) {
      await h.pool.query(`DELETE FROM ${t} WHERE organization_id=$1`, [h.tenantA.orgId]).catch(() => {});
    }
    await h.teardown();
  });

  it('classify() is deterministic and confidence rises with keyword matches', () => {
    const cands = [{ id: billingId, name: 'Billing', keywords: ['billing', 'invoice', 'refund'], isRouter: false }];
    expect(classify('I need a refund for my invoice billing', cands).agentId).toBe(billingId);
    expect(classify('I need a refund for my invoice billing', cands).confidence).toBeGreaterThanOrEqual(0.85);
    expect(classify('hello there', cands).agentId).toBe(billingId); // fallback (only candidate)
    expect(classify('hello there', cands).confidence).toBeLessThan(0.85);
  });

  it('creates and lists an employee relationship', async () => {
    h.actAs(h.tenantA);
    const ws = h.tenantA.wsId;
    const res = await request(h.app.getHttpServer())
      .post('/v1/agent-relationships').set('x-bitecodes-workspace', ws)
      .send({ fromAgentId: supportId, toAgentId: billingId, kind: 'delegates_to' });
    expect(res.status).toBe(201);
    const list = await request(h.app.getHttpServer()).get('/v1/agent-relationships').set('x-bitecodes-workspace', ws);
    expect(list.body.items.some((r: { fromAgentId: string }) => r.fromAgentId === supportId)).toBe(true);
  });

  it('a single-keyword route is PROPOSED (not auto-dispatched)', async () => {
    h.actAs(h.tenantA);
    const res = await request(h.app.getHttpServer())
      .post('/v1/orchestration/route').set('x-bitecodes-workspace', h.tenantA.wsId)
      .send({ request: 'I have a billing question' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('proposed');
    expect(res.body.proposedAgentId).toBe(billingId);
    expect(res.body.autoDispatched).toBe(false);
    expect(res.body.runId).toBeNull();
  });

  it('confirming a proposal dispatches a run with the routing_decision_id', async () => {
    h.actAs(h.tenantA);
    const ws = h.tenantA.wsId;
    // Distinct request per test so learned routing corrections do not bleed across tests.
    const route = await request(h.app.getHttpServer())
      .post('/v1/orchestration/route').set('x-bitecodes-workspace', ws)
      .send({ request: 'a billing matter alpha' });
    const decisionId = route.body.id;

    const confirm = await request(h.app.getHttpServer())
      .post(`/v1/orchestration/decisions/${decisionId}/confirm`).set('x-bitecodes-workspace', ws).send({});
    expect(confirm.status).toBe(200);
    expect(confirm.body.runId).toBeTruthy();

    const { rows } = await h.pool.query(`SELECT routing_decision_id, agent_id FROM agent_runs WHERE id=$1`, [confirm.body.runId]);
    expect(rows[0].routing_decision_id).toBe(decisionId);
    expect(rows[0].agent_id).toBe(billingId);
  });

  it('diverting routes to a different employee', async () => {
    h.actAs(h.tenantA);
    const ws = h.tenantA.wsId;
    const route = await request(h.app.getHttpServer())
      .post('/v1/orchestration/route').set('x-bitecodes-workspace', ws)
      .send({ request: 'a billing matter beta' });
    const confirm = await request(h.app.getHttpServer())
      .post(`/v1/orchestration/decisions/${route.body.id}/confirm`).set('x-bitecodes-workspace', ws)
      .send({ divertToAgentId: supportId });
    expect(confirm.status).toBe(200);
    const { rows } = await h.pool.query(`SELECT agent_id FROM agent_runs WHERE id=$1`, [confirm.body.runId]);
    expect(rows[0].agent_id).toBe(supportId);
  });

  it('a multi-keyword route auto-dispatches for an owner', async () => {
    h.actAs(h.tenantA);
    const res = await request(h.app.getHttpServer())
      .post('/v1/orchestration/route').set('x-bitecodes-workspace', h.tenantA.wsId)
      .send({ request: 'billing invoice refund please' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('auto_dispatched');
    expect(res.body.autoDispatched).toBe(true);
    expect(res.body.runId).toBeTruthy();
  });
});
