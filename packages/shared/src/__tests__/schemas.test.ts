import { describe, it, expect } from 'vitest';
import {
  IdSchema,
  PageQuerySchema,
  ErrorEnvelopeSchema,
  ErrorCodeSchema,
  AgentInputSchema,
  RunStepEventSchema,
  RoleSchema,
  PlanSchema,
  RunStatusSchema,
  StepTypeSchema,
  ConnectorRiskClassSchema,
  ContentStatusSchema,
  CostTierSchema,
  AgentModeSchema,
} from '../index.js';

describe('IdSchema', () => {
  it('accepts a valid UUID', () => {
    expect(() => IdSchema.parse('550e8400-e29b-41d4-a716-446655440000')).not.toThrow();
  });
  it('rejects a non-UUID', () => {
    expect(() => IdSchema.parse('not-a-uuid')).toThrow();
  });
});

describe('PageQuerySchema', () => {
  it('defaults limit to 20', () => {
    const result = PageQuerySchema.parse({});
    expect(result.limit).toBe(20);
  });
  it('clamps limit to max 100', () => {
    expect(() => PageQuerySchema.parse({ limit: 101 })).toThrow();
  });
  it('accepts cursor', () => {
    const result = PageQuerySchema.parse({ cursor: 'abc', limit: 10 });
    expect(result.cursor).toBe('abc');
  });
});

describe('ErrorEnvelopeSchema', () => {
  it('parses a valid error envelope', () => {
    const result = ErrorEnvelopeSchema.parse({
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    });
    expect(result.error.code).toBe('NOT_FOUND');
  });
  it('rejects an unknown error code', () => {
    expect(() =>
      ErrorEnvelopeSchema.parse({ error: { code: 'MADE_UP', message: 'x' } }),
    ).toThrow();
  });
  it('accepts optional details', () => {
    const result = ErrorEnvelopeSchema.parse({
      error: { code: 'VALIDATION_FAILED', message: 'bad input', details: { field: 'name' } },
    });
    expect(result.error.details).toEqual({ field: 'name' });
  });
});

describe('ErrorCodeSchema — canonical codes', () => {
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
  ] as const;
  it.each(codes)('accepts canonical code %s', (code) => {
    expect(() => ErrorCodeSchema.parse(code)).not.toThrow();
  });
});

describe('AgentInputSchema', () => {
  it('provides sensible defaults', () => {
    const result = AgentInputSchema.parse({ name: 'My Agent', role: 'Copywriter' });
    expect(result.costTier).toBe('auto');
    expect(result.mode).toBe('sandbox');
    expect(result.tools).toEqual([]);
    expect(result.guardrails.promptInjectionScan).toBe(true);
    expect(result.guardrails.maxCostUsdPerRun).toBe(0.5);
  });
  it('rejects empty name', () => {
    expect(() => AgentInputSchema.parse({ name: '', role: 'x' })).toThrow();
  });
  it('rejects invalid costTier', () => {
    expect(() =>
      AgentInputSchema.parse({ name: 'a', role: 'b', costTier: 'turbo' }),
    ).toThrow();
  });
});

describe('RunStepEventSchema', () => {
  it('parses a valid step event', () => {
    const result = RunStepEventSchema.parse({
      runId: '550e8400-e29b-41d4-a716-446655440000',
      step: { index: 0, type: 'llm', name: 'Call model', status: 'running' },
    });
    expect(result.step.type).toBe('llm');
  });
  it('rejects invalid step type', () => {
    expect(() =>
      RunStepEventSchema.parse({
        runId: '550e8400-e29b-41d4-a716-446655440000',
        step: { index: 0, type: 'unknown_type', name: 'x', status: 'running' },
      }),
    ).toThrow();
  });
});

describe('Enum schemas — canonical sets', () => {
  it('RoleSchema accepts all four roles', () => {
    ['owner', 'admin', 'member', 'viewer'].forEach((r) =>
      expect(() => RoleSchema.parse(r)).not.toThrow(),
    );
  });
  it('PlanSchema covers all tiers', () => {
    ['free', 'pro', 'team', 'enterprise'].forEach((p) =>
      expect(() => PlanSchema.parse(p)).not.toThrow(),
    );
  });
  it('RunStatusSchema covers all transitions', () => {
    ['queued', 'running', 'waiting_approval', 'paused', 'succeeded', 'failed', 'cancelled'].forEach(
      (s) => expect(() => RunStatusSchema.parse(s)).not.toThrow(),
    );
  });
  it('StepTypeSchema covers all step types', () => {
    ['llm', 'tool', 'approval', 'handoff', 'wait', 'log'].forEach((t) =>
      expect(() => StepTypeSchema.parse(t)).not.toThrow(),
    );
  });
  it('ConnectorRiskClassSchema covers all risk classes', () => {
    ['read', 'write', 'destructive'].forEach((r) =>
      expect(() => ConnectorRiskClassSchema.parse(r)).not.toThrow(),
    );
  });
  it('ContentStatusSchema covers all statuses', () => {
    ['idea', 'draft', 'approval', 'scheduled', 'published', 'failed'].forEach((s) =>
      expect(() => ContentStatusSchema.parse(s)).not.toThrow(),
    );
  });
  it('CostTierSchema covers all tiers', () => {
    ['fast', 'smart', 'auto'].forEach((t) =>
      expect(() => CostTierSchema.parse(t)).not.toThrow(),
    );
  });
  it('AgentModeSchema covers both modes', () => {
    ['sandbox', 'production'].forEach((m) =>
      expect(() => AgentModeSchema.parse(m)).not.toThrow(),
    );
  });
});
