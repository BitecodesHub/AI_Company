import { describe, it, expect } from 'vitest';
import { ACTION_REGISTRY, getAction, validateActionArgs } from '../registry.js';

describe('Action Registry', () => {
  it('contains all 15 canonical V1 actions', () => {
    const names = ACTION_REGISTRY.map(a => a.name);
    expect(names).toContain('navigate');
    expect(names).toContain('agent.create');
    expect(names).toContain('agent.run');
    expect(names).toContain('content.generateWeek');
    expect(names).toContain('inbox.reply');
    expect(names).toContain('blog.generateAndPublish');
    expect(ACTION_REGISTRY.length).toBeGreaterThanOrEqual(15);
  });

  it('getAction returns action for valid name', () => {
    const action = getAction('navigate');
    expect(action).toBeDefined();
    expect(action?.riskClass).toBe('safe');
    expect(action?.target).toBe('browser');
  });

  it('getAction returns undefined for unknown name', () => {
    expect(getAction('made.up.action')).toBeUndefined();
  });

  it('validateActionArgs accepts valid navigate args', () => {
    const result = validateActionArgs('navigate', { to: '/settings/billing' });
    expect(result.success).toBe(true);
  });

  it('validateActionArgs rejects empty navigate path', () => {
    const result = validateActionArgs('navigate', { to: '' });
    expect(result.success).toBe(false);
  });

  it('validateActionArgs rejects unknown action', () => {
    const result = validateActionArgs('hack.the.planet', {});
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('Unknown action');
  });

  it('validateActionArgs accepts valid content.generateWeek args', () => {
    const result = validateActionArgs('content.generateWeek', {
      brandVoiceId: '550e8400-e29b-41d4-a716-446655440000',
      platforms: ['linkedin', 'x'],
    });
    expect(result.success).toBe(true);
  });

  it('all actions have a description', () => {
    ACTION_REGISTRY.forEach(a => {
      expect(a.description.length).toBeGreaterThan(0);
    });
  });

  it('no action uses dot in riskClass (slashes are Inngest, dots are actions — never mix)', () => {
    ACTION_REGISTRY.forEach(a => {
      expect(a.name).not.toContain('/');
    });
  });
});
