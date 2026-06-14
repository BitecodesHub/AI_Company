import { pgTable, text, boolean, jsonb, integer, numeric, index, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { uuid, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { primaryKey, timestamps, tenantColumns } from './helpers';

export const notificationKindEnum = pgEnum('notification_kind', [
  'approval',
  'run_failed',
  'escalation',
  'publish_failed',
  'system',
]);
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'past_due',
  'cancelled',
  'trialing',
]);
export const usageKindEnum = pgEnum('usage_kind', ['llm_tokens', 'task_credit', 'storage']);
export const templateKindEnum = pgEnum('template_kind', [
  'agent',
  'workflow',
  'brand_voice',
  'prompt',
]);
export const templateVisibilityEnum = pgEnum('template_visibility', [
  'private',
  'unlisted',
  'public',
]);
export const templateStatusEnum = pgEnum('template_status', ['draft', 'published', 'removed']);
export const blogStatusEnum = pgEnum('blog_status', ['draft', 'scheduled', 'published']);
export const seoPageKindEnum = pgEnum('seo_page_kind', [
  'marketing',
  'blog',
  'template',
  'profile',
  'integration',
  'use_case',
]);
export const controllerActionStatusEnum = pgEnum('controller_action_status', [
  'planned',
  'confirmed',
  'executed',
  'failed',
  'undone',
]);

// ── audit_logs (append-only) ──────────────────────────────────────────────────
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: primaryKey(),
    ...tenantColumns(),
    actorType: text('actor_type').notNull(), // 'user' | 'agent' | 'system'
    actorId: uuid('actor_id'),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: uuid('target_id'),
    metadata: jsonb('metadata'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index('audit_logs_org_idx').on(t.organizationId, t.createdAt)],
);

// ── settings ──────────────────────────────────────────────────────────────────
export const settings = pgTable(
  'settings',
  {
    id: primaryKey(),
    organizationId: uuid('organization_id'),
    workspaceId: uuid('workspace_id'),
    key: text('key').notNull(),
    value: jsonb('value'),
    updatedBy: uuid('updated_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index('settings_org_key_idx').on(t.organizationId, t.key)],
);

// ── webhook_events (idempotency) ──────────────────────────────────────────────
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: primaryKey(),
    source: text('source').notNull(),
    externalId: text('external_id').notNull(),
    payload: jsonb('payload'),
    processed: boolean('processed').notNull().default(false),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex('webhook_events_source_external_idx').on(t.source, t.externalId)],
);

// ── notifications ─────────────────────────────────────────────────────────────
export const notifications = pgTable(
  'notifications',
  {
    id: primaryKey(),
    ...tenantColumns(),
    userId: uuid('user_id'),
    kind: notificationKindEnum('kind').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    link: text('link'),
    channels: jsonb('channels'),
    readAt: timestamp('read_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index('notifications_workspace_idx').on(t.workspaceId)],
);

// ── feature_flags ─────────────────────────────────────────────────────────────
export const featureFlags = pgTable('feature_flags', {
  id: primaryKey(),
  organizationId: uuid('organization_id'),
  key: text('key').notNull(),
  enabled: boolean('enabled').notNull().default(false),
  rollout: jsonb('rollout'),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .default(sql`now()`),
});

// ── subscriptions ─────────────────────────────────────────────────────────────
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    plan: text('plan').notNull().default('free'),
    seats: integer('seats').notNull().default(1),
    status: subscriptionStatusEnum('status').notNull().default('active'),
    lagoSubscriptionId: text('lago_subscription_id'),
    stripeCustomerId: text('stripe_customer_id'),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true, mode: 'date' }),
    ...timestamps(),
  },
  (t) => [index('subscriptions_org_idx').on(t.organizationId)],
);

// ── usage_records ─────────────────────────────────────────────────────────────
export const usageRecords = pgTable(
  'usage_records',
  {
    id: primaryKey(),
    ...tenantColumns(),
    kind: usageKindEnum('kind').notNull(),
    quantity: integer('quantity').notNull(),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }),
    model: text('model'),
    runId: uuid('run_id'),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index('usage_records_org_idx').on(t.organizationId, t.recordedAt)],
);

