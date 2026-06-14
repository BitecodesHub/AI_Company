/**
 * Agent triggers + scheduler (E2). Proves:
 *  - schedule trigger CRUD persists, seeding nextRunAt from intervalMinutes
 *  - runSchedulerTick fires a DUE trigger: enqueues a schedule run + advances nextRunAt
 *  - it does NOT fire a not-yet-due trigger
 * Skipped without a DB.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { TestHarness, DB_AVAILABLE } from './harness.js';
import { runSchedulerTick } from '../src/inngest/scheduler.tick.js';

describe.skipIf(!DB_AVAILABLE)('Agent triggers + scheduler (E2)', () => {
  let h: TestHarness;
  let agentId: string;
  let triggerId: string;

  beforeAll(async () => {
    h = await TestHarness.create();
    h.actAs(h.tenantA);
    const res = await request(h.app.getHttpServer())
      .post('/v1/agents')
      .set('x-bitecodes-workspace', h.tenantA.wsId)
      .send({ name: 'Scheduled', role: 'r', costTier: 'fast' });
    agentId = res.body.id;
  });

  afterAll(async () => {
    for (const t of ['agent_triggers', 'agent_runs', 'agent_versions', 'agents', 'employee_controls']) {
      await h.pool.query(`DELETE FROM ${t} WHERE organization_id=$1`, [h.tenantA.orgId]).catch(() => {});
    }
    await h.teardown();
  });

  it('creates a schedule trigger and seeds nextRunAt', async () => {
    h.actAs(h.tenantA);
    const res = await request(h.app.getHttpServer())
      .post(`/v1/agents/${agentId}/triggers`)
      .set('x-bitecodes-workspace', h.tenantA.wsId)
      .send({ type: 'schedule', config: { intervalMinutes: 60 } });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('schedule');
    expect(res.body.config.nextRunAt).toBeDefined();
    triggerId = res.body.id;
  });

  it('lists the trigger', async () => {
    h.actAs(h.tenantA);
    const res = await request(h.app.getHttpServer())
      .get(`/v1/agents/${agentId}/triggers`)
      .set('x-bitecodes-workspace', h.tenantA.wsId);
    expect(res.status).toBe(200);
    expect(res.body.items.some((t: { id: string }) => t.id === triggerId)).toBe(true);
  });

  it('does not fire a not-yet-due trigger', async () => {
    // nextRunAt is ~60min in the future from creation.
    const enqueued = await runSchedulerTick(Date.now());
    expect(enqueued).not.toContain('__never__'); // sanity
    const { rows } = await h.pool.query(
      `SELECT count(*)::int AS n FROM agent_runs WHERE agent_id=$1 AND trigger_type='schedule'`,
      [agentId],
    );
    expect(rows[0].n).toBe(0);
  });

  it('fires a DUE trigger: enqueues a run and advances nextRunAt', async () => {
    // Force the trigger due by setting nextRunAt to the past (superuser).
    await h.pool.query(
      `UPDATE agent_triggers SET config = jsonb_set(config, '{nextRunAt}', to_jsonb($2::text)) WHERE id=$1`,
      [triggerId, new Date(Date.now() - 60_000).toISOString()],
    );

    const enqueued = await runSchedulerTick(Date.now());
    expect(enqueued.length).toBe(1);

    const { rows } = await h.pool.query(
      `SELECT count(*)::int AS n FROM agent_runs WHERE agent_id=$1 AND trigger_type='schedule'`,
      [agentId],
    );
    expect(rows[0].n).toBe(1);

    const { rows: trig } = await h.pool.query(`SELECT config FROM agent_triggers WHERE id=$1`, [triggerId]);
    expect(Date.parse(trig[0].config.nextRunAt)).toBeGreaterThan(Date.now()); // advanced into the future
  });
});
