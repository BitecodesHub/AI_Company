import { z } from 'zod';
export declare const IdSchema: z.ZodString;
export type Id = z.infer<typeof IdSchema>;
export declare const TimestampsSchema: z.ZodObject<{
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    createdAt: Date;
    updatedAt: Date;
}, {
    createdAt: Date;
    updatedAt: Date;
}>;
export type Timestamps = z.infer<typeof TimestampsSchema>;
export declare const PageQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    cursor?: string | undefined;
}, {
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
export type PageQuery = z.infer<typeof PageQuerySchema>;
export declare const PageResultSchema: <T extends z.ZodTypeAny>(itemSchema: T) => z.ZodObject<{
    items: z.ZodArray<T, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
    total: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    items: T["_output"][];
    nextCursor: string | null;
    total?: number | undefined;
}, {
    items: T["_input"][];
    nextCursor: string | null;
    total?: number | undefined;
}>;
export declare const ErrorCodeSchema: z.ZodEnum<["UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "VALIDATION_FAILED", "CONFLICT", "RATE_LIMITED", "COST_LIMIT_EXCEEDED", "KILL_SWITCH_ACTIVE", "APPROVAL_REQUIRED", "TENANT_MISMATCH", "UPSTREAM_ERROR", "NOT_LICENSED"]>;
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export declare const ErrorEnvelopeSchema: z.ZodObject<{
    error: z.ZodObject<{
        code: z.ZodEnum<["UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "VALIDATION_FAILED", "CONFLICT", "RATE_LIMITED", "COST_LIMIT_EXCEEDED", "KILL_SWITCH_ACTIVE", "APPROVAL_REQUIRED", "TENANT_MISMATCH", "UPSTREAM_ERROR", "NOT_LICENSED"]>;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_FAILED" | "CONFLICT" | "RATE_LIMITED" | "COST_LIMIT_EXCEEDED" | "KILL_SWITCH_ACTIVE" | "APPROVAL_REQUIRED" | "TENANT_MISMATCH" | "UPSTREAM_ERROR" | "NOT_LICENSED";
        message: string;
        details?: unknown;
    }, {
        code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_FAILED" | "CONFLICT" | "RATE_LIMITED" | "COST_LIMIT_EXCEEDED" | "KILL_SWITCH_ACTIVE" | "APPROVAL_REQUIRED" | "TENANT_MISMATCH" | "UPSTREAM_ERROR" | "NOT_LICENSED";
        message: string;
        details?: unknown;
    }>;
}, "strip", z.ZodTypeAny, {
    error: {
        code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_FAILED" | "CONFLICT" | "RATE_LIMITED" | "COST_LIMIT_EXCEEDED" | "KILL_SWITCH_ACTIVE" | "APPROVAL_REQUIRED" | "TENANT_MISMATCH" | "UPSTREAM_ERROR" | "NOT_LICENSED";
        message: string;
        details?: unknown;
    };
}, {
    error: {
        code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_FAILED" | "CONFLICT" | "RATE_LIMITED" | "COST_LIMIT_EXCEEDED" | "KILL_SWITCH_ACTIVE" | "APPROVAL_REQUIRED" | "TENANT_MISMATCH" | "UPSTREAM_ERROR" | "NOT_LICENSED";
        message: string;
        details?: unknown;
    };
}>;
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
export declare const TenantContextSchema: z.ZodObject<{
    organizationId: z.ZodString;
    workspaceId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    organizationId: string;
    workspaceId?: string | undefined;
}, {
    organizationId: string;
    workspaceId?: string | undefined;
}>;
export type TenantContext = z.infer<typeof TenantContextSchema>;
//# sourceMappingURL=base.d.ts.map