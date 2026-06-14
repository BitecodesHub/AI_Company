"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_js_1 = require("../index.js");
(0, vitest_1.describe)('IdSchema', () => {
    (0, vitest_1.it)('accepts a valid UUID', () => {
        (0, vitest_1.expect)(() => index_js_1.IdSchema.parse('550e8400-e29b-41d4-a716-446655440000')).not.toThrow();
    });
    (0, vitest_1.it)('rejects a non-UUID', () => {
        (0, vitest_1.expect)(() => index_js_1.IdSchema.parse('not-a-uuid')).toThrow();
    });
});
(0, vitest_1.describe)('PageQuerySchema', () => {
    (0, vitest_1.it)('defaults limit to 20', () => {
        const result = index_js_1.PageQuerySchema.parse({});
        (0, vitest_1.expect)(result.limit).toBe(20);
    });
    (0, vitest_1.it)('clamps limit to max 100', () => {
        (0, vitest_1.expect)(() => index_js_1.PageQuerySchema.parse({ limit: 101 })).toThrow();
    });
    (0, vitest_1.it)('accepts cursor', () => {
        const result = index_js_1.PageQuerySchema.parse({ cursor: 'abc', limit: 10 });
        (0, vitest_1.expect)(result.cursor).toBe('abc');
    });
});
(0, vitest_1.describe)('ErrorEnvelopeSchema', () => {
    (0, vitest_1.it)('parses a valid error envelope', () => {
        const result = index_js_1.ErrorEnvelopeSchema.parse({
            error: { code: 'NOT_FOUND', message: 'Resource not found' },
        });
        (0, vitest_1.expect)(result.error.code).toBe('NOT_FOUND');
    });
    (0, vitest_1.it)('rejects an unknown error code', () => {
        (0, vitest_1.expect)(() => index_js_1.ErrorEnvelopeSchema.parse({ error: { code: 'MADE_UP', message: 'x' } })).toThrow();
    });
    (0, vitest_1.it)('accepts optional details', () => {
        const result = index_js_1.ErrorEnvelopeSchema.parse({
            error: { code: 'VALIDATION_FAILED', message: 'bad input', details: { field: 'name' } },
        });
        (0, vitest_1.expect)(result.error.details).toEqual({ field: 'name' });
    });
});
(0, vitest_1.describe)('ErrorCodeSchema — canonical codes', () => {
    const codes = [
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
    ];
    vitest_1.it.each(codes)('accepts canonical code %s', (code) => {
        (0, vitest_1.expect)(() => index_js_1.ErrorCodeSchema.parse(code)).not.toThrow();
    });
});
(0, vitest_1.describe)('AgentInputSchema', () => {
    (0, vitest_1.it)('provides sensible defaults', () => {
        const result = index_js_1.AgentInputSchema.parse({ name: 'My Agent', role: 'Copywriter' });
        (0, vitest_1.expect)(result.costTier).toBe('auto');
        (0, vitest_1.expect)(result.mode).toBe('sandbox');
        (0, vitest_1.expect)(result.tools).toEqual([]);
        (0, vitest_1.expect)(result.guardrails.promptInjectionScan).toBe(true);
        (0, vitest_1.expect)(result.guardrails.maxCostUsdPerRun).toBe(0.5);
    });
    (0, vitest_1.it)('rejects empty name', () => {
        (0, vitest_1.expect)(() => index_js_1.AgentInputSchema.parse({ name: '', role: 'x' })).toThrow();
    });
    (0, vitest_1.it)('rejects invalid costTier', () => {
        (0, vitest_1.expect)(() => index_js_1.AgentInputSchema.parse({ name: 'a', role: 'b', costTier: 'turbo' })).toThrow();
    });
});
(0, vitest_1.describe)('RunStepEventSchema', () => {
    (0, vitest_1.it)('parses a valid step event', () => {
        const result = index_js_1.RunStepEventSchema.parse({
            runId: '550e8400-e29b-41d4-a716-446655440000',
            step: { index: 0, type: 'llm', name: 'Call model', status: 'running' },
        });
        (0, vitest_1.expect)(result.step.type).toBe('llm');
    });
    (0, vitest_1.it)('rejects invalid step type', () => {
        (0, vitest_1.expect)(() => index_js_1.RunStepEventSchema.parse({
            runId: '550e8400-e29b-41d4-a716-446655440000',
            step: { index: 0, type: 'unknown_type', name: 'x', status: 'running' },
        })).toThrow();
    });
});
(0, vitest_1.describe)('Enum schemas — canonical sets', () => {
    (0, vitest_1.it)('RoleSchema accepts all four roles', () => {
        ['owner', 'admin', 'member', 'viewer'].forEach((r) => (0, vitest_1.expect)(() => index_js_1.RoleSchema.parse(r)).not.toThrow());
    });
    (0, vitest_1.it)('PlanSchema covers all tiers', () => {
        ['free', 'pro', 'team', 'enterprise'].forEach((p) => (0, vitest_1.expect)(() => index_js_1.PlanSchema.parse(p)).not.toThrow());
    });
    (0, vitest_1.it)('RunStatusSchema covers all transitions', () => {
        ['queued', 'running', 'waiting_approval', 'paused', 'succeeded', 'failed', 'cancelled'].forEach((s) => (0, vitest_1.expect)(() => index_js_1.RunStatusSchema.parse(s)).not.toThrow());
    });
    (0, vitest_1.it)('StepTypeSchema covers all step types', () => {
        ['llm', 'tool', 'approval', 'handoff', 'wait', 'log'].forEach((t) => (0, vitest_1.expect)(() => index_js_1.StepTypeSchema.parse(t)).not.toThrow());
    });
    (0, vitest_1.it)('ConnectorRiskClassSchema covers all risk classes', () => {
        ['read', 'write', 'destructive'].forEach((r) => (0, vitest_1.expect)(() => index_js_1.ConnectorRiskClassSchema.parse(r)).not.toThrow());
    });
    (0, vitest_1.it)('ContentStatusSchema covers all statuses', () => {
        ['idea', 'draft', 'approval', 'scheduled', 'published', 'failed'].forEach((s) => (0, vitest_1.expect)(() => index_js_1.ContentStatusSchema.parse(s)).not.toThrow());
    });
    (0, vitest_1.it)('CostTierSchema covers all tiers', () => {
        ['fast', 'smart', 'auto'].forEach((t) => (0, vitest_1.expect)(() => index_js_1.CostTierSchema.parse(t)).not.toThrow());
    });
    (0, vitest_1.it)('AgentModeSchema covers both modes', () => {
        ['sandbox', 'production'].forEach((m) => (0, vitest_1.expect)(() => index_js_1.AgentModeSchema.parse(m)).not.toThrow());
    });
});
//# sourceMappingURL=schemas.test.js.map