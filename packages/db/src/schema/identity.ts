import {
  pgTable,
  text,
  boolean,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { primaryKey, timestamps, softDelete } from './helpers';
import { uuid, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ── Role enum ─────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum('role', ['owner', 'admin', 'member', 'viewer']);

// ── Plan enum ─────────────────────────────────────────────────────────────────
export const planEnum = pgEnum('plan', ['free', 'pro', 'team', 'enterprise']);

// ── organizations ─────────────────────────────────────────────────────────────
export const organizations = pgTable('organizations', {
  id: primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  plan: planEnum('plan').notNull().default('free'),
  branding: jsonb('branding'),
  settings: jsonb('settings'),
  ssoEnabled: boolean('sso_enabled').notNull().default(false),
  ...timestamps(),
  ...softDelete(),
});

// ── workspaces ────────────────────────────────────────────────────────────────
export const workspaces = pgTable(
  'workspaces',
  {
    id: primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    settings: jsonb('settings'),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    index('workspaces_org_idx').on(t.organizationId),
    uniqueIndex('workspaces_org_slug_idx').on(t.organizationId, t.slug),
  ],
);

// ── users ─────────────────────────────────────────────────────────────────────
// Better Auth manages the session, accounts, and verifications tables.
// We own only the profile row.
export const users = pgTable(
  'users',
  {
    id: primaryKey(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    locale: text('locale').notNull().default('en'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
);

// ── Better Auth tables (must match Better Auth's expected shape) ───────────────
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    token: text('token').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('sessions_token_idx').on(t.token)],
);

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
      mode: 'date',
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
      mode: 'date',
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (t) => [index('accounts_user_idx').on(t.userId)],
);

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }),
});

// ── memberships ───────────────────────────────────────────────────────────────
export const memberships = pgTable(
  'memberships',
  {
    id: primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, {
      onDelete: 'cascade',
    }),
    role: roleEnum('role').notNull().default('member'),
    // Soft-delete: a deactivated member keeps history but loses access.
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true, mode: 'date' }),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('memberships_user_idx').on(t.userId),
    index('memberships_org_idx').on(t.organizationId),
    index('memberships_workspace_idx').on(t.workspaceId),
  ],
);

// ── invitations ───────────────────────────────────────────────────────────────
export const invitations = pgTable(
  'invitations',
  {
    id: primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, {
      onDelete: 'cascade',
    }),
    email: text('email').notNull(),
    role: roleEnum('role').notNull().default('member'),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('invitations_token_idx').on(t.token),
    index('invitations_org_idx').on(t.organizationId),
  ],
);

// ── idempotency_keys (P1-17) ──────────────────────────────────────────────────
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    key: text('key').notNull(),
    method: text('method').notNull(),
    path: text('path').notNull(),
    response: jsonb('response'),
    statusCode: text('status_code'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex('idempotency_keys_org_key_idx').on(t.organizationId, t.key)],
);

// ── oauth_states ──────────────────────────────────────────────────────────────
export const oauthStates = pgTable(
  'oauth_states',
  {
    id: primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    workspaceId: uuid('workspace_id'),
    connectorType: text('connector_type').notNull(),
    state: text('state').notNull(),
    codeVerifier: text('code_verifier'),
    redirectUri: text('redirect_uri').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex('oauth_states_state_idx').on(t.state)],
);

// ── api_keys ──────────────────────────────────────────────────────────────────
export const apiKeys = pgTable(
  'api_keys',
  {
    id: primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    workspaceId: uuid('workspace_id'),
    name: text('name').notNull(),
    hashedKey: text('hashed_key').notNull(),
    scopes: jsonb('scopes'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' }),
    ...timestamps(),
  },
  (t) => [
    index('api_keys_org_idx').on(t.organizationId),
    uniqueIndex('api_keys_hashed_idx').on(t.hashedKey),
  ],
);