// ── credit_wallets ────────────────────────────────────────────────────────────
export const creditWallets = pgTable('credit_wallets', {
  id: primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  balanceCredits: integer('balance_credits').notNull().default(0),
  monthlyGrant: integer('monthly_grant').notNull().default(0),
  resetsAt: timestamp('resets_at', { withTimezone: true, mode: 'date' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .default(sql`now()`),
});

// ── templates (marketplace) ───────────────────────────────────────────────────
export const templates = pgTable(
  'templates',
  {
    id: primaryKey(),
    kind: templateKindEnum('kind').notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    payload: jsonb('payload').notNull().default('{}'),
    authorOrgId: uuid('author_org_id'),
    authorUserId: uuid('author_user_id'),
    visibility: templateVisibilityEnum('visibility').notNull().default('private'),
    priceCents: integer('price_cents').notNull().default(0),
    installCount: integer('install_count').notNull().default(0),
    ratingAvg: numeric('rating_avg', { precision: 3, scale: 2 }),
    status: templateStatusEnum('status').notNull().default('draft'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('templates_slug_idx').on(t.slug),
    index('templates_visibility_idx').on(t.visibility, t.status),
  ],
);

// ── blog_posts ────────────────────────────────────────────────────────────────
export const blogPosts = pgTable(
  'blog_posts',
  {
    id: primaryKey(),
    ...tenantColumns(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    bodyMd: text('body_md'),
    excerpt: text('excerpt'),
    coverImage: text('cover_image'),
    status: blogStatusEnum('status').notNull().default('draft'),
    authorUserId: uuid('author_user_id'),
    generatedByAgentId: uuid('generated_by_agent_id'),
    seo: jsonb('seo'),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
    ...timestamps(),
  },
  (t) => [index('blog_posts_workspace_idx').on(t.workspaceId)],
);

// ── seo_pages ─────────────────────────────────────────────────────────────────
export const seoPages = pgTable(
  'seo_pages',
  {
    id: primaryKey(),
    organizationId: uuid('organization_id'),
    path: text('path').notNull(),
    kind: seoPageKindEnum('kind').notNull(),
    title: text('title'),
    metaDescription: text('meta_description'),
    ogImage: text('og_image'),
    jsonLd: jsonb('json_ld'),
    canonical: text('canonical'),
    noindex: boolean('noindex').notNull().default(false),
    lastGeneratedAt: timestamp('last_generated_at', { withTimezone: true, mode: 'date' }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('seo_pages_path_idx').on(t.path)],
);

// ── controller_sessions ───────────────────────────────────────────────────────
export const controllerSessions = pgTable(
  'controller_sessions',
  {
    id: primaryKey(),
    ...tenantColumns(),
    userId: uuid('user_id').notNull(),
    status: text('status').notNull().default('active'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`),
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [index('controller_sessions_workspace_idx').on(t.workspaceId)],
);

// ── controller_actions ────────────────────────────────────────────────────────
export const controllerActions = pgTable(
  'controller_actions',
  {
    id: primaryKey(),
    sessionId: uuid('session_id').notNull(),
    ...tenantColumns(),
    userId: uuid('user_id').notNull(),
    actionName: text('action_name').notNull(),
    args: jsonb('args'),
    result: jsonb('result'),
    status: controllerActionStatusEnum('status').notNull().default('planned'),
    requiredConfirmation: boolean('required_confirmation').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index('controller_actions_session_idx').on(t.sessionId)],
);

// ── template_ratings ─────────────────────────────────────────────────────────
export const templateRatings = pgTable(
  'template_ratings',
  {
    id: primaryKey(),
    templateId: uuid('template_id').notNull(),
    organizationId: uuid('organization_id').notNull(),
    userId: uuid('user_id').notNull(),
    stars: integer('stars').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('template_ratings_template_idx').on(t.templateId),
    uniqueIndex('template_ratings_org_user_template_idx').on(t.templateId, t.organizationId, t.userId),
  ],
);
