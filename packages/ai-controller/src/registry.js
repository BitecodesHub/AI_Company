"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTION_REGISTRY = exports.WorkflowOpenArgsSchema = exports.BlogGenerateAndPublishArgsSchema = exports.ConnectorStartArgsSchema = exports.KnowledgeUploadArgsSchema = exports.TableFilterArgsSchema = exports.BillingOpenArgsSchema = exports.SettingsOpenArgsSchema = exports.InboxReplyArgsSchema = exports.InboxFindNegativeArgsSchema = exports.ContentOpenArgsSchema = exports.ContentGenerateWeekArgsSchema = exports.AgentOpenArgsSchema = exports.AgentRunArgsSchema = exports.AgentCreateArgsSchema = exports.NavigateArgsSchema = void 0;
exports.getAction = getAction;
exports.validateActionArgs = validateActionArgs;
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
const zod_1 = require("zod");
// ── Canonical V1 action set (BUILD_GUIDE §7, ARCHITECTURE.md §14) ────────────
exports.NavigateArgsSchema = zod_1.z.object({
    to: zod_1.z.string().min(1), // route path e.g. '/settings/billing'
});
exports.AgentCreateArgsSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    role: zod_1.z.string().optional(),
    template: zod_1.z.string().optional(),
});
exports.AgentRunArgsSchema = zod_1.z.object({
    agentId: zod_1.z.string().uuid(),
    input: zod_1.z.unknown().optional(),
});
exports.AgentOpenArgsSchema = zod_1.z.object({
    agentId: zod_1.z.string().uuid(),
});
exports.ContentGenerateWeekArgsSchema = zod_1.z.object({
    brandVoiceId: zod_1.z.string().uuid(),
    platforms: zod_1.z.array(zod_1.z.string()).min(1),
    topic: zod_1.z.string().optional(),
});
exports.ContentOpenArgsSchema = zod_1.z.object({
    contentItemId: zod_1.z.string().uuid().optional(),
    view: zod_1.z.enum(['calendar', 'kanban']).default('calendar'),
});
exports.InboxFindNegativeArgsSchema = zod_1.z.object({
    platform: zod_1.z.string().optional(),
    limit: zod_1.z.number().int().min(1).max(20).default(5),
});
exports.InboxReplyArgsSchema = zod_1.z.object({
    messageId: zod_1.z.string().uuid(),
    draft: zod_1.z.string().min(1),
});
exports.SettingsOpenArgsSchema = zod_1.z.object({
    section: zod_1.z.string().optional(), // e.g. 'billing', 'connectors', 'members'
});
exports.BillingOpenArgsSchema = zod_1.z.object({});
exports.TableFilterArgsSchema = zod_1.z.object({
    table: zod_1.z.string(),
    filters: zod_1.z.record(zod_1.z.unknown()),
});
exports.KnowledgeUploadArgsSchema = zod_1.z.object({
    kbId: zod_1.z.string().uuid().optional(),
    sourceType: zod_1.z.enum(['file', 'url', 'text']),
    value: zod_1.z.string(),
});
exports.ConnectorStartArgsSchema = zod_1.z.object({
    connectorType: zod_1.z.string(),
});
exports.BlogGenerateAndPublishArgsSchema = zod_1.z.object({
    topic: zod_1.z.string().min(1),
    keywords: zod_1.z.array(zod_1.z.string()).optional(),
    publishImmediately: zod_1.z.boolean().default(false),
});
exports.WorkflowOpenArgsSchema = zod_1.z.object({
    workflowId: zod_1.z.string().uuid().optional(),
});
// ── Registry ──────────────────────────────────────────────────────────────────
exports.ACTION_REGISTRY = [
    { name: 'navigate', argsSchema: exports.NavigateArgsSchema, riskClass: 'safe', target: 'browser', description: 'Navigate the app to a route.' },
    { name: 'agent.create', argsSchema: exports.AgentCreateArgsSchema, riskClass: 'confirm', target: 'server', description: 'Create a new agent.' },
    { name: 'agent.run', argsSchema: exports.AgentRunArgsSchema, riskClass: 'confirm', target: 'server', description: 'Trigger an agent run.' },
    { name: 'agent.open', argsSchema: exports.AgentOpenArgsSchema, riskClass: 'safe', target: 'browser', description: 'Open the agent builder for an agent.' },
    { name: 'content.generateWeek', argsSchema: exports.ContentGenerateWeekArgsSchema, riskClass: 'confirm', target: 'server', description: 'Generate a week of social content drafts.' },
    { name: 'content.open', argsSchema: exports.ContentOpenArgsSchema, riskClass: 'safe', target: 'browser', description: 'Open the content calendar or kanban.' },
    { name: 'inbox.findNegative', argsSchema: exports.InboxFindNegativeArgsSchema, riskClass: 'safe', target: 'server', description: 'Find negative/escalated inbox messages.' },
    { name: 'inbox.reply', argsSchema: exports.InboxReplyArgsSchema, riskClass: 'confirm', target: 'both', description: 'Draft and optionally send a reply to an inbox message.' },
    { name: 'settings.open', argsSchema: exports.SettingsOpenArgsSchema, riskClass: 'safe', target: 'browser', description: 'Open settings, optionally to a specific section.' },
    { name: 'billing.open', argsSchema: exports.BillingOpenArgsSchema, riskClass: 'safe', target: 'browser', description: 'Open the billing page.' },
    { name: 'table.filter', argsSchema: exports.TableFilterArgsSchema, riskClass: 'safe', target: 'browser', description: 'Apply filters to a data table on screen.' },
    { name: 'knowledge.upload', argsSchema: exports.KnowledgeUploadArgsSchema, riskClass: 'confirm', target: 'server', description: 'Upload content to a knowledge base.' },
    { name: 'connector.start', argsSchema: exports.ConnectorStartArgsSchema, riskClass: 'safe', target: 'browser', description: 'Start the OAuth flow for a connector.' },
    { name: 'blog.generateAndPublish', argsSchema: exports.BlogGenerateAndPublishArgsSchema, riskClass: 'destructive', target: 'server', description: 'AI-generate a blog post and optionally publish it.' },
    { name: 'workflow.open', argsSchema: exports.WorkflowOpenArgsSchema, riskClass: 'safe', target: 'browser', description: 'Open the workflow canvas.' },
];
/** Look up an action by name. Returns undefined if not found — never invent actions. */
function getAction(name) {
    return exports.ACTION_REGISTRY.find((a) => a.name === name);
}
/** Validate action arguments against the action's schema. */
function validateActionArgs(name, args) {
    const action = getAction(name);
    if (!action)
        return { success: false, error: `Unknown action: ${name}` };
    const result = action.argsSchema.safeParse(args);
    if (!result.success) {
        return { success: false, error: result.error.message };
    }
    return { success: true, data: result.data };
}
//# sourceMappingURL=registry.js.map