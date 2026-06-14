import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ModelRouter,
  ProviderError,
  EmbeddingsUnavailableError,
} from '../model/model-router.js';

/**
 * Provider resolution + mock-mode behaviour for the single AI gateway.
 * No network: live calls are exercised only via mock mode or forced failures.
 */
describe('ModelRouter — provider resolution', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('defaults to openrouter when AI_PROVIDER is unset', () => {
    delete process.env['AI_PROVIDER'];
    expect(new ModelRouter().getProvider()).toBe('openrouter');
  });

  it('honours AI_PROVIDER=ollama', () => {
    process.env['AI_PROVIDER'] = 'ollama';
    expect(new ModelRouter().getProvider()).toBe('ollama');
  });

  it('explicit option overrides the env var', () => {
    process.env['AI_PROVIDER'] = 'ollama';
    expect(new ModelRouter({ provider: 'litellm' }).getProvider()).toBe('litellm');
  });

  it('passes an explicit DEFAULT_MODEL through verbatim for every tier', () => {
    const r = new ModelRouter({ provider: 'openrouter', defaultModel: 'anthropic/claude-3.5-sonnet' });
    expect(r.getModelForTier('fast')).toBe('anthropic/claude-3.5-sonnet');
    expect(r.getModelForTier('smart')).toBe('anthropic/claude-3.5-sonnet');
    expect(r.getModelForTier('auto')).toBe('anthropic/claude-3.5-sonnet');
  });

  it('falls back to per-provider tier defaults when no model is set', () => {
    delete process.env['DEFAULT_MODEL'];
    const or = new ModelRouter({ provider: 'openrouter' });
    expect(or.getModelForTier('smart')).toBe('anthropic/claude-3.5-sonnet');
    expect(or.getModelForTier('fast')).toBe('openai/gpt-4o-mini');

    const ol = new ModelRouter({ provider: 'ollama' });
    expect(ol.getModelForTier('smart')).toBe('llama3.1');
  });
});

describe('ModelRouter — mock mode', () => {
  it('returns a deterministic chat stub with usage and zero cost', async () => {
    const r = new ModelRouter({ gatewayMode: 'mock', provider: 'openrouter' });
    expect(r.isMock()).toBe(true);
    const res = await r.route({
      messages: [{ role: 'user', content: 'hello world' }],
      costTier: 'fast',
    });
    expect(res.message.content).toContain('[mock:openrouter]');
    expect(res.message.content).toContain('hello world');
    expect(res.costUsd).toBe(0);
    expect(res.usage.totalTokens).toBeGreaterThan(0);
  });

  it('returns deterministic, normalised embeddings in mock mode', async () => {
    const r = new ModelRouter({ gatewayMode: 'mock' });
    const [a] = await r.embed(['ping']);
    const [b] = await r.embed(['ping']);
    expect(a).toBeDefined();
    expect(a).toEqual(b); // deterministic
    expect(a!.length).toBe(8);
    const norm = Math.sqrt(a!.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 5); // unit length
  });

  it('embed([]) returns [] without calling a backend', async () => {
    const r = new ModelRouter({ gatewayMode: 'mock' });
    expect(await r.embed([])).toEqual([]);
  });
});

describe('ModelRouter — embeddings disabled', () => {
  it('throws EmbeddingsUnavailableError when EMBEDDING_PROVIDER=none (live)', async () => {
    const r = new ModelRouter({ gatewayMode: 'live', embeddingProvider: 'none' });
    await expect(r.embed(['x'])).rejects.toBeInstanceOf(EmbeddingsUnavailableError);
    await expect(r.embed(['x'])).rejects.toMatchObject({ code: 'EMBEDDINGS_UNAVAILABLE', provider: 'none' });
  });
});

describe('ModelRouter — typed errors are exported', () => {
  it('ProviderError carries the provider', () => {
    const e = new ProviderError('boom', 'ollama');
    expect(e.name).toBe('ProviderError');
    expect(e.provider).toBe('ollama');
  });
});
