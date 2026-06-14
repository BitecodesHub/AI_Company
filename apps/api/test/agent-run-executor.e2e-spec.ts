/**
 * Executor persistence (E2) — proves the agent/run executor reads real data and
 * persists real results inside withTenant (no placeholder IDs, no fake success).
 *
 * Runs in AI_GATEWAY_MODE=mock so the model call is deterministic and offline.
 * A mock `step` executes each step inline so we exercise the real DB writes.
 *
 * Skipped when DATABASE_URL is unset (CI without a DB).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import crypto from 'node:crypto';
import { executeAgentRun } from '../src/inngest/agent.run.js';
import { seedTenant, cleanupTenants, DB_AVAILABLE, type TenantFixture } from './harness.js';

// Inline mock step: run() executes the fn; sendEvent/waitForEvent are no-ops.
const mockStep = {
  async run<T>(_id: string, fn: () => Promise<T>): Promise<T> { return fn(); },
  async waitForEvent() { return null; },
  async sendEvent() { return undefined; },
};
const mockLogger = { warn() {}, error() {} };

describe.skipIf(!DB_AVAILABLE)('Agent run executor (E2)', () => {
  let pool: Pool;
  let tenant: TenantFixture;

  beforeAll(() => {
    process.env['AI_GATEWAY_MODE'] = 'mock';
    const url = process.env['DATABASE_SUPERUSER_URL'] ?? process.env['DATABASE_URL']!;
    pool = new Pool({ connectionString: url });
  });

  afterAll(async () => {
    if (tenant) {
      for (const t of ['run_steps', 'approvals', 'audit_logs']) {
        await pool.query(`DELETE FROM ${t} WHERE organization_id = $1`, [tenant.orgId]).catch(() => {});
      }
    }
    await cleanupTenants(pool, [tenant]);
    await pool.end();
  });

  it('persists a succeeded run with steps and an audit log', async () => {
    tenant = await seedTenant(pool, 'Exec');
    const agentId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const runId = crypto.randomUUID();

    await pool.query(
      `INSERT INTO agents (id, organization_id, workspace_id, name, slug, role, cost_tier, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,'Exec Agent','exec-agent','Tester','auto',$4, now(), now())`,
      [agentId, tenant.orgId, tenant.wsId, tenant.userId],
    );
    await pool.query(
      `INSERT INTO agent_versions (id, agent_id, organization_id, workspace_id, version_number, system_prompt, config, created_by, created_at)
       VALUES ($1,$2,$3,$4,1,'You are a test agent.','{}',$5, now())`,
      [versionId, agentId, tenant.orgId, tenant.wsId, tenant.userId],
    );
    await pool.query(
      `INSERT INTO agent_runs (id, organization_id, workspace_id, agent_id, agent_version_id, trigger_type, status, input, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'manual','queued','"Say hello"', now(), now())`,
      [runId, tenant.orgId, tenant.wsId, agentId, versionId],
    );

    const result = await executeAgentRun({
      event: { data: { runId } },
      step: mockStep,
      logger: mockLogger,
    });

    expect(result.status).toBe('succeeded');

    const { rows: runRows } = await pool.query(
      `SELECT status, output, tokens_in, tokens_out, finished_at FROM agent_runs WHERE id = $1`,
      [runId],
    );
    expect(runRows[0].status).toBe('succeeded');
    expect(runRows[0].finished_at).not.toBeNull();
    expect(runRows[0].output).toBeDefined();

    const { rows: stepRows } = await pool.query(
      `SELECT type, status FROM run_steps WHERE run_id = $1 ORDER BY index`,
      [runId],
    );
    expect(stepRows.length).toBeGreaterThanOrEqual(1);
    expect(stepRows[0].type).toBe('llm');

    const { rows: auditRows } = await pool.query(
      `SELECT action FROM audit_logs WHERE target_id = $1 AND action = 'run.finished'`,
      [runId],
    );
    expect(auditRows.length).toBe(1);
  });
});
