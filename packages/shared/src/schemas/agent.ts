import { z } from 'zod';
import { AgentModeSchema, CostTierSchema } from '../enums.js';

// ── Agent input (create / update) ─────────────────────────────────────────────

export const AgentInputSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(200),
  goal: z.string().max(500).optional(),
  systemPrompt: z.string().default(''),
  defaultModel: z.string().optional(),
  costTier: CostTierSchema.default('auto'),
  mode: AgentModeSchema.default('sandbox'),
  // Tool references: 'mcp:<serverId>:<toolName>' | 'connector:<type>:<action>' | 'builtin:<name>'
  tools: z.array(z.string()).default([]),
  knowledgeBaseIds: z.array(z.string().uuid()).default([]),
  approvalRequiredFor: z
    .array(z.enum(['publish', 'send', 'destructive']))
    .default(['publish', 'send', 'destructive']),
  guardrails: z
    .object({
      piiMask: z.boolean().default(false),
      promptInjectionScan: z.boolean().default(true),
      maxCostUsdPerRun: z.number().positive().default(0.5),
    })
    .default({}),
});
export type AgentInput = z.infer<typeof AgentInputSchema>;

// ── Start run ─────────────────────────────────────────────────────────────────

export const StartRunSchema = z.object({
  input: z.unknown(),
});
export type StartRun = z.infer<typeof StartRunSchema>;
