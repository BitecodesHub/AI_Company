import { pgTable, text, jsonb, numeric, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { uuid } from 'drizzle-orm/pg-core';
import { primaryKey, timestamps, tenantColumns } from './helpers';

export const relationshipKindEnum = pgEnum('relationship_kind', ['supervises', 'watches', 'delegates_to']);
export const routingStatusEnum = pgEnum('routing_status', [
  'proposed',
  'auto_dispatched',
  'confirmed',
  'diverted',
  'rejected',
]);

// ── agent_relationships ───────────────────────────────────────────────────────
// Directed edges between employees: A supervises/watches/delegates_to B.
export const agentRelationships = pgTable(
  'agent_relationships',
  {
    id: primaryKey(),
    ...tenantColumns(),
    fromAgentId: uuid('from_agent_id').notNull(),
    toAgentId: uuid('to_agent_id').notNull(),
    kind: relationshipKindEnum('kind').notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('agent_relationships_uniq').on(t.fromAgentId, t.toAgentId, t.kind),
    index('agent_relationships_from_idx').on(t.fromAgentId),
    index('agent_relationships_to_idx').on(t.toAgentId),
    index('agent_relationships_org_idx').on(t.organizationId),
  ],
);

// ── routing_decisions ─────────────────────────────────────────────────────────
// A classification of an inbound request to the best-fit employee. Default is to
// PROPOSE (await human confirm/divert); high confidence auto-dispatches.
export const routingDecisions = pgTable(
  'routing_decisions',
  {
    id: primaryKey(),
    ...tenantColumns(),
    requestText: text('request_text').notNull(),
    proposedAgentId: uuid('proposed_agent_id'),
    chosenAgentId: uuid('chosen_agent_id'),
    confidence: numeric('confidence', { precision: 4, scale: 3 }),
    status: routingStatusEnum('status').notNull().default('proposed'),
    reasoning: text('reasoning'),
    runId: uuid('run_id'),
    createdBy: uuid('created_by'),
    ...timestamps(),
  },
  (t) => [
    index('routing_decisions_org_status_idx').on(t.organizationId, t.status),
    index('routing_decisions_workspace_idx').on(t.workspaceId),
  ],
);
