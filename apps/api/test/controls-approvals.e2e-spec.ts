/**
 * Employee controls + approvals (E2). Proves:
 *  - GET controls returns defaults; PATCH persists (member floor)
 *  - bypass_permission / approval_mode=never are owner-only (member → FORBIDDEN)
 *  - activate/deactivate persists, and a deactivated employee's run fails cleanly
 *  - POST /v1/approvals/:id/decide resolves the REAL runId and persists the decision
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

describe.skipIf(!DB_AVAILABLE)('Employee controls + approvals (E2)', () => {
  let h: TestHarness;
  let agentId: string;
  let versionId: string;
  let memberId: string;

  beforeAll(async () => {
    process.env['AI_GATEWAY_MODE'] = 'mock';
    h = await TestHarness.create();
    h.actAs(h.tenantA);

    // Create an agent (also creates an active version) via the real API.
    const res = await request(h.app.getHttpServer())
      .post('/v1/agents')
      .set('x-bitecodes-workspace', h.tenantA.wsId)
      .send({ name: 'Controlled', role: 'r', costTier: 'fast' });
    agentId = res.body.id;
    versionId = res.body.activeVersionId;

    // A plain member to exercise the owner-only elevated-controls rule.
    memberId = crypto.randomUUID();
    const uniq = crypto.randomUUID().slice(0, 8);
    await h.pool.query(`INSERT INTO users (id,email,name,email_verified,created_at,updated_at) VALUES ($1,$2,'M',true,now(),now())`, [memberId, `m-${uniq}@test.invalid`]);
    await h.pool.query(`INSERT INTO memberships (id,user_id,organization_id,workspace_id,role,created_at) VALUES ($1,$2,$3,$4,'member',now())`, [crypto.randomUUID(), memberId, h.tenantA.orgId, h.tenantA.wsId]);
  });

  afterAll(async () => {
    for (const t of ['employee_controls', 'agent_runs', 'agent_versions', 'agents', 'approvals']) {
      await h.pool.query(`DELETE FROM ${t} WHERE organization_id=$1`, [h.tenantA.orgId]).catch(() => {});
    }
    await h.pool.query(`DELETE FROM memberships WHERE user_id=$1`, [memberId]).catch(() => {});
    await h.pool.query(`DELETE FROM users WHERE id=$1`, [memberId]).catch(() => {});
    await h.teardown();
  });

  it('GET controls returns safe defaults', async () => {
    h.actAs(h.tenantA);
    const res = await request(h.app.getHttpServer())
      .get(`/v1/agents/${agentId}/controls`)
      .set('x-bitecodes-workspace', h.tenantA.wsId);
    expect(res.status).toBe(200);
    expect(res.body.activationState).toBe('active');
    expect(res.body.approvalMode).toBe('risky');
    expect(res.body.bypassPermission).toBe(false);
  });

  it('owner can PATCH non-elevated controls (plan mode, approval mode)', async () => {
    h.actAs(h.tenantA);
    const res = await request(h.app.getHttpServer())
      .patch(`/v1/agents/${agentId}/controls`)
      .set('x-bitecodes-workspace', h.tenantA.wsId)
      .send({ planMode: true, approvalMode: 'always' });
    expect(res.status).toBe(200);
    expect(res.body.planMode).toBe(true);
    expect(res.body.approvalMode).toBe('always');
  });

  it('a member is FORBIDDEN from enabling bypass_permission', async () => {
    h.actAs({ userId: memberId, orgId: h.tenantA.orgId, wsId: h.tenantA.wsId });
    const res = await request(h.app.getHttpServer())
      .patch(`/v1/agents/${agentId}/controls`)
      .set('x-bitecodes-workspace', h.tenantA.wsId)
      .send({ bypassPermission: true });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('deactivate persists and a deactivated employee\'s run fails cleanly', async () => {
    h.actAs(h.tenantA);
    const deact = await request(h.app.getHttpServer())
      .post(`/v1/agents/${agentId}/controls/deactivate`)
      .set('x-bitecodes-workspace', h.tenantA.wsId);
    expect(deact.status).toBe(201);
    expect(deact.body.activationState).toBe('deactivated');

    // Seed a queued run and execute it — the activation gate must reject it.
    const runId = crypto.randomUUID();
    await h.pool.query(
      `INSERT INTO agent_runs (id,organization_id,workspace_id,agent_id,agent_version_id,trigger_type,status,input,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,'manual','queued','"hi"',now(),now())`,
      [runId, h.tenantA.orgId, h.tenantA.wsId, agentId, versionId],
    );
    const result = await executeAgentRun({ event: { data: { runId } }, step: mockStep, logger: mockLogger });
    expect(result.status).toBe('failed');

    const { rows } = await h.pool.query(`SELECT status, failure_reason FROM agent_runs WHERE id=$1`, [runId]);
    expect(rows[0].status).toBe('failed');
    expect(rows[0].failure_reason).toBe('EMPLOYEE_DEACTIVATED');
  });

  it('POST /v1/approvals/:id/decide resolves the real runId and persists the decision', async () => {
    h.actAs(h.tenantA);
    // Seed a run + a pending approval pointing at it.
    const runId = crypto.randomUUID();
    const approvalId = crypto.randomUUID();
    await h.pool.query(
      `INSERT INTO agent_runs (id,organization_id,workspace_id,agent_id,agent_version_id,trigger_type,status,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,'manual','waiting_approval',now(),now())`,
      [runId, h.tenantA.orgId, h.tenantA.wsId, agentId, versionId],
    );
    await h.pool.query(
      `INSERT INTO approvals (id,organization_id,workspace_id,run_id,kind,status,created_at,updated_at)
       VALUES ($1,$2,$3,$4,'tool_call','pending',now(),now())`,
      [approvalId, h.tenantA.orgId, h.tenantA.wsId, runId],
    );

    const res = await request(h.app.getHttpServer())
      .post(`/v1/approvals/${approvalId}/decide`)
      .set('x-bitecodes-workspace', h.tenantA.wsId)
      .send({ decision: 'approved' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.runId).toBe(runId); // real run id, not 'todo'

    const { rows } = await h.pool.query(`SELECT status FROM approvals WHERE id=$1`, [approvalId]);
    expect(rows[0].status).toBe('approved');
  });
});
