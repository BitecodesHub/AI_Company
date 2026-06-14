/**
 * ModelRouter — the single AI gateway for the whole platform.
 *
 * Every chat completion and every embedding flows through this class. The API
 * and worker never call a provider SDK directly — BUILD_GUIDE §5 "AI provider
 * gateway". One env var, `AI_PROVIDER`, decides where traffic goes:
 *
 *   openrouter → OpenRouter cloud (one key). baseURL=OPENROUTER_BASE_URL.
 *   ollama     → local Ollama, OpenAI-compatible at ${OLLAMA_BASE_URL}/v1. No key.
 *   litellm    → self-hosted LiteLLM proxy (advanced/optional). Original path.
 *
 * Cost tiers (when no explicit model is given):
 *   fast  → cheapest capable model for the provider
 *   smart → strongest reasoning model for the provider
 *   auto  → route by a complexity heuristic
 *
 * AI_GATEWAY_MODE=mock returns deterministic stubs (CI/E2E, no key/network).
 * Any live provider failure throws a typed ProviderError — never a silent stub.
 */
import OpenAI from 'openai';
import type { CostTier } from '@bitecodes/shared';

export type AiProvider = 'openrouter' | 'ollama' | 'litellm';
export type EmbeddingProvider = 'ollama' | 'openrouter' | 'none';

/** Thrown when a live provider chat call fails. Carries the provider + cause. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: AiProvider,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/** Thrown when embeddings are requested but the configured backend cannot serve them. */
export class EmbeddingsUnavailableError extends Error {
  readonly code = 'EMBEDDINGS_UNAVAILABLE';
  constructor(
    message: string,
    readonly provider: EmbeddingProvider,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'EmbeddingsUnavailableError';
  }
}

export interface ModelRouterOptions {
  /** Active chat provider. Falls back to AI_PROVIDER, then 'openrouter'. */
  provider?: AiProvider;
  /** Explicit chat model (per-agent override). Falls back to DEFAULT_MODEL. */
  defaultModel?: string;
  /** Override base URL (mostly for tests). */
  baseUrl?: string;
  /** Override API key (mostly for tests). */
  apiKey?: string;
  /** 'mock' returns deterministic stubs. Falls back to AI_GATEWAY_MODE. */
  gatewayMode?: 'mock' | 'live';
  /** Embedding backend. Falls back to EMBEDDING_PROVIDER, then 'ollama'. */
  embeddingProvider?: EmbeddingProvider;
  /** Embedding model. Falls back to EMBEDDING_MODEL. */
  embeddingModel?: string;
  // ── Back-compat (litellm path) ──
  litellmBaseUrl?: string;
  litellmApiKey?: string;
  virtualKey?: string;
}

export interface RouteRequest {
  messages: OpenAI.ChatCompletionMessageParam[];
  tools?: OpenAI.ChatCompletionTool[];
  costTier: CostTier;
  workspaceId?: string;
  /** BYO virtual key for this workspace (litellm path). */
  virtualKey?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface RouteResponse {
  message: OpenAI.ChatCompletionMessage;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  costUsd: number;
}

// Token cost estimates per 1M tokens (USD) — a local fallback only.
const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  fast:  { input: 0.15, output: 0.60  },
  smart: { input: 3.00, output: 15.00 },
  auto:  { input: 0.15, output: 0.60  },
};

// Per-tier default models when no explicit model is configured.
const TIER_DEFAULTS: Record<AiProvider, Record<CostTier, string>> = {
  openrouter: {
    fast:  'openai/gpt-4o-mini',
    smart: 'anthropic/claude-3.5-sonnet',
    auto:  'openai/gpt-4o-mini',
  },
  ollama: {
    fast:  'llama3.1',
    smart: 'llama3.1',
    auto:  'llama3.1',
  },
  litellm: {
    fast:  'fast',
    smart: 'smart',
    auto:  'auto',
  },
};

export class ModelRouter {
  private readonly provider: AiProvider;
  private readonly defaultModel: string | undefined;
  private readonly gatewayMode: 'mock' | 'live';
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly embeddingModel: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private _client: OpenAI | undefined;

