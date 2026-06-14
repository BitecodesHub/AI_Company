/**
 * Company chat + inter-agent bus (E2). Proves:
 *  - conversation create/list and human message posting persist
 *  - the unified timeline returns the posted turn
 *  - a finished run writes an `observation` agent_message (the bus feed)
 * Skipped without a DB.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { TestHarness, DB_AVAILABLE } from './harness.js';
import { executeAgentRun } from '../src/inngest/agent.run.js';

const mockStep = {
  async run<T>(_id: string, fn: () => Promise<T>): Promise<T> { return fn(); },
  async waitForEvent() { return null; },
  async sendEvent() { return undefined; },
};
const mockLogger = { warn() {}, error() {} };

describe.skipIf(!DB_AVAILABLE)('Company chat + bus (E2)', () => {
  let h: TestHarness;
  let conversationId: string;

  beforeAll(async () => {
    process.env['AI_GATEWAY_MODE'] = 'mock';
    h = await TestHarness.create();
    h.actAs(h.tenantA);
  });

  afterAll(async () => {
    for (const t of ['agent_messages', 'conversation_messages', 'conversations', 'agent_runs', 'agent_versions', 'agents']) {
      await h.pool.query(`DELETE FROM ${t} WHERE organization_id=$1`, [h.tenantA.orgId]).catch(() => {});
    }
    await h.teardown();
  });

  it('creates and lists a conversation', async () => {
    h.actAs(h.tenantA);
    const ws = h.tenantA.wsId;
    const res = await request(h.app.getHttpServer()).post('/v1/conversations').set('x-bitecodes-workspace', ws).send({ subject: 'Q3 launch' });
    expect(res.status).toBe(201);
    conversationId = res.body.id;
    const list = await request(h.app.getHttpServer()).get('/v1/conversations').set('x-bitecodes-workspace', ws);
    expect(list.body.items.some((c: { id: string }) => c.id === conversationId)).toBe(true);
  });

  it('posts a human message and returns it in the unified timeline', async () => {
    h.actAs(h.tenantA);
    const ws = h.tenantA.wsId;
    const post = await request(h.app.getHttpServer())
      .post(`/v1/conversations/${conversationId}/messages`).set('x-bitecodes-workspace', ws)
      .send({ body: 'Kick off the launch plan' });
    expect(post.status).toBe(201);
    expect(post.body.body).toBe('Kick off the launch plan');

    const timeline = await request(h.app.getHttpServer())
      .get(`/v1/conversations/${conversationId}/messages`).set('x-bitecodes-workspace', ws);
    expect(timeline.status).toBe(200);
    expect(timeline.body.items.some((i: { kind: string; data: { body?: string } }) => i.kind === 'turn' && i.data.body === 'Kick off the launch plan')).toBe(true);
  });

  it('a finished run writes an observation to the inter-agent bus', async () => {
    h.actAs(h.tenantA);
    const ws = h.tenantA.wsId;
    const agentRes = await request(h.app.getHttpServer()).post('/v1/agents').set('x-bitecodes-workspace', ws).send({ name: 'Bus', role: 'r', costTier: 'fast' });
    const agentId = agentRes.body.id;
    const versionId = agentRes.body.activeVersionId;
    const runId = crypto.randomUUID();
    await h.pool.query(
      `INSERT INTO agent_runs (id,organization_id,workspace_id,agent_id,agent_version_id,trigger_type,status,input,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,'manual','queued','"hello"',now(),now())`,
      [runId, h.tenantA.orgId, ws, agentId, versionId],
    );
    const result = await executeAgentRun({ event: { data: { runId } }, step: mockStep, logger: mockLogger });
    expect(result.status).toBe('succeeded');

    const { rows } = await h.pool.query(
      `SELECT kind, from_agent_id FROM agent_messages WHERE run_id=$1 AND kind='observation'`,
      [runId],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].from_agent_id).toBe(agentId);
  });
});
