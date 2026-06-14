import { z } from 'zod';
export declare const AgentInputSchema: z.ZodObject<{
    name: z.ZodString;
    role: z.ZodString;
    goal: z.ZodOptional<z.ZodString>;
    systemPrompt: z.ZodDefault<z.ZodString>;
    defaultModel: z.ZodOptional<z.ZodString>;
    costTier: z.ZodDefault<z.ZodEnum<["fast", "smart", "auto"]>>;
    mode: z.ZodDefault<z.ZodEnum<["sandbox", "production"]>>;
    tools: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    knowledgeBaseIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    approvalRequiredFor: z.ZodDefault<z.ZodArray<z.ZodEnum<["publish", "send", "destructive"]>, "many">>;
    guardrails: z.ZodDefault<z.ZodObject<{
        piiMask: z.ZodDefault<z.ZodBoolean>;
        promptInjectionScan: z.ZodDefault<z.ZodBoolean>;
        maxCostUsdPerRun: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        piiMask: boolean;
        promptInjectionScan: boolean;
        maxCostUsdPerRun: number;
    }, {
        piiMask?: boolean | undefined;
        promptInjectionScan?: boolean | undefined;
        maxCostUsdPerRun?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    role: string;
    systemPrompt: string;
    costTier: "fast" | "smart" | "auto";
    mode: "sandbox" | "production";
    tools: string[];
    knowledgeBaseIds: string[];
    approvalRequiredFor: ("destructive" | "publish" | "send")[];
    guardrails: {
        piiMask: boolean;
        promptInjectionScan: boolean;
        maxCostUsdPerRun: number;
    };
    goal?: string | undefined;
    defaultModel?: string | undefined;
}, {
    name: string;
    role: string;
    goal?: string | undefined;
    systemPrompt?: string | undefined;
    defaultModel?: string | undefined;
    costTier?: "fast" | "smart" | "auto" | undefined;
    mode?: "sandbox" | "production" | undefined;
    tools?: string[] | undefined;
    knowledgeBaseIds?: string[] | undefined;
    approvalRequiredFor?: ("destructive" | "publish" | "send")[] | undefined;
    guardrails?: {
        piiMask?: boolean | undefined;
        promptInjectionScan?: boolean | undefined;
        maxCostUsdPerRun?: number | undefined;
    } | undefined;
}>;
export type AgentInput = z.infer<typeof AgentInputSchema>;
export declare const StartRunSchema: z.ZodObject<{
    input: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    input?: unknown;
}, {
    input?: unknown;
}>;
export type StartRun = z.infer<typeof StartRunSchema>;
//# sourceMappingURL=agent.d.ts.map