/**
 * Onboarding checklist (E2) — the acceptance: signup → hire → first successful
 * run advances the server-owned checklist, and it survives a refetch.
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

describe.skipIf(!DB_AVAILABLE)('Onboarding (E2)', () => {
  let h: TestHarness;
  let ws: string;

  beforeAll(async () => {
    process.env['AI_GATEWAY_MODE'] = 'mock';
    h = await TestHarness.create();
    h.actAs(h.tenantA);
    ws = h.tenantA.wsId;
  });

  afterAll(async () => {
    for (const t of ['onboarding_states', 'agent_messages', 'agent_runs', 'agent_versions', 'agents']) {
      await h.pool.query(`DELETE FROM ${t} WHERE organization_id=$1`, [h.tenantA.orgId]).catch(() => {});
    }
    await h.teardown();
  });

  const getOnboarding = () => request(h.app.getHttpServer()).get('/v1/onboarding').set('x-bitecodes-workspace', ws);
  const stepDone = (body: { steps: Array<{ step: string; done: boolean }> }, step: string) =>
    body.steps.find((s) => s.step === step)?.done ?? false;

  it('starts with nothing completed', async () => {
    h.actAs(h.tenantA);
    const res = await getOnboarding();
    expect(res.status).toBe(200);
    expect(res.body.completedAt).toBeNull();
    expect(stepDone(res.body, 'hire_employee')).toBe(false);
  });

  it('hiring an employee advances hire_employee', async () => {
    h.actAs(h.tenantA);
    const agent = await request(h.app.getHttpServer()).post('/v1/agents').set('x-bitecodes-workspace', ws).send({ name: 'Onb', role: 'r', costTier: 'fast' });
    expect(agent.status).toBe(201);
    const res = await getOnboarding();
    expect(stepDone(res.body, 'hire_employee')).toBe(true);
    expect(res.body.completedAt).toBeNull(); // first_run still pending
  });

  it('a first successful run completes the checklist and survives a refetch', async () => {
    h.actAs(h.tenantA);
    const agent = await request(h.app.getHttpServer()).post('/v1/agents').set('x-bitecodes-workspace', ws).send({ name: 'Onb2', role: 'r', costTier: 'fast' });
    const runId = crypto.randomUUID();
    await h.pool.query(
      `INSERT INTO agent_runs (id,organization_id,workspace_id,agent_id,agent_version_id,trigger_type,status,input,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,'manual','queued','"go"',now(),now())`,
      [runId, h.tenantA.orgId, ws, agent.body.id, agent.body.activeVersionId],
    );
    const result = await executeAgentRun({ event: { data: { runId } }, step: mockStep, logger: mockLogger });
    expect(result.status).toBe('succeeded');

    const res = await getOnboarding();
    expect(stepDone(res.body, 'first_run')).toBe(true);
    expect(res.body.completedAt).not.toBeNull(); // both required steps done

    // Refetch (simulates a page refresh) — state persists server-side.
    const again = await getOnboarding();
    expect(again.body.completedAt).not.toBeNull();
  });

  it('POST /v1/onboarding/advance marks an optional step', async () => {
    h.actAs(h.tenantA);
    const res = await request(h.app.getHttpServer()).post('/v1/onboarding/advance').set('x-bitecodes-workspace', ws).send({ step: 'invite_team' });
    expect(res.status).toBe(201);
    expect(stepDone(res.body, 'invite_team')).toBe(true);
  });
});
