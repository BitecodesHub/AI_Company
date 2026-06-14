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
export declare const NavigateArgsSchema: z.ZodObject<{
    to: z.ZodString;
}, "strip", z.ZodTypeAny, {
    to: string;
}, {
    to: string;
}>;
export declare const AgentCreateArgsSchema: z.ZodObject<{
    name: z.ZodString;
    role: z.ZodOptional<z.ZodString>;
    template: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    template?: string | undefined;
    role?: string | undefined;
}, {
    name: string;
    template?: string | undefined;
    role?: string | undefined;
}>;
export declare const AgentRunArgsSchema: z.ZodObject<{
    agentId: z.ZodString;
    input: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    agentId: string;
    input?: unknown;
}, {
    agentId: string;
    input?: unknown;
}>;
export declare const AgentOpenArgsSchema: z.ZodObject<{
    agentId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    agentId: string;
}, {
    agentId: string;
}>;
export declare const ContentGenerateWeekArgsSchema: z.ZodObject<{
    brandVoiceId: z.ZodString;
    platforms: z.ZodArray<z.ZodString, "many">;
    topic: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    brandVoiceId: string;
    platforms: string[];
    topic?: string | undefined;
}, {
    brandVoiceId: string;
    platforms: string[];
    topic?: string | undefined;
}>;
export declare const ContentOpenArgsSchema: z.ZodObject<{
    contentItemId: z.ZodOptional<z.ZodString>;
    view: z.ZodDefault<z.ZodEnum<["calendar", "kanban"]>>;
}, "strip", z.ZodTypeAny, {
    view: "calendar" | "kanban";
    contentItemId?: string | undefined;
}, {
    contentItemId?: string | undefined;
    view?: "calendar" | "kanban" | undefined;
}>;
export declare const InboxFindNegativeArgsSchema: z.ZodObject<{
    platform: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    platform?: string | undefined;
}, {
    limit?: number | undefined;
    platform?: string | undefined;
}>;
export declare const InboxReplyArgsSchema: z.ZodObject<{
    messageId: z.ZodString;
    draft: z.ZodString;
}, "strip", z.ZodTypeAny, {
    draft: string;
    messageId: string;
}, {
    draft: string;
    messageId: string;
}>;
export declare const SettingsOpenArgsSchema: z.ZodObject<{
    section: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    section?: string | undefined;
}, {
    section?: string | undefined;
}>;
export declare const BillingOpenArgsSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export declare const TableFilterArgsSchema: z.ZodObject<{
    table: z.ZodString;
    filters: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    table: string;
    filters: Record<string, unknown>;
}, {
    table: string;
    filters: Record<string, unknown>;
}>;
export declare const KnowledgeUploadArgsSchema: z.ZodObject<{
    kbId: z.ZodOptional<z.ZodString>;
    sourceType: z.ZodEnum<["file", "url", "text"]>;
    value: z.ZodString;
}, "strip", z.ZodTypeAny, {
    value: string;
    sourceType: "text" | "file" | "url";
    kbId?: string | undefined;
}, {
    value: string;
    sourceType: "text" | "file" | "url";
    kbId?: string | undefined;
}>;
export declare const ConnectorStartArgsSchema: z.ZodObject<{
    connectorType: z.ZodString;
}, "strip", z.ZodTypeAny, {
    connectorType: string;
}, {
    connectorType: string;
}>;
export declare const BlogGenerateAndPublishArgsSchema: z.ZodObject<{
    topic: z.ZodString;
    keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    publishImmediately: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    topic: string;
    publishImmediately: boolean;
    keywords?: string[] | undefined;
}, {
    topic: string;
    keywords?: string[] | undefined;
    publishImmediately?: boolean | undefined;
}>;
export declare const WorkflowOpenArgsSchema: z.ZodObject<{
    workflowId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    workflowId?: string | undefined;
}, {
    workflowId?: string | undefined;
}>;
export declare const ACTION_REGISTRY: Action[];
/** Look up an action by name. Returns undefined if not found — never invent actions. */
export declare function getAction(name: string): Action | undefined;
/** Validate action arguments against the action's schema. */
export declare function validateActionArgs(name: string, args: unknown): {
    success: true;
    data: unknown;
} | {
    success: false;
    error: string;
};
//# sourceMappingURL=registry.d.ts.map