  constructor(options: ModelRouterOptions = {}) {
    this.provider =
      options.provider ?? (process.env['AI_PROVIDER'] as AiProvider) ?? 'openrouter';
    this.defaultModel = options.defaultModel ?? process.env['DEFAULT_MODEL'] ?? undefined;
    this.gatewayMode =
      options.gatewayMode ??
      (process.env['AI_GATEWAY_MODE'] === 'mock' ? 'mock' : 'live');
    this.embeddingProvider =
      options.embeddingProvider ??
      (process.env['EMBEDDING_PROVIDER'] as EmbeddingProvider) ??
      'ollama';
    this.embeddingModel =
      options.embeddingModel ?? process.env['EMBEDDING_MODEL'] ?? 'nomic-embed-text';

    const resolved = this.resolveConnection(options);
    this.baseUrl = resolved.baseUrl;
    this.apiKey = resolved.apiKey;
  }

  /** Resolve baseURL + apiKey for the active provider. */
  private resolveConnection(o: ModelRouterOptions): { baseUrl: string; apiKey: string } {
    if (o.baseUrl && o.apiKey) return { baseUrl: o.baseUrl, apiKey: o.apiKey };

    switch (this.provider) {
      case 'openrouter':
        return {
          baseUrl: o.baseUrl ?? process.env['OPENROUTER_BASE_URL'] ?? 'https://openrouter.ai/api/v1',
          apiKey: o.apiKey ?? process.env['OPENROUTER_API_KEY'] ?? '',
        };
      case 'ollama': {
        const base = (process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434').replace(/\/$/, '');
        return { baseUrl: o.baseUrl ?? `${base}/v1`, apiKey: o.apiKey ?? 'ollama' };
      }
      case 'litellm':
      default:
        return {
          baseUrl: o.baseUrl ?? o.litellmBaseUrl ?? process.env['LITELLM_BASE_URL'] ?? 'http://localhost:4001',
          apiKey:
            o.apiKey ?? o.litellmApiKey ?? o.virtualKey ?? process.env['LITELLM_MASTER_KEY'] ?? 'sk-dev-master-key',
        };
    }
  }

  private get client(): OpenAI {
    if (!this._client) {
      this._client = new OpenAI({ baseURL: this.baseUrl, apiKey: this.apiKey || 'unset' });
    }
    return this._client;
  }

  /** The provider this router is wired to (for health reporting). */
  getProvider(): AiProvider {
    return this.provider;
  }

  /** The model that a request of this tier would use (for health reporting). */
  getModelForTier(tier: CostTier = 'smart'): string {
    return this.resolveModel(tier, [], 0);
  }

  isMock(): boolean {
    return this.gatewayMode === 'mock';
  }

  async route(req: RouteRequest): Promise<RouteResponse> {
    const model = this.resolveModel(req.costTier, req.messages, req.tools?.length ?? 0);

    // ── Mock mode: deterministic stub, no key/network (CI/E2E) ──
    if (this.gatewayMode === 'mock') {
      return this.mockRoute(req, model);
    }

    const createParams: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: req.messages,
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.4,
    };
    if (req.tools && req.tools.length > 0) {
      createParams.tools = req.tools;
      createParams.tool_choice = 'auto';
    }

    let completion: OpenAI.ChatCompletion;
    try {
      completion = await this.client.chat.completions.create(createParams);
    } catch (err) {
      throw new ProviderError(
        `${this.provider} chat call failed for model "${model}": ${errMessage(err)}`,
        this.provider,
        err,
      );
    }

    const choice = completion.choices[0];
    if (!choice) {
      throw new ProviderError(`${this.provider} returned no choices`, this.provider);
    }

    const usage = completion.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const costUsd = this.estimateCost(req.costTier, usage.prompt_tokens, usage.completion_tokens);

    return {
      message: choice.message,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
      model: completion.model,
      costUsd,
    };
  }

