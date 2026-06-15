import { pgTable, text, boolean, jsonb, integer, index, pgEnum } from 'drizzle-orm/pg-core';
import { uuid, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { primaryKey, timestamps, tenantColumns } from './helpers';

export const socialPlatformEnum = pgEnum('social_platform', [
  'x',
  'linkedin',
  'instagram',
  'facebook',
  'youtube',
  'tiktok',
  'gbp',
  'wordpress',
  'teams',
]);
export const contentStatusEnum = pgEnum('content_status', [
  'idea',
  'draft',
  'approval',
  'scheduled',
  'published',
  'failed',
]);
export const contentTypeEnum = pgEnum('content_type', [
  'post',
  'thread',
  'carousel',
  'reel',
  'blog',
]);
export const inboxMessageKindEnum = pgEnum('inbox_message_kind', [
  'comment',
  'dm',
  'mention',
  'review',
]);
export const inboxMessageStatusEnum = pgEnum('inbox_message_status', [
  'new',
  'drafted',
  'replied',
  'escalated',
  'ignored',
]);

// ── social_accounts ───────────────────────────────────────────────────────────
export const socialAccounts = pgTable(
  'social_accounts',
  {
    id: primaryKey(),
    ...tenantColumns(),
    platform: socialPlatformEnum('platform').notNull(),
    handle: text('handle').notNull(),
    connectorId: uuid('connector_id').notNull(),
    status: text('status').notNull().default('active'),
    ...timestamps(),
  },
  (t) => [index('social_accounts_workspace_idx').on(t.workspaceId)],
);

// ── brand_voices ──────────────────────────────────────────────────────────────
export const brandVoices = pgTable(
  'brand_voices',
  {
    id: primaryKey(),
    ...tenantColumns(),
    name: text('name').notNull(),
    description: text('description'),
    derivedPrompt: text('derived_prompt'),
    samplePosts: jsonb('sample_posts'),
    tone: jsonb('tone'),
    ...timestamps(),
  },
  (t) => [index('brand_voices_workspace_idx').on(t.workspaceId)],
);

// ── content_items ─────────────────────────────────────────────────────────────
export const contentItems = pgTable(
  'content_items',
  {
    id: primaryKey(),
    ...tenantColumns(),
    type: contentTypeEnum('type').notNull().default('post'),
    title: text('title'),
    body: text('body'),
    status: contentStatusEnum('status').notNull().default('idea'),
    brandVoiceId: uuid('brand_voice_id'),
    createdByAgentId: uuid('created_by_agent_id'),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true, mode: 'date' }),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
    ...timestamps(),
  },
  (t) => [
    index('content_items_workspace_scheduled_idx').on(t.workspaceId, t.scheduledFor),
    index('content_items_status_idx').on(t.status),
  ],
);

// ── content_variants ──────────────────────────────────────────────────────────
export const contentVariants = pgTable(
  'content_variants',
  {
    id: primaryKey(),
    contentItemId: uuid('content_item_id').notNull(),
    ...tenantColumns(),
    platform: socialPlatformEnum('platform').notNull(),
    body: text('body').notNull(),
    media: jsonb('media'),
    hashtags: jsonb('hashtags'),
    charCount: integer('char_count'),
    status: contentStatusEnum('status').notNull().default('draft'),
    externalPostId: text('external_post_id'),
    ...timestamps(),
  },
  (t) => [index('content_variants_item_idx').on(t.contentItemId)],
);

// ── inbox_messages ────────────────────────────────────────────────────────────
export const inboxMessages = pgTable(
  'inbox_messages',
  {
    id: primaryKey(),
    ...tenantColumns(),
    socialAccountId: uuid('social_account_id').notNull(),
    platform: socialPlatformEnum('platform').notNull(),
    kind: inboxMessageKindEnum('kind').notNull(),
    externalId: text('external_id').notNull(),
    author: text('author'),
    text: text('text'),
    sentiment: jsonb('sentiment'),
    isLead: boolean('is_lead').notNull().default(false),
    status: inboxMessageStatusEnum('status').notNull().default('new'),
    draftReply: text('draft_reply'),
    repliedAt: timestamp('replied_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('inbox_messages_workspace_status_idx').on(t.workspaceId, t.status),
    index('inbox_messages_account_idx').on(t.socialAccountId),
  ],
);
