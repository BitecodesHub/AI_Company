/**
 * scheduler/tick — a single internal cron function (runs every minute) that
 * fires due schedule triggers. Per B4 / BUILD_GUIDE §6 there is NO
 * `employee/scheduled-tick` event: this cron handler scans `agent_triggers` of
 * type `schedule`, enforces per-employee daily run/cost caps and the activation
 * state, then emits `agent/run` and advances each trigger's `nextRunAt`.
 *
 * Schedule config shape: `{ intervalMinutes: number, nextRunAt: ISO, input? }`.
 * (Interval schedules avoid pulling in a cron-expression parser dependency.)
 */
import { inngest } from './client.js';
import { eq, and, gte, sql } from 'drizzle-orm';
import { agentTriggers, agents, agentRuns, employeeControls } from '@bitecodes/db';
import { systemDb, withTenant } from './runtime-db.js';

interface ScheduleConfig {
  intervalMinutes?: number;
  nextRunAt?: string;
  input?: unknown;
}

/** Core, exported for testing. Returns the run ids it enqueued. */
export async function runSchedulerTick(nowMs: number): Promise<string[]> {
  const db = systemDb();
  const enqueued: string[] = [];

  const due = await db
    .select({
      id: agentTriggers.id,
      agentId: agentTriggers.agentId,
      organizationId: agentTriggers.organizationId,
      workspaceId: agentTriggers.workspaceId,
      config: agentTriggers.config,
    })
    .from(agentTriggers)
    .where(and(eq(agentTriggers.type, 'schedule'), eq(agentTriggers.enabled, true)));

  for (const trigger of due) {
    const cfg = (trigger.config ?? {}) as ScheduleConfig;
    const interval = Number(cfg.intervalMinutes ?? 0);
    if (interval <= 0) continue;
    const nextRunAtMs = cfg.nextRunAt ? Date.parse(cfg.nextRunAt) : 0;
    if (nextRunAtMs > nowMs) continue; // not due yet

    const orgId = trigger.organizationId;
    const wsId = trigger.workspaceId ?? undefined;

    const fired = await withTenant(orgId, wsId, async (tx) => {
      // Resolve the agent + its active version and controls.
      const [agent] = await tx
        .select({ activeVersionId: agents.activeVersionId })
        .from(agents)
        .where(eq(agents.id, trigger.agentId))
        .limit(1);
      if (!agent?.activeVersionId) return null;

      const [ctrl] = await tx
        .select({
          activationState: employeeControls.activationState,
          maxRunsPerDay: employeeControls.maxRunsPerDay,
          dailyCostCapUsd: employeeControls.dailyCostCapUsd,
        })
        .from(employeeControls)
        .where(eq(employeeControls.agentId, trigger.agentId))
        .limit(1);

      // Skip paused/deactivated employees entirely.
      if (ctrl && ctrl.activationState !== 'active') return null;

      // Daily caps: count today's runs + cost for this agent.
      const dayStart = new Date(nowMs);
      dayStart.setUTCHours(0, 0, 0, 0);
      const [usage] = await tx
        .select({
          runs: sql<number>`count(*)::int`,
          cost: sql<string>`coalesce(sum(${agentRuns.costUsd}), 0)`,
        })
        .from(agentRuns)
        .where(and(eq(agentRuns.agentId, trigger.agentId), gte(agentRuns.createdAt, dayStart)));

      if (ctrl?.maxRunsPerDay != null && (usage?.runs ?? 0) >= ctrl.maxRunsPerDay) return null;
      if (ctrl?.dailyCostCapUsd != null && Number(usage?.cost ?? 0) >= Number(ctrl.dailyCostCapUsd)) return null;

      // Create the queued run row.
      const [run] = await tx
        .insert(agentRuns)
        .values({
          organizationId: orgId,
          workspaceId: wsId ?? null,
          agentId: trigger.agentId,
          agentVersionId: agent.activeVersionId,
          triggerType: 'schedule',
          status: 'queued',
          input: (cfg.input ?? null) as object | null,
        })
        .returning({ id: agentRuns.id });

      // Advance nextRunAt by the interval (catch up past missed ticks).
      let next = nextRunAtMs || nowMs;
      while (next <= nowMs) next += interval * 60 * 1000;
      await tx
        .update(agentTriggers)
        .set({ config: { ...cfg, nextRunAt: new Date(next).toISOString() }, updatedAt: new Date() })
        .where(eq(agentTriggers.id, trigger.id));

      return run!.id;
    });

    if (fired) {
      // Best-effort emit: the queued run row is durably persisted, so a failed
      // emit (e.g. Inngest unreachable) is logged, not fatal to the whole tick.
      try {
        await inngest.send({ name: 'agent/run', data: { runId: fired, organizationId: orgId, workspaceId: wsId } });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[scheduler/tick] agent/run emit failed for run ${fired}: ${err instanceof Error ? err.message : String(err)}`);
      }
      enqueued.push(fired);
    }
  }

  return enqueued;
}

export const schedulerTickFunction = inngest.createFunction(
  { id: 'scheduler/tick', name: 'Fire due schedule triggers' },
  { cron: '* * * * *' },
  async () => {
    const enqueued = await runSchedulerTick(Date.now());
    return { enqueued: enqueued.length };
  },
);
