"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantContextSchema = exports.ErrorEnvelopeSchema = exports.ErrorCodeSchema = exports.PageResultSchema = exports.PageQuerySchema = exports.TimestampsSchema = exports.IdSchema = void 0;
const zod_1 = require("zod");
// ── Primitives ────────────────────────────────────────────────────────────────
exports.IdSchema = zod_1.z.string().uuid();
exports.TimestampsSchema = zod_1.z.object({
    createdAt: zod_1.z.coerce.date(),
    updatedAt: zod_1.z.coerce.date(),
});
// ── Pagination ────────────────────────────────────────────────────────────────
exports.PageQuerySchema = zod_1.z.object({
    cursor: zod_1.z.string().optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
const PageResultSchema = (itemSchema) => zod_1.z.object({
    items: zod_1.z.array(itemSchema),
    nextCursor: zod_1.z.string().nullable(),
    total: zod_1.z.number().int().optional(),
});
exports.PageResultSchema = PageResultSchema;
// ── Error envelope ────────────────────────────────────────────────────────────
// Canonical error codes from BUILD_GUIDE §12. Never add codes outside this list
// without updating the canonical catalog first.
exports.ErrorCodeSchema = zod_1.z.enum([
    'UNAUTHENTICATED',
    'FORBIDDEN',
    'NOT_FOUND',
    'VALIDATION_FAILED',
    'CONFLICT',
    'RATE_LIMITED',
    'COST_LIMIT_EXCEEDED',
    'KILL_SWITCH_ACTIVE',
    'APPROVAL_REQUIRED',
    'TENANT_MISMATCH',
    'UPSTREAM_ERROR',
    'NOT_LICENSED',
]);
exports.ErrorEnvelopeSchema = zod_1.z.object({
    error: zod_1.z.object({
        code: exports.ErrorCodeSchema,
        message: zod_1.z.string(),
        details: zod_1.z.unknown().optional(),
    }),
});
// ── Tenant context (used in requests) ────────────────────────────────────────
exports.TenantContextSchema = zod_1.z.object({
    organizationId: exports.IdSchema,
    workspaceId: exports.IdSchema.optional(),
});
//# sourceMappingURL=base.js.map