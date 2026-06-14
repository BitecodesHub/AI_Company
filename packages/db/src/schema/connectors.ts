import { pgTable, text, boolean, jsonb, index, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { uuid, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { primaryKey, timestamps, tenantColumns } from './helpers';

export const connectorStatusEnum = pgEnum('connector_status', [
  'connected',
  'error',
  'disabled',
]);
export const connectorRiskClassEnum = pgEnum('connector_risk_class', [
  'read',
  'write',
  'destructive',
]);
export const mcpTransportEnum = pgEnum('mcp_transport', ['http', 'stdio']);
export const mcpAuthTypeEnum = pgEnum('mcp_auth_type', ['none', 'oauth', 'api_key']);

// ── connectors ────────────────────────────────────────────────────────────────
export const connectors = pgTable(
  'connectors',
  {
    id: primaryKey(),
    ...tenantColumns(),
    type: text('type').notNull(), // e.g. 'slack', 'gmail', 'x'
    name: text('name').notNull(),
    status: connectorStatusEnum('status').notNull().default('disabled'),
    config: jsonb('config'),
    ...timestamps(),
  },
  (t) => [index('connectors_workspace_idx').on(t.workspaceId)],
);

// ── connector_credentials (secrets sealed with libsodium) ─────────────────────
export const connectorCredentials = pgTable(
  'connector_credentials',
  {
    id: primaryKey(),
    connectorId: uuid('connector_id').notNull(),
    ...tenantColumns(),
    // bytea stored as base64 text (libsodium sealed box)
    encryptedSecret: text('encrypted_secret').notNull(),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index('connector_creds_connector_idx').on(t.connectorId)],
);

// ── mcp_servers ───────────────────────────────────────────────────────────────
export const mcpServers = pgTable(
  'mcp_servers',
  {
    id: primaryKey(),
    ...tenantColumns(),
    name: text('name').notNull(),
    url: text('url').notNull(),
    transport: mcpTransportEnum('transport').notNull().default('http'),
    authType: mcpAuthTypeEnum('auth_type').notNull().default('none'),
    status: connectorStatusEnum('status').notNull().default('disabled'),
    ...timestamps(),
  },
  (t) => [index('mcp_servers_workspace_idx').on(t.workspaceId)],
);

// ── mcp_tools ─────────────────────────────────────────────────────────────────
export const mcpTools = pgTable(
  'mcp_tools',
  {
    id: primaryKey(),
    mcpServerId: uuid('mcp_server_id').notNull(),
    ...tenantColumns(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    inputSchema: jsonb('input_schema'),
    descriptionHash: text('description_hash').notNull(), // for tamper detection
    riskClass: connectorRiskClassEnum('risk_class').notNull().default('read'),
    approvalRequired: boolean('approval_required').notNull().default(false),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index('mcp_tools_server_idx').on(t.mcpServerId)],
);
