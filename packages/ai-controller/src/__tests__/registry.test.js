"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const registry_js_1 = require("../registry.js");
(0, vitest_1.describe)('Action Registry', () => {
    (0, vitest_1.it)('contains all 15 canonical V1 actions', () => {
        const names = registry_js_1.ACTION_REGISTRY.map(a => a.name);
        (0, vitest_1.expect)(names).toContain('navigate');
        (0, vitest_1.expect)(names).toContain('agent.create');
        (0, vitest_1.expect)(names).toContain('agent.run');
        (0, vitest_1.expect)(names).toContain('content.generateWeek');
        (0, vitest_1.expect)(names).toContain('inbox.reply');
        (0, vitest_1.expect)(names).toContain('blog.generateAndPublish');
        (0, vitest_1.expect)(registry_js_1.ACTION_REGISTRY.length).toBeGreaterThanOrEqual(15);
    });
    (0, vitest_1.it)('getAction returns action for valid name', () => {
        const action = (0, registry_js_1.getAction)('navigate');
        (0, vitest_1.expect)(action).toBeDefined();
        (0, vitest_1.expect)(action?.riskClass).toBe('safe');
        (0, vitest_1.expect)(action?.target).toBe('browser');
    });
    (0, vitest_1.it)('getAction returns undefined for unknown name', () => {
        (0, vitest_1.expect)((0, registry_js_1.getAction)('made.up.action')).toBeUndefined();
    });
    (0, vitest_1.it)('validateActionArgs accepts valid navigate args', () => {
        const result = (0, registry_js_1.validateActionArgs)('navigate', { to: '/settings/billing' });
        (0, vitest_1.expect)(result.success).toBe(true);
    });
    (0, vitest_1.it)('validateActionArgs rejects empty navigate path', () => {
        const result = (0, registry_js_1.validateActionArgs)('navigate', { to: '' });
        (0, vitest_1.expect)(result.success).toBe(false);
    });
    (0, vitest_1.it)('validateActionArgs rejects unknown action', () => {
        const result = (0, registry_js_1.validateActionArgs)('hack.the.planet', {});
        (0, vitest_1.expect)(result.success).toBe(false);
        (0, vitest_1.expect)(result.error).toContain('Unknown action');
    });
    (0, vitest_1.it)('validateActionArgs accepts valid content.generateWeek args', () => {
        const result = (0, registry_js_1.validateActionArgs)('content.generateWeek', {
            brandVoiceId: '550e8400-e29b-41d4-a716-446655440000',
            platforms: ['linkedin', 'x'],
        });
        (0, vitest_1.expect)(result.success).toBe(true);
    });
    (0, vitest_1.it)('all actions have a description', () => {
        registry_js_1.ACTION_REGISTRY.forEach(a => {
            (0, vitest_1.expect)(a.description.length).toBeGreaterThan(0);
        });
    });
    (0, vitest_1.it)('no action uses dot in riskClass (slashes are Inngest, dots are actions — never mix)', () => {
        registry_js_1.ACTION_REGISTRY.forEach(a => {
            (0, vitest_1.expect)(a.name).not.toContain('/');
        });
    });
});
//# sourceMappingURL=registry.test.js.map