  /**
   * The single embeddings entry point. Routes by EMBEDDING_PROVIDER.
   * Throws EmbeddingsUnavailableError when the backend cannot embed — callers
   * surface this as a clear failure rather than silently skipping.
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    if (this.gatewayMode === 'mock') {
      // Deterministic 8-dim vector derived from each input's char codes.
      return texts.map((t) => mockEmbedding(t));
    }

    switch (this.embeddingProvider) {
      case 'none':
        throw new EmbeddingsUnavailableError(
          'EMBEDDING_PROVIDER=none — retrieval features are disabled. Set EMBEDDING_PROVIDER=ollama (or openrouter) and EMBEDDING_MODEL to enable.',
          'none',
        );
      case 'ollama':
        return this.embedOllama(texts);
      case 'openrouter':
        return this.embedOpenRouter(texts);
      default:
        throw new EmbeddingsUnavailableError(
          `Unknown EMBEDDING_PROVIDER "${this.embeddingProvider}"`,
          this.embeddingProvider,
        );
    }
  }

  private async embedOllama(texts: string[]): Promise<number[][]> {
    const base = (process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434').replace(/\/$/, '');
    const out: number[][] = [];
    // Ollama's /api/embeddings embeds one prompt per call.
    for (const text of texts) {
      let res: Response;
      try {
        res = await fetch(`${base}/api/embeddings`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ model: this.embeddingModel, prompt: text }),
        });
      } catch (err) {
        throw new EmbeddingsUnavailableError(
          `Ollama embeddings request failed (is \`ollama serve\` running at ${base}?): ${errMessage(err)}`,
          'ollama',
          err,
        );
      }
      if (!res.ok) {
        throw new EmbeddingsUnavailableError(
          `Ollama embeddings returned ${res.status}. Did you \`ollama pull ${this.embeddingModel}\`?`,
          'ollama',
        );
      }
      const json = (await res.json()) as { embedding?: number[] };
      if (!json.embedding) {
        throw new EmbeddingsUnavailableError('Ollama embeddings response missing "embedding"', 'ollama');
      }
      out.push(json.embedding);
    }
    return out;
  }

  private async embedOpenRouter(texts: string[]): Promise<number[][]> {
    const base = process.env['OPENROUTER_BASE_URL'] ?? 'https://openrouter.ai/api/v1';
    const apiKey = process.env['OPENROUTER_API_KEY'] ?? '';
    const client = new OpenAI({ baseURL: base, apiKey: apiKey || 'unset' });
    try {
      const res = await client.embeddings.create({ model: this.embeddingModel, input: texts });
      return res.data.map((d) => d.embedding);
    } catch (err) {
      // OpenRouter does not serve embeddings for most models — surface clearly.
      throw new EmbeddingsUnavailableError(
        `OpenRouter embeddings unavailable for model "${this.embeddingModel}". OpenRouter does not serve embeddings for most models — set EMBEDDING_PROVIDER=ollama, or =none to disable retrieval: ${errMessage(err)}`,
        'openrouter',
        err,
      );
    }
  }

  /**
   * Resolve the concrete model name.
   * An explicit model (per-agent defaultModel or DEFAULT_MODEL) passes through
   * verbatim. Otherwise map the cost tier to a per-provider default, with the
   * `auto` heuristic escalating long / many-tool inputs to the smart tier.
   */
  private resolveModel(
    tier: CostTier,
    messages: OpenAI.ChatCompletionMessageParam[],
    toolCount: number,
  ): string {
    if (this.defaultModel) return this.defaultModel;

    let effectiveTier = tier;
    if (tier === 'auto') {
      const textLength = messages.reduce((sum, m) => {
        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        return sum + content.length;
      }, 0);
      const estimatedTokens = textLength / 4;
      effectiveTier = estimatedTokens > 4000 || toolCount > 5 ? 'smart' : 'fast';
    }
    return TIER_DEFAULTS[this.provider][effectiveTier];
  }

  private estimateCost(tier: CostTier, promptTokens: number, completionTokens: number): number {
    // Local providers (ollama) are free; LiteLLM reports its own cost upstream.
    if (this.provider === 'ollama') return 0;
    const costs = COST_PER_MILLION[tier] ?? COST_PER_MILLION['fast']!;
    return (promptTokens * costs.input + completionTokens * costs.output) / 1_000_000;
  }

  private mockRoute(req: RouteRequest, model: string): RouteResponse {
    const lastUser = [...req.messages].reverse().find((m) => m.role === 'user');
    const echo = typeof lastUser?.content === 'string' ? lastUser.content : 'request';
    const content = `[mock:${this.provider}] ${echo.slice(0, 200)}`;
    const promptTokens = Math.ceil(echo.length / 4) || 1;
    const completionTokens = Math.ceil(content.length / 4) || 1;
    return {
      message: { role: 'assistant', content, refusal: null } as OpenAI.ChatCompletionMessage,
      usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
      model: `mock/${model}`,
      costUsd: 0,
    };
  }
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Deterministic 8-dim embedding for mock mode. */
function mockEmbedding(text: string): number[] {
  const vec = new Array(8).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % 8] += text.charCodeAt(i);
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}
