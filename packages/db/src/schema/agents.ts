import {
  pgTable,
  text,
  boolean,
  jsonb,
  integer,
  numeric,
  index,
  pgEnum,
  check,
} from 'drizzle-orm/pg-core';
import { uuid, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { primaryKey, timestamps, softDelete, tenantColumns } from './helpers';

export const agentModeEnum = pgEnum('agent_mode', ['sandbox', 'production']);
export const costTierEnum = pgEnum('cost_tier', ['fast', 'smart', 'auto']);
export const runStatusEnum = pgEnum('run_status', [
  'queued',
  'running',
  'waiting_approval',
  'paused',
  'succeeded',
  'failed',
  'cancelled',
]);
export const stepTypeEnum = pgEnum('step_type', [
  'llm',
  'tool',
  'approval',
  'handoff',
  'wait',
  'log',
]);
export const approvalStatusEnum = pgEnum('approval_status', ['pending', 'approved', 'rejected']);
export const approvalKindEnum = pgEnum('approval_kind', [
  'tool_call',
  'publish',
  'send',
  'custom',
]);
export const triggerTypeEnum = pgEnum('trigger_type', [
  'manual',
  'schedule',
  'webhook',
  'event',
]);

// Per-employee (agent) operational controls.
export const activationStateEnum = pgEnum('activation_state', ['active', 'paused', 'deactivated']);
// always = gate every tool call; risky = gate only risky/approval-required tools;
// never = no approval gate (owner-only to set).
export const approvalModeEnum = pgEnum('approval_mode', ['always', 'risky', 'never']);

// ── agents ────────────────────────────────────────────────────────────────────
export const agents = pgTable(
  'agents',
  {
    id: primaryKey(),
    ...tenantColumns(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    role: text('role').notNull(),
    goal: text('goal'),
    personality: text('personality'),
    mode: agentModeEnum('mode').notNull().default('sandbox'),
    defaultModel: text('default_model'),
    costTier: costTierEnum('cost_tier').notNull().default('auto'),
    avatar: text('avatar'),
    activeVersionId: uuid('active_version_id'),
    // Orchestration: a router employee classifies and routes requests; keywords
    // drive keyword-based routing; supervisorAgentId is the org-chart parent.
    isRouter: boolean('is_router').notNull().default(false),
    routingKeywords: jsonb('routing_keywords'),
    supervisorAgentId: uuid('supervisor_agent_id'),
    createdBy: uuid('created_by').notNull(),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    index('agents_org_idx').on(t.organizationId),
    index('agents_workspace_idx').on(t.workspaceId),
  ],
);

// ── agent_versions (immutable) ────────────────────────────────────────────────
export const agentVersions = pgTable(
  'agent_versions',
  {
    id: primaryKey(),
    agentId: uuid('agent_id').notNull(),
    ...tenantColumns(),
    versionNumber: integer('version_number').notNull().default(1),
    systemPrompt: text('system_prompt').notNull().default(''),
    config: jsonb('config').notNull().default('{}'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index('agent_versions_agent_idx').on(t.agentId)],
);

// ── agent_triggers ────────────────────────────────────────────────────────────
export const agentTriggers = pgTable(
  'agent_triggers',
  {
    id: primaryKey(),
    agentId: uuid('agent_id').notNull(),
    ...tenantColumns(),
    type: triggerTypeEnum('type').notNull(),
    config: jsonb('config').notNull().default('{}'),
    enabled: boolean('enabled').notNull().default(true),
    ...timestamps(),
  },
  (t) => [index('agent_triggers_agent_idx').on(t.agentId)],
);

// ── agent_runs ────────────────────────────────────────────────────────────────
export const agentRuns = pgTable(
  'agent_runs',
  {
    id: primaryKey(),
    ...tenantColumns(),
    agentId: uuid('agent_id').notNull(),
    agentVersionId: uuid('agent_version_id').notNull(),
    triggerType: triggerTypeEnum('trigger_type').notNull().default('manual'),
    status: runStatusEnum('status').notNull().default('queued'),
    input: jsonb('input'),
    output: jsonb('output'),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'date' }),
    inngestRunId: text('inngest_run_id'),
    failureReason: text('failure_reason'),
    // Orchestration lineage: parent run (handoff), the routing decision that
    // dispatched this run, and the employee that triggered it (agent→agent).
    parentRunId: uuid('parent_run_id'),
    routingDecisionId: uuid('routing_decision_id'),
    triggeredByAgentId: uuid('triggered_by_agent_id'),
    ...timestamps(),
  },
  (t) => [
    index('agent_runs_org_status_idx').on(t.organizationId, t.status, t.createdAt),
    index('agent_runs_agent_idx').on(t.agentId),
    index('agent_runs_workspace_idx').on(t.workspaceId),
  ],
);

// ── run_steps ─────────────────────────────────────────────────────────────────
export const runSteps = pgTable(
  'run_steps',
  {
    id: primaryKey(),
    runId: uuid('run_id'),
    workflowRunId: uuid('workflow_run_id'),
    ...tenantColumns(),
    index: integer('index').notNull(),
    type: stepTypeEnum('type').notNull(),
    name: text('name').notNull(),
    input: jsonb('input'),
    output: jsonb('output'),
    status: text('status').notNull().default('running'),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    model: text('model'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'date' }),
    error: jsonb('error'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('run_steps_run_idx').on(t.runId),
    index('run_steps_workflow_run_idx').on(t.workflowRunId),
    // Enforce exactly one of run_id or workflow_run_id is set
    check(
      'run_steps_xor_run_check',
      sql`(run_id IS NOT NULL) <> (workflow_run_id IS NOT NULL)`,
    ),
  ],
);

// ── approvals ─────────────────────────────────────────────────────────────────
export const approvals = pgTable(
  'approvals',
  {
    id: primaryKey(),
    ...tenantColumns(),
    runId: uuid('run_id').notNull(),
    stepId: uuid('step_id'),
    kind: approvalKindEnum('kind').notNull(),
    payload: jsonb('payload'),
    status: approvalStatusEnum('status').notNull().default('pending'),
    decidedBy: uuid('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true, mode: 'date' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    ...timestamps(),
  },
  (t) => [
    index('approvals_run_idx').on(t.runId),
    index('approvals_workspace_idx').on(t.workspaceId),
  ],
);

// ── employee_controls (1:1 with agents) ───────────────────────────────────────
// Per-employee operational controls: activation, approval gating, plan mode,
// and daily run/cost caps. "Employee" is the product label for an agent.
export const employeeControls = pgTable(
  'employee_controls',
  {
    id: primaryKey(),
    agentId: uuid('agent_id').notNull().unique(),
    ...tenantColumns(),
    activationState: activationStateEnum('activation_state').notNull().default('active'),
    approvalMode: approvalModeEnum('approval_mode').notNull().default('risky'),
    bypassPermission: boolean('bypass_permission').notNull().default(false),
    planMode: boolean('plan_mode').notNull().default(false),
    maxRunsPerDay: integer('max_runs_per_day'),
    dailyCostCapUsd: numeric('daily_cost_cap_usd', { precision: 12, scale: 6 }),
    updatedBy: uuid('updated_by'),
    ...timestamps(),
  },
  (t) => [
    index('employee_controls_agent_idx').on(t.agentId),
    index('employee_controls_org_idx').on(t.organizationId),
  ],
);
