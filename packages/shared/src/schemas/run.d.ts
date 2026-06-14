import { z } from 'zod';
export declare const RunStepEventSchema: z.ZodObject<{
    runId: z.ZodString;
    step: z.ZodObject<{
        index: z.ZodNumber;
        type: z.ZodEnum<["llm", "tool", "approval", "handoff", "wait", "log"]>;
        name: z.ZodString;
        status: z.ZodString;
        costUsd: z.ZodOptional<z.ZodNumber>;
        tokensIn: z.ZodOptional<z.ZodNumber>;
        tokensOut: z.ZodOptional<z.ZodNumber>;
        model: z.ZodOptional<z.ZodString>;
        error: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        type: "llm" | "tool" | "approval" | "handoff" | "wait" | "log";
        status: string;
        name: string;
        index: number;
        error?: unknown;
        costUsd?: number | undefined;
        tokensIn?: number | undefined;
        tokensOut?: number | undefined;
        model?: string | undefined;
    }, {
        type: "llm" | "tool" | "approval" | "handoff" | "wait" | "log";
        status: string;
        name: string;
        index: number;
        error?: unknown;
        costUsd?: number | undefined;
        tokensIn?: number | undefined;
        tokensOut?: number | undefined;
        model?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    runId: string;
    step: {
        type: "llm" | "tool" | "approval" | "handoff" | "wait" | "log";
        status: string;
        name: string;
        index: number;
        error?: unknown;
        costUsd?: number | undefined;
        tokensIn?: number | undefined;
        tokensOut?: number | undefined;
        model?: string | undefined;
    };
}, {
    runId: string;
    step: {
        type: "llm" | "tool" | "approval" | "handoff" | "wait" | "log";
        status: string;
        name: string;
        index: number;
        error?: unknown;
        costUsd?: number | undefined;
        tokensIn?: number | undefined;
        tokensOut?: number | undefined;
        model?: string | undefined;
    };
}>;
export type RunStepEvent = z.infer<typeof RunStepEventSchema>;
export declare const RunStatusEventSchema: z.ZodObject<{
    runId: z.ZodString;
    status: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: string;
    runId: string;
}, {
    status: string;
    runId: string;
}>;
export type RunStatusEvent = z.infer<typeof RunStatusEventSchema>;
export declare const ApprovalCreatedEventSchema: z.ZodObject<{
    approvalId: z.ZodString;
    runId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    runId: string;
    approvalId: string;
}, {
    runId: string;
    approvalId: string;
}>;
export type ApprovalCreatedEvent = z.infer<typeof ApprovalCreatedEventSchema>;
export declare const ControllerActionCallSchema: z.ZodObject<{
    sessionId: z.ZodString;
    name: z.ZodString;
    args: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    riskClass: z.ZodEnum<["safe", "confirm", "destructive"]>;
}, "strip", z.ZodTypeAny, {
    name: string;
    sessionId: string;
    args: Record<string, unknown>;
    riskClass: "destructive" | "safe" | "confirm";
}, {
    name: string;
    sessionId: string;
    args: Record<string, unknown>;
    riskClass: "destructive" | "safe" | "confirm";
}>;
export type ControllerActionCall = z.infer<typeof ControllerActionCallSchema>;
//# sourceMappingURL=run.d.ts.map