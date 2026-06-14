/**
 * Canonical enums — single source of truth.
 * Never redefine these in apps or other packages.
 * Canonical list: BUILD_GUIDE §2 (glossary) + ARCHITECTURE §6 (schema).
 */
import { z } from 'zod';
export declare const RoleSchema: z.ZodEnum<["owner", "admin", "member", "viewer"]>;
export type Role = z.infer<typeof RoleSchema>;
export declare const PlanSchema: z.ZodEnum<["free", "pro", "team", "enterprise"]>;
export type Plan = z.infer<typeof PlanSchema>;
export declare const RunStatusSchema: z.ZodEnum<["queued", "running", "waiting_approval", "paused", "succeeded", "failed", "cancelled"]>;
export type RunStatus = z.infer<typeof RunStatusSchema>;
export declare const StepTypeSchema: z.ZodEnum<["llm", "tool", "approval", "handoff", "wait", "log"]>;
export type StepType = z.infer<typeof StepTypeSchema>;
export declare const ConnectorRiskClassSchema: z.ZodEnum<["read", "write", "destructive"]>;
export type ConnectorRiskClass = z.infer<typeof ConnectorRiskClassSchema>;
export declare const ConnectorStatusSchema: z.ZodEnum<["connected", "error", "disabled"]>;
export type ConnectorStatus = z.infer<typeof ConnectorStatusSchema>;
export declare const ContentStatusSchema: z.ZodEnum<["idea", "draft", "approval", "scheduled", "published", "failed"]>;
export type ContentStatus = z.infer<typeof ContentStatusSchema>;
export declare const ContentTypeSchema: z.ZodEnum<["post", "thread", "carousel", "reel", "blog"]>;
export type ContentType = z.infer<typeof ContentTypeSchema>;
export declare const SocialPlatformSchema: z.ZodEnum<["x", "linkedin", "instagram", "facebook", "youtube", "tiktok", "gbp", "wordpress"]>;
export type SocialPlatform = z.infer<typeof SocialPlatformSchema>;
export declare const AgentModeSchema: z.ZodEnum<["sandbox", "production"]>;
export type AgentMode = z.infer<typeof AgentModeSchema>;
export declare const CostTierSchema: z.ZodEnum<["fast", "smart", "auto"]>;
export type CostTier = z.infer<typeof CostTierSchema>;
export declare const ApprovalStatusSchema: z.ZodEnum<["pending", "approved", "rejected"]>;
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;
export declare const ApprovalKindSchema: z.ZodEnum<["tool_call", "publish", "send", "custom"]>;
export type ApprovalKind = z.infer<typeof ApprovalKindSchema>;
export declare const DocumentStatusSchema: z.ZodEnum<["pending", "processing", "ready", "failed"]>;
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;
export declare const DocumentSourceTypeSchema: z.ZodEnum<["file", "url", "crawl", "text"]>;
export type DocumentSourceType = z.infer<typeof DocumentSourceTypeSchema>;
export declare const InboxMessageKindSchema: z.ZodEnum<["comment", "dm", "mention", "review"]>;
export type InboxMessageKind = z.infer<typeof InboxMessageKindSchema>;
export declare const InboxMessageStatusSchema: z.ZodEnum<["new", "drafted", "replied", "escalated", "ignored"]>;
export type InboxMessageStatus = z.infer<typeof InboxMessageStatusSchema>;
export declare const ControllerActionStatusSchema: z.ZodEnum<["planned", "confirmed", "executed", "failed", "undone"]>;
export type ControllerActionStatus = z.infer<typeof ControllerActionStatusSchema>;
export declare const ActionRiskClassSchema: z.ZodEnum<["safe", "confirm", "destructive"]>;
export type ActionRiskClass = z.infer<typeof ActionRiskClassSchema>;
export declare const ActionTargetSchema: z.ZodEnum<["browser", "server", "both"]>;
export type ActionTarget = z.infer<typeof ActionTargetSchema>;
export declare const McpTransportSchema: z.ZodEnum<["http", "stdio"]>;
export type McpTransport = z.infer<typeof McpTransportSchema>;
export declare const McpAuthTypeSchema: z.ZodEnum<["none", "oauth", "api_key"]>;
export type McpAuthType = z.infer<typeof McpAuthTypeSchema>;
export declare const WorkflowNodeTypeSchema: z.ZodEnum<["trigger", "agent", "connectorAction", "condition", "approval", "delay", "loop", "branch", "errorHandler", "escalation", "transform", "httpRequest"]>;
export type WorkflowNodeType = z.infer<typeof WorkflowNodeTypeSchema>;
export declare const TemplateKindSchema: z.ZodEnum<["agent", "workflow", "brand_voice", "prompt"]>;
export type TemplateKind = z.infer<typeof TemplateKindSchema>;
export declare const TemplateVisibilitySchema: z.ZodEnum<["private", "unlisted", "public"]>;
export type TemplateVisibility = z.infer<typeof TemplateVisibilitySchema>;
export declare const TemplateStatusSchema: z.ZodEnum<["draft", "published", "removed"]>;
export type TemplateStatus = z.infer<typeof TemplateStatusSchema>;
export declare const BlogStatusSchema: z.ZodEnum<["draft", "scheduled", "published"]>;
export type BlogStatus = z.infer<typeof BlogStatusSchema>;
export declare const SeoPageKindSchema: z.ZodEnum<["marketing", "blog", "template", "profile", "integration", "use_case"]>;
export type SeoPageKind = z.infer<typeof SeoPageKindSchema>;
export declare const NotificationKindSchema: z.ZodEnum<["approval", "run_failed", "escalation", "publish_failed", "system"]>;
export type NotificationKind = z.infer<typeof NotificationKindSchema>;
export declare const UsageKindSchema: z.ZodEnum<["llm_tokens", "task_credit", "storage"]>;
export type UsageKind = z.infer<typeof UsageKindSchema>;
export declare const SubscriptionStatusSchema: z.ZodEnum<["active", "past_due", "cancelled", "trialing"]>;
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;
//# sourceMappingURL=enums.d.ts.map