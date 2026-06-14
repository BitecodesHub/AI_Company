"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartRunSchema = exports.AgentInputSchema = void 0;
const zod_1 = require("zod");
const enums_js_1 = require("../enums.js");
// ── Agent input (create / update) ─────────────────────────────────────────────
exports.AgentInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    role: zod_1.z.string().min(1).max(200),
    goal: zod_1.z.string().max(500).optional(),
    systemPrompt: zod_1.z.string().default(''),
    defaultModel: zod_1.z.string().optional(),
    costTier: enums_js_1.CostTierSchema.default('auto'),
    mode: enums_js_1.AgentModeSchema.default('sandbox'),
    // Tool references: 'mcp:<serverId>:<toolName>' | 'connector:<type>:<action>' | 'builtin:<name>'
    tools: zod_1.z.array(zod_1.z.string()).default([]),
    knowledgeBaseIds: zod_1.z.array(zod_1.z.string().uuid()).default([]),
    approvalRequiredFor: zod_1.z
        .array(zod_1.z.enum(['publish', 'send', 'destructive']))
        .default(['publish', 'send', 'destructive']),
    guardrails: zod_1.z
        .object({
        piiMask: zod_1.z.boolean().default(false),
        promptInjectionScan: zod_1.z.boolean().default(true),
        maxCostUsdPerRun: zod_1.z.number().positive().default(0.5),
    })
        .default({}),
});
// ── Start run ─────────────────────────────────────────────────────────────────
exports.StartRunSchema = zod_1.z.object({
    input: zod_1.z.unknown(),
});
//# sourceMappingURL=agent.js.map