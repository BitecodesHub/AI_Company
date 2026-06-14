"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionStatusSchema = exports.UsageKindSchema = exports.NotificationKindSchema = exports.SeoPageKindSchema = exports.BlogStatusSchema = exports.TemplateStatusSchema = exports.TemplateVisibilitySchema = exports.TemplateKindSchema = exports.WorkflowNodeTypeSchema = exports.McpAuthTypeSchema = exports.McpTransportSchema = exports.ActionTargetSchema = exports.ActionRiskClassSchema = exports.ControllerActionStatusSchema = exports.InboxMessageStatusSchema = exports.InboxMessageKindSchema = exports.DocumentSourceTypeSchema = exports.DocumentStatusSchema = exports.ApprovalKindSchema = exports.ApprovalStatusSchema = exports.CostTierSchema = exports.AgentModeSchema = exports.SocialPlatformSchema = exports.ContentTypeSchema = exports.ContentStatusSchema = exports.ConnectorStatusSchema = exports.ConnectorRiskClassSchema = exports.StepTypeSchema = exports.RunStatusSchema = exports.PlanSchema = exports.RoleSchema = void 0;
/**
 * Canonical enums — single source of truth.
 * Never redefine these in apps or other packages.
 * Canonical list: BUILD_GUIDE §2 (glossary) + ARCHITECTURE §6 (schema).
 */
const zod_1 = require("zod");
// ── Identity & tenancy ────────────────────────────────────────────────────────
exports.RoleSchema = zod_1.z.enum(['owner', 'admin', 'member', 'viewer']);
exports.PlanSchema = zod_1.z.enum(['free', 'pro', 'team', 'enterprise']);
// ── Runs & steps ─────────────────────────────────────────────────────────────
exports.RunStatusSchema = zod_1.z.enum([
    'queued',
    'running',
    'waiting_approval',
    'paused',
    'succeeded',
    'failed',
    'cancelled',
]);
exports.StepTypeSchema = zod_1.z.enum([
    'llm',
    'tool',
    'approval',
    'handoff',
    'wait',
    'log',
]);
// ── Connectors ───────────────────────────────────────────────────────────────
exports.ConnectorRiskClassSchema = zod_1.z.enum(['read', 'write', 'destructive']);
exports.ConnectorStatusSchema = zod_1.z.enum(['connected', 'error', 'disabled']);
// ── Content ───────────────────────────────────────────────────────────────────
exports.ContentStatusSchema = zod_1.z.enum([
    'idea',
    'draft',
    'approval',
    'scheduled',
    'published',
    'failed',
]);
exports.ContentTypeSchema = zod_1.z.enum([
    'post',
    'thread',
    'carousel',
    'reel',
    'blog',
]);
exports.SocialPlatformSchema = zod_1.z.enum([
    'x',
    'linkedin',
    'instagram',
    'facebook',
    'youtube',
    'tiktok',
    'gbp',
    'wordpress',
]);
// ── Agents ────────────────────────────────────────────────────────────────────
exports.AgentModeSchema = zod_1.z.enum(['sandbox', 'production']);
exports.CostTierSchema = zod_1.z.enum(['fast', 'smart', 'auto']);
// ── Approvals ─────────────────────────────────────────────────────────────────
exports.ApprovalStatusSchema = zod_1.z.enum(['pending', 'approved', 'rejected']);
exports.ApprovalKindSchema = zod_1.z.enum([
    'tool_call',
    'publish',
    'send',
    'custom',
]);
// ── Documents ─────────────────────────────────────────────────────────────────
exports.DocumentStatusSchema = zod_1.z.enum([
    'pending',
    'processing',
    'ready',
    'failed',
]);
exports.DocumentSourceTypeSchema = zod_1.z.enum([
    'file',
    'url',
    'crawl',
    'text',
]);
// ── Inbox ─────────────────────────────────────────────────────────────────────
exports.InboxMessageKindSchema = zod_1.z.enum([
    'comment',
    'dm',
    'mention',
    'review',
]);
exports.InboxMessageStatusSchema = zod_1.z.enum([
    'new',
    'drafted',
    'replied',
    'escalated',
    'ignored',
]);
// ── AI Controller ─────────────────────────────────────────────────────────────
exports.ControllerActionStatusSchema = zod_1.z.enum([
    'planned',
    'confirmed',
    'executed',
    'failed',
    'undone',
]);
exports.ActionRiskClassSchema = zod_1.z.enum(['safe', 'confirm', 'destructive']);
exports.ActionTargetSchema = zod_1.z.enum(['browser', 'server', 'both']);
// ── MCP ───────────────────────────────────────────────────────────────────────
exports.McpTransportSchema = zod_1.z.enum(['http', 'stdio']);
exports.McpAuthTypeSchema = zod_1.z.enum(['none', 'oauth', 'api_key']);
// ── Workflow nodes ────────────────────────────────────────────────────────────
exports.WorkflowNodeTypeSchema = zod_1.z.enum([
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
// ── Templates / marketplace ───────────────────────────────────────────────────
exports.TemplateKindSchema = zod_1.z.enum([
    'agent',
    'workflow',
    'brand_voice',
    'prompt',
]);
exports.TemplateVisibilitySchema = zod_1.z.enum([
    'private',
    'unlisted',
    'public',
]);
exports.TemplateStatusSchema = zod_1.z.enum(['draft', 'published', 'removed']);
// ── Blog / SEO ────────────────────────────────────────────────────────────────
exports.BlogStatusSchema = zod_1.z.enum([
    'draft',
    'scheduled',
    'published',
]);
exports.SeoPageKindSchema = zod_1.z.enum([
    'marketing',
    'blog',
    'template',
    'profile',
    'integration',
    'use_case',
]);
// ── Notifications ─────────────────────────────────────────────────────────────
exports.NotificationKindSchema = zod_1.z.enum([
    'approval',
    'run_failed',
    'escalation',
    'publish_failed',
    'system',
]);
// ── Billing ───────────────────────────────────────────────────────────────────
exports.UsageKindSchema = zod_1.z.enum([
    'llm_tokens',
    'task_credit',
    'storage',
]);
exports.SubscriptionStatusSchema = zod_1.z.enum([
    'active',
    'past_due',
    'cancelled',
    'trialing',
]);
//# sourceMappingURL=enums.js.map