/**
 * GET /v1/providers/health — probe the single active AI provider.
 *
 * Returns the configured provider plus a live chat probe and an embeddings
 * probe. Used by setup validation and the Admin → System panel. Exposes only
 * configuration + reachability (no tenant data), so it is public and works
 * before login — consistent with /health and /ready (BUILD_GUIDE §7).
 *
 * Honours AI_GATEWAY_MODE=mock (no network). Never throws on a provider being
 * down — it reports `ok:false` with a clear message instead.
 */
import { Controller, Get, SetMetadata } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ModelRouter, EmbeddingsUnavailableError } from '@bitecodes/ai-core';

const Public = () => SetMetadata('isPublic', true);

interface ChatProbe {
  ok: boolean;
  model: string;
  latencyMs?: number;
  error?: string;
}
interface EmbeddingsProbe {
  ok: boolean;
  disabled?: boolean;
  provider: string;
  model?: string;
  error?: string;
}
interface ProvidersHealth {
  provider: string;
  mode: 'mock' | 'live';
  chat: ChatProbe;
  embeddings: EmbeddingsProbe;
}

@ApiTags('health')
@Controller('v1/providers')
export class ProvidersHealthController {
  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Probe the active AI provider (chat + embeddings)' })
  async health(): Promise<ProvidersHealth> {
    const router = new ModelRouter();
    const provider = router.getProvider();
    const mode = router.isMock() ? 'mock' : 'live';
    const model = router.getModelForTier('smart');

    const chat = await this.probeChat(router, model);
    const embeddings = await this.probeEmbeddings(router);

    return { provider, mode, chat, embeddings };
  }

  private async probeChat(router: ModelRouter, model: string): Promise<ChatProbe> {
    const startedAtMs = performance.now();
    try {
      await router.route({
        messages: [{ role: 'user', content: 'ping' }],
        costTier: 'fast',
        maxTokens: 1,
        temperature: 0,
      });
      return { ok: true, model, latencyMs: Math.round(performance.now() - startedAtMs) };
    } catch (err) {
      return { ok: false, model, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async probeEmbeddings(router: ModelRouter): Promise<EmbeddingsProbe> {
    const provider = process.env['EMBEDDING_PROVIDER'] ?? 'ollama';
    const embModel = process.env['EMBEDDING_MODEL'];
    try {
      const [vec] = await router.embed(['ping']);
      return { ok: Array.isArray(vec) && vec.length > 0, provider, model: embModel };
    } catch (err) {
      if (err instanceof EmbeddingsUnavailableError && err.provider === 'none') {
        return { ok: false, disabled: true, provider: 'none' };
      }
      return { ok: false, provider, model: embModel, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
