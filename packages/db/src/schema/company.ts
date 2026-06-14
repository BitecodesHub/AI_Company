import { pgTable, text, jsonb, integer, index, pgEnum } from 'drizzle-orm/pg-core';
import { uuid, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { primaryKey, timestamps, tenantColumns } from './helpers';

export const messageAuthorTypeEnum = pgEnum('message_author_type', ['user', 'agent', 'system']);
export const agentMessageKindEnum = pgEnum('agent_message_kind', ['message', 'handoff', 'observation', 'log']);

// ── conversations ──────────────────────────────────────────────────────────────
// A thread in the company chat. May be human↔employee or employee↔employee.
export const conversations = pgTable(
  'conversations',
  {
    id: primaryKey(),
    ...tenantColumns(),
    subject: text('subject'),
    status: text('status').notNull().default('open'),
    createdBy: uuid('created_by'),
    ...timestamps(),
  },
  (t) => [
    index('conversations_org_idx').on(t.organizationId),
    index('conversations_workspace_idx').on(t.workspaceId),
  ],
);

// ── conversation_messages ──────────────────────────────────────────────────────
// Human + agent turns in a conversation. (Embeddings for semantic recall are
// added in Phase H once pgvector is enabled — kept out of G to stay shippable.)
export const conversationMessages = pgTable(
  'conversation_messages',
  {
    id: primaryKey(),
    conversationId: uuid('conversation_id').notNull(),
    ...tenantColumns(),
    authorType: messageAuthorTypeEnum('author_type').notNull(),
    authorId: uuid('author_id'),
    body: text('body').notNull(),
    runId: uuid('run_id'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(sql`now()`),
  },
  (t) => [index('conversation_messages_conversation_idx').on(t.conversationId)],
);

// ── agent_messages (the inter-agent bus / activity feed) ─────────────────────────
// kind='handoff' carries a handoff between employees (depth-capped).
export const agentMessages = pgTable(
  'agent_messages',
  {
    id: primaryKey(),
    ...tenantColumns(),
    conversationId: uuid('conversation_id'),
    runId: uuid('run_id'),
    fromAgentId: uuid('from_agent_id'),
    toAgentId: uuid('to_agent_id'),
    kind: agentMessageKindEnum('kind').notNull().default('message'),
    body: text('body'),
    metadata: jsonb('metadata'),
    depth: integer('depth').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(sql`now()`),
  },
  (t) => [
    index('agent_messages_org_idx').on(t.organizationId),
    index('agent_messages_conversation_idx').on(t.conversationId),
    index('agent_messages_run_idx').on(t.runId),
  ],
);
