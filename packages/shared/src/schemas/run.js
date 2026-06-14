"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControllerActionCallSchema = exports.ApprovalCreatedEventSchema = exports.RunStatusEventSchema = exports.RunStepEventSchema = void 0;
const zod_1 = require("zod");
const enums_js_1 = require("../enums.js");
// ── Live run step event (server → client on /runs namespace) ──────────────────
exports.RunStepEventSchema = zod_1.z.object({
    runId: zod_1.z.string().uuid(),
    step: zod_1.z.object({
        index: zod_1.z.number().int().nonnegative(),
        type: enums_js_1.StepTypeSchema,
        name: zod_1.z.string(),
        status: zod_1.z.string(),
        costUsd: zod_1.z.number().nonnegative().optional(),
        tokensIn: zod_1.z.number().int().nonnegative().optional(),
        tokensOut: zod_1.z.number().int().nonnegative().optional(),
        model: zod_1.z.string().optional(),
        error: zod_1.z.unknown().optional(),
    }),
});
// ── Run status event ──────────────────────────────────────────────────────────
exports.RunStatusEventSchema = zod_1.z.object({
    runId: zod_1.z.string().uuid(),
    status: zod_1.z.string(),
});
// ── Approval created event ────────────────────────────────────────────────────
exports.ApprovalCreatedEventSchema = zod_1.z.object({
    approvalId: zod_1.z.string().uuid(),
    runId: zod_1.z.string().uuid(),
});
// ── Controller action call (server → client on /controller namespace) ─────────
exports.ControllerActionCallSchema = zod_1.z.object({
    sessionId: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    args: zod_1.z.record(zod_1.z.unknown()),
    riskClass: zod_1.z.enum(['safe', 'confirm', 'destructive']),
});
//# sourceMappingURL=run.js.map