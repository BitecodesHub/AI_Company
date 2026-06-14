import { pgTable, text, integer, jsonb, numeric, index, pgEnum } from 'drizzle-orm/pg-core';
import { uuid, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { primaryKey, timestamps, tenantColumns } from './helpers';

export const workflowStatusEnum = pgEnum('workflow_status', ['draft', 'active']);

// ── workflows ─────────────────────────────────────────────────────────────────
export const workflows = pgTable(
  'workflows',
  {
    id: primaryKey(),
    ...tenantColumns(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    status: workflowStatusEnum('status').notNull().default('draft'),
    graph: jsonb('graph').notNull().default('{"nodes":[],"edges":[]}'),
    activeVersionId: uuid('active_version_id'),
    ...timestamps(),
  },
  (t) => [index('workflows_workspace_idx').on(t.workspaceId)],
);

// ── workflow_versions ─────────────────────────────────────────────────────────
export const workflowVersions = pgTable(
  'workflow_versions',
  {
    id: primaryKey(),
    workflowId: uuid('workflow_id').notNull(),
    ...tenantColumns(),
    versionNumber: integer('version_number').notNull().default(1),
    graph: jsonb('graph').notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index('workflow_versions_workflow_idx').on(t.workflowId)],
);

// ── workflow_runs ─────────────────────────────────────────────────────────────
export const workflowRuns = pgTable(
  'workflow_runs',
  {
    id: primaryKey(),
    ...tenantColumns(),
    workflowId: uuid('workflow_id').notNull(),
    status: text('status').notNull().default('queued'),
    input: jsonb('input'),
    output: jsonb('output'),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'date' }),
    inngestRunId: text('inngest_run_id'),
    ...timestamps(),
  },
  (t) => [index('workflow_runs_workflow_idx').on(t.workflowId)],
);
