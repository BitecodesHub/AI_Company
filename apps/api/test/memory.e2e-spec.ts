/**
 * Memory & learning loop (E2) — the measurable acceptance.
 *
 *  1. A request with no keyword match is PROPOSED (low confidence).
 *  2. A human DIVERTS it to a different employee.
 *  3. The SAME request later AUTO-DISPATCHES to the corrected employee — no human
 *     input — because the divert was learned as a long_term routing_correction.
 *  4. GET memories shows the correction; DELETE it; the same request no longer
 *     auto-dispatches (a deleted memory is gone from recall).
 * Skipped without a DB.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { TestHarness, DB_AVAILABLE } from './harness.js';

const REQ = 'please fix my broken account thing';

describe.skipIf(!DB_AVAILABLE)('Memory & learning loop (E2)', () => {
  let h: TestHarness;
  let billingId: string;
  let supportId: string;
  let ws: string;

  beforeAll(async () => {
    h = await TestHarness.create();
    h.actAs(h.tenantA);
    ws = h.tenantA.wsId;
    const mk = async (name: string) => (await request(h.app.getHttpServer()).post('/v1/agents').set('x-bitecodes-workspace', ws).send({ name, role: 'r', costTier: 'fast' })).body.id as string;
    billingId = await mk('Billing');
    supportId = await mk('Support');
    await h.pool.query(`UPDATE agents SET routing_keywords=$2 WHERE id=$1`, [billingId, JSON.stringify(['billing', 'invoice'])]);
  });

  afterAll(async () => {
    for (const t of ['agent_memories', 'routing_decisions', 'agent_runs', 'agent_versions', 'agents']) {
      await h.pool.query(`DELETE FROM ${t} WHERE organization_id=$1`, [h.tenantA.orgId]).catch(() => {});
    }
    await h.teardown();
  });

  const route = () => request(h.app.getHttpServer()).post('/v1/orchestration/route').set('x-bitecodes-workspace', ws).send({ request: REQ });

  it('the request starts as a low-confidence proposal (not auto-dispatched)', async () => {
    h.actAs(h.tenantA);
    const res = await route();
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('proposed');
    expect(res.body.autoDispatched).toBe(false);
  });

  it('diverting to Support teaches the router (writes a routing_correction)', async () => {
    h.actAs(h.tenantA);
    const r = await route();
    const confirm = await request(h.app.getHttpServer())
      .post(`/v1/orchestration/decisions/${r.body.id}/confirm`).set('x-bitecodes-workspace', ws)
      .send({ divertToAgentId: supportId });
    expect(confirm.status).toBe(200);

    const mem = await request(h.app.getHttpServer()).get(`/v1/agents/${supportId}/memories`).set('x-bitecodes-workspace', ws);
    expect(mem.body.items.some((m: { kind: string }) => m.kind === 'routing_correction')).toBe(true);
  });

  it('the SAME request now auto-dispatches to Support — no human input', async () => {
    h.actAs(h.tenantA);
    const res = await route();
    expect(res.body.status).toBe('auto_dispatched');
    expect(res.body.chosenAgentId).toBe(supportId);
    expect(res.body.runId).toBeTruthy();
  });

  it('deleting the memory un-learns the route', async () => {
    h.actAs(h.tenantA);
    const mem = await request(h.app.getHttpServer()).get(`/v1/agents/${supportId}/memories`).set('x-bitecodes-workspace', ws);
    const correction = mem.body.items.find((m: { kind: string }) => m.kind === 'routing_correction');
    const del = await request(h.app.getHttpServer()).delete(`/v1/agents/${supportId}/memories/${correction.id}`).set('x-bitecodes-workspace', ws);
    expect(del.status).toBe(204);

    const res = await route();
    expect(res.body.status).toBe('proposed'); // back to a proposal — the learned route is gone
    expect(res.body.chosenAgentId).toBeNull();
  });
});
