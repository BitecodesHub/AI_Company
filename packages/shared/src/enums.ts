/**
 * Canonical enums — single source of truth.
 * Never redefine these in apps or other packages.
 * Canonical list: BUILD_GUIDE §2 (glossary) + ARCHITECTURE §6 (schema).
 */
import { z } from 'zod';

// ── Identity & tenancy ────────────────────────────────────────────────────────

export const RoleSchema = z.enum(['owner', 'admin', 'member', 'viewer']);
export type Role = z.infer<typeof RoleSchema>;

export const PlanSchema = z.enum(['free', 'pro', 'team', 'enterprise']);
export type Plan = z.infer<typeof PlanSchema>;

// ── Runs & steps ─────────────────────────────────────────────────────────────

export const RunStatusSchema = z.enum([
  'queued',
  'running',
  'waiting_approval',
  'paused',
  'succeeded',
  'failed',
  'cancelled',
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const StepTypeSchema = z.enum([
  'llm',
  'tool',
  'approval',
  'handoff',
  'wait',
  'log',
]);
export type StepType = z.infer<typeof StepTypeSchema>;

// ── Connectors ───────────────────────────────────────────────────────────────

export const ConnectorRiskClassSchema = z.enum(['read', 'write', 'destructive']);
export type ConnectorRiskClass = z.infer<typeof ConnectorRiskClassSchema>;

export const ConnectorStatusSchema = z.enum(['connected', 'error', 'disabled']);
export type ConnectorStatus = z.infer<typeof ConnectorStatusSchema>;

// ── Content ───────────────────────────────────────────────────────────────────

export const ContentStatusSchema = z.enum([
  'idea',
  'draft',
  'approval',
  'scheduled',
  'published',
  'failed',
]);
export type ContentStatus = z.infer<typeof ContentStatusSchema>;

export const ContentTypeSchema = z.enum([
  'post',
  'thread',
  'carousel',
  'reel',
  'blog',
]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

export const SocialPlatformSchema = z.enum([
  'x',
  'linkedin',
  'instagram',
  'facebook',
  'youtube',
  'tiktok',
  'gbp',
  'wordpress',
]);
export type SocialPlatform = z.infer<typeof SocialPlatformSchema>;

// ── Agents ────────────────────────────────────────────────────────────────────

export const AgentModeSchema = z.enum(['sandbox', 'production']);
export type AgentMode = z.infer<typeof AgentModeSchema>;

export const CostTierSchema = z.enum(['fast', 'smart', 'auto']);
export type CostTier = z.infer<typeof CostTierSchema>;

// ── Approvals ─────────────────────────────────────────────────────────────────

export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalKindSchema = z.enum([
  'tool_call',
  'publish',
  'send',
  'custom',
]);
export type ApprovalKind = z.infer<typeof ApprovalKindSchema>;

// ── Documents ─────────────────────────────────────────────────────────────────

export const DocumentStatusSchema = z.enum([
  'pending',
  'processing',
  'ready',
  'failed',
]);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const DocumentSourceTypeSchema = z.enum([
  'file',
  'url',
  'crawl',
  'text',
]);
export type DocumentSourceType = z.infer<typeof DocumentSourceTypeSchema>;

// ── Inbox ─────────────────────────────────────────────────────────────────────

export const InboxMessageKindSchema = z.enum([
  'comment',
  'dm',
  'mention',
  'review',
]);
export type InboxMessageKind = z.infer<typeof InboxMessageKindSchema>;

export const InboxMessageStatusSchema = z.enum([
  'new',
  'drafted',
  'replied',
  'escalated',
  'ignored',
]);
export type InboxMessageStatus = z.infer<typeof InboxMessageStatusSchema>;

// ── AI Controller ─────────────────────────────────────────────────────────────

export const ControllerActionStatusSchema = z.enum([
  'planned',
  'confirmed',
  'executed',
  'failed',
  'undone',
]);
export type ControllerActionStatus = z.infer<typeof ControllerActionStatusSchema>;

export const ActionRiskClassSchema = z.enum(['safe', 'confirm', 'destructive']);
export type ActionRiskClass = z.infer<typeof ActionRiskClassSchema>;

export const ActionTargetSchema = z.enum(['browser', 'server', 'both']);
export type ActionTarget = z.infer<typeof ActionTargetSchema>;

// ── MCP ───────────────────────────────────────────────────────────────────────

export const McpTransportSchema = z.enum(['http', 'stdio']);
export type McpTransport = z.infer<typeof McpTransportSchema>;

export const McpAuthTypeSchema = z.enum(['none', 'oauth', 'api_key']);
export type McpAuthType = z.infer<typeof McpAuthTypeSchema>;

// ── Workflow nodes ────────────────────────────────────────────────────────────

export const WorkflowNodeTypeSchema = z.enum([
  'trigger',
  'agent',
  'connectorAction',
  'condition',
  'approval',
  'delay',
  'loop',
  'branch',
  'errorHandler',
  'escalation',
  'transform',
  'httpRequest',
]);
export type WorkflowNodeType = z.infer<typeof WorkflowNodeTypeSchema>;

// ── Templates / marketplace ───────────────────────────────────────────────────

export const TemplateKindSchema = z.enum([
  'agent',
  'workflow',
  'brand_voice',
  'prompt',
]);
export type TemplateKind = z.infer<typeof TemplateKindSchema>;

export const TemplateVisibilitySchema = z.enum([
  'private',
  'unlisted',
  'public',
]);
export type TemplateVisibility = z.infer<typeof TemplateVisibilitySchema>;

export const TemplateStatusSchema = z.enum(['draft', 'published', 'removed']);
export type TemplateStatus = z.infer<typeof TemplateStatusSchema>;

// ── Blog / SEO ────────────────────────────────────────────────────────────────

export const BlogStatusSchema = z.enum([
  'draft',
  'scheduled',
  'published',
]);
export type BlogStatus = z.infer<typeof BlogStatusSchema>;

export const SeoPageKindSchema = z.enum([
  'marketing',
  'blog',
  'template',
  'profile',
  'integration',
  'use_case',
]);
export type SeoPageKind = z.infer<typeof SeoPageKindSchema>;

// ── Notifications ─────────────────────────────────────────────────────────────

export const NotificationKindSchema = z.enum([
  'approval',
  'run_failed',
  'escalation',
  'publish_failed',
  'system',
]);
export type NotificationKind = z.infer<typeof NotificationKindSchema>;

// ── Billing ───────────────────────────────────────────────────────────────────

export const UsageKindSchema = z.enum([
  'llm_tokens',
  'task_credit',
  'storage',
]);
export type UsageKind = z.infer<typeof UsageKindSchema>;

export const SubscriptionStatusSchema = z.enum([
  'active',
  'past_due',
  'cancelled',
  'trialing',
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;
