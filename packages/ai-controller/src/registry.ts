/**
 * AI Controller — Action Registry and Command Bus types.
 * (ARCHITECTURE.md §14, P8-01, P8-02)
 *
 * The Controller is a structured action layer — NOT pixel-based computer use.
 * The AI can only invoke actions that exist here, with Zod-validated args.
 * This eliminates a whole class of hallucination.
 *
 * Naming: Controller actions are dot-namespaced `domain.action`.
 *         Inngest events are slash-namespaced `domain/action`.
 *         Never interchange the separators — BUILD_GUIDE §3.
 */
import { z } from 'zod';

export type ActionRiskClass = 'safe' | 'confirm' | 'destructive';
export type ActionTarget = 'browser' | 'server' | 'both';

export interface Action<TArgs extends z.ZodTypeAny = z.ZodTypeAny> {
  /** dot-namespaced e.g. agent.run, content.generateWeek */
  name: string;
  description: string;
  argsSchema: TArgs;
  riskClass: ActionRiskClass;
  target: ActionTarget;
}

// ── Canonical V1 action set (BUILD_GUIDE §7, ARCHITECTURE.md §14) ────────────

export const NavigateArgsSchema = z.object({
  to: z.string().min(1),                    // route path e.g. '/settings/billing'
});

export const AgentCreateArgsSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  template: z.string().optional(),
});

export const AgentRunArgsSchema = z.object({
  agentId: z.string().uuid(),
  input: z.unknown().optional(),
});

export const AgentOpenArgsSchema = z.object({
  agentId: z.string().uuid(),
});

export const ContentGenerateWeekArgsSchema = z.object({
  brandVoiceId: z.string().uuid(),
  platforms: z.array(z.string()).min(1),
  topic: z.string().optional(),
});

export const ContentOpenArgsSchema = z.object({
  contentItemId: z.string().uuid().optional(),
  view: z.enum(['calendar', 'kanban']).default('calendar'),
});

export const InboxFindNegativeArgsSchema = z.object({
  platform: z.string().optional(),
  limit: z.number().int().min(1).max(20).default(5),
});

export const InboxReplyArgsSchema = z.object({
  messageId: z.string().uuid(),
  draft: z.string().min(1),
});

export const SettingsOpenArgsSchema = z.object({
  section: z.string().optional(),  // e.g. 'billing', 'connectors', 'members'
});

export const BillingOpenArgsSchema = z.object({});

export const TableFilterArgsSchema = z.object({
  table: z.string(),
  filters: z.record(z.unknown()),
});

export const KnowledgeUploadArgsSchema = z.object({
  kbId: z.string().uuid().optional(),
  sourceType: z.enum(['file', 'url', 'text']),
  value: z.string(),
});

export const ConnectorStartArgsSchema = z.object({
  connectorType: z.string(),
});

export const BlogGenerateAndPublishArgsSchema = z.object({
  topic: z.string().min(1),
  keywords: z.array(z.string()).optional(),
  publishImmediately: z.boolean().default(false),
});

export const WorkflowOpenArgsSchema = z.object({
  workflowId: z.string().uuid().optional(),
});

// ── Registry ──────────────────────────────────────────────────────────────────

export const ACTION_REGISTRY: Action[] = [
  { name: 'navigate',                argsSchema: NavigateArgsSchema,                riskClass: 'safe',        target: 'browser', description: 'Navigate the app to a route.' },
  { name: 'agent.create',            argsSchema: AgentCreateArgsSchema,             riskClass: 'confirm',     target: 'server',  description: 'Create a new agent.' },
  { name: 'agent.run',               argsSchema: AgentRunArgsSchema,                riskClass: 'confirm',     target: 'server',  description: 'Trigger an agent run.' },
  { name: 'agent.open',              argsSchema: AgentOpenArgsSchema,               riskClass: 'safe',        target: 'browser', description: 'Open the agent builder for an agent.' },
  { name: 'content.generateWeek',    argsSchema: ContentGenerateWeekArgsSchema,     riskClass: 'confirm',     target: 'server',  description: 'Generate a week of social content drafts.' },
  { name: 'content.open',            argsSchema: ContentOpenArgsSchema,             riskClass: 'safe',        target: 'browser', description: 'Open the content calendar or kanban.' },
  { name: 'inbox.findNegative',      argsSchema: InboxFindNegativeArgsSchema,       riskClass: 'safe',        target: 'server',  description: 'Find negative/escalated inbox messages.' },
  { name: 'inbox.reply',             argsSchema: InboxReplyArgsSchema,              riskClass: 'confirm',     target: 'both',    description: 'Draft and optionally send a reply to an inbox message.' },
  { name: 'settings.open',           argsSchema: SettingsOpenArgsSchema,            riskClass: 'safe',        target: 'browser', description: 'Open settings, optionally to a specific section.' },
  { name: 'billing.open',            argsSchema: BillingOpenArgsSchema,             riskClass: 'safe',        target: 'browser', description: 'Open the billing page.' },
  { name: 'table.filter',            argsSchema: TableFilterArgsSchema,             riskClass: 'safe',        target: 'browser', description: 'Apply filters to a data table on screen.' },
  { name: 'knowledge.upload',        argsSchema: KnowledgeUploadArgsSchema,         riskClass: 'confirm',     target: 'server',  description: 'Upload content to a knowledge base.' },
  { name: 'connector.start',         argsSchema: ConnectorStartArgsSchema,          riskClass: 'safe',        target: 'browser', description: 'Start the OAuth flow for a connector.' },
  { name: 'blog.generateAndPublish', argsSchema: BlogGenerateAndPublishArgsSchema,  riskClass: 'destructive', target: 'server',  description: 'AI-generate a blog post and optionally publish it.' },
  { name: 'workflow.open',           argsSchema: WorkflowOpenArgsSchema,            riskClass: 'safe',        target: 'browser', description: 'Open the workflow canvas.' },
];

/** Look up an action by name. Returns undefined if not found — never invent actions. */
export function getAction(name: string): Action | undefined {
  return ACTION_REGISTRY.find((a) => a.name === name);
}

/** Validate action arguments against the action's schema. */
export function validateActionArgs(
  name: string,
  args: unknown,
): { success: true; data: unknown } | { success: false; error: string } {
  const action = getAction(name);
  if (!action) return { success: false, error: `Unknown action: ${name}` };
  const result = action.argsSchema.safeParse(args);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }
  return { success: true, data: result.data };
}
