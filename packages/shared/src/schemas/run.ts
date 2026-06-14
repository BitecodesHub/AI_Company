import { z } from 'zod';
import { StepTypeSchema } from '../enums.js';

// ── Live run step event (server → client on /runs namespace) ──────────────────

export const RunStepEventSchema = z.object({
  runId: z.string().uuid(),
  step: z.object({
    index: z.number().int().nonnegative(),
    type: StepTypeSchema,
    name: z.string(),
    status: z.string(),
    costUsd: z.number().nonnegative().optional(),
    tokensIn: z.number().int().nonnegative().optional(),
    tokensOut: z.number().int().nonnegative().optional(),
    model: z.string().optional(),
    error: z.unknown().optional(),
  }),
});
export type RunStepEvent = z.infer<typeof RunStepEventSchema>;

// ── Run status event ──────────────────────────────────────────────────────────

export const RunStatusEventSchema = z.object({
  runId: z.string().uuid(),
  status: z.string(),
});
export type RunStatusEvent = z.infer<typeof RunStatusEventSchema>;

// ── Approval created event ────────────────────────────────────────────────────

export const ApprovalCreatedEventSchema = z.object({
  approvalId: z.string().uuid(),
  runId: z.string().uuid(),
});
export type ApprovalCreatedEvent = z.infer<typeof ApprovalCreatedEventSchema>;

// ── Controller action call (server → client on /controller namespace) ─────────

export const ControllerActionCallSchema = z.object({
  sessionId: z.string().uuid(),
  name: z.string(),
  args: z.record(z.unknown()),
  riskClass: z.enum(['safe', 'confirm', 'destructive']),
});
export type ControllerActionCall = z.infer<typeof ControllerActionCallSchema>;
