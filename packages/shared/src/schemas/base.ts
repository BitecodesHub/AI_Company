import { z } from 'zod';

// ── Primitives ────────────────────────────────────────────────────────────────

export const IdSchema = z.string().uuid();
export type Id = z.infer<typeof IdSchema>;

export const TimestampsSchema = z.object({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Timestamps = z.infer<typeof TimestampsSchema>;

// ── Pagination ────────────────────────────────────────────────────────────────

export const PageQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PageQuery = z.infer<typeof PageQuerySchema>;

export const PageResultSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    total: z.number().int().optional(),
  });

// ── Error envelope ────────────────────────────────────────────────────────────
// Canonical error codes from BUILD_GUIDE §12. Never add codes outside this list
// without updating the canonical catalog first.

export const ErrorCodeSchema = z.enum([
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
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

// ── Tenant context (used in requests) ────────────────────────────────────────

export const TenantContextSchema = z.object({
  organizationId: IdSchema,
  workspaceId: IdSchema.optional(),
});
export type TenantContext = z.infer<typeof TenantContextSchema>;
