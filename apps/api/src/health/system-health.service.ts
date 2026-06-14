/**
 * SystemHealthService — real subsystem probes for the /system-health panel and
 * the /ready readiness gate.
 *
 * DB and Redis are probed live (cheap). The AI provider, Inngest, storage, and
 * auth are reported from configuration by default (a shallow check) so a polled
 * dashboard never burns tokens or hammers providers; pass `deep` to also make a
 * real AI provider call. Every probe is wrapped — a down subsystem degrades the
 * report, it never throws.
 */
import { Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { ModelRouter } from '@bitecodes/ai-core';
import { DrizzleService } from '../drizzle/drizzle.service.js';

export type ProbeStatus = 'ok' | 'degraded' | 'down';
export interface Probe {
  name: string;
  status: ProbeStatus;
  latencyMs?: number;
  detail?: string;
  error?: string;
}
export interface SystemHealth {
  status: ProbeStatus;
  checkedAt: string;
  probes: Probe[];
}

@Injectable()
export class SystemHealthService {
  private readonly logger = new Logger(SystemHealthService.name);
  constructor(private readonly drizzle: DrizzleService) {}

  async check(opts: { deep?: boolean } = {}): Promise<SystemHealth> {
    const probes = await Promise.all([
      this.probeDb(),
      this.probeRedis(),
      this.probeAiProvider(opts.deep ?? false),
      this.probeInngest(),
      this.probeStorage(),
      this.probeAuth(),
    ]);
    // Overall = worst probe. 'down' > 'degraded' > 'ok'.
    const rank = { ok: 0, degraded: 1, down: 2 } as const;
    const worst = probes.reduce<ProbeStatus>((acc, p) => (rank[p.status] > rank[acc] ? p.status : acc), 'ok');
    return { status: worst, checkedAt: new Date().toISOString(), probes };
  }

  /** DB + Redis only — used by /ready. */
  async ready(): Promise<{ status: ProbeStatus; probes: Probe[] }> {
    const probes = [await this.probeDb(), await this.probeRedis()];
    const down = probes.some((p) => p.status === 'down');
    return { status: down ? 'down' : 'ok', probes };
  }

  private async probeDb(): Promise<Probe> {
    const t = performance.now();
    try {
      await this.drizzle.systemDb.execute(sql`SELECT 1`);
      return { name: 'database', status: 'ok', latencyMs: Math.round(performance.now() - t) };
    } catch (err) {
      return { name: 'database', status: 'down', error: msg(err) };
    }
  }

  private async probeRedis(): Promise<Probe> {
    const url = process.env['REDIS_URL'];
    if (!url) return { name: 'redis', status: 'degraded', detail: 'REDIS_URL not set' };
    const t = performance.now();
    const client = new Redis(url, { lazyConnect: true, connectTimeout: 2000, maxRetriesPerRequest: 1, retryStrategy: () => null });
    client.on('error', () => {}); // connect() rejection is handled below; avoid an unhandled 'error' event
    try {
      await client.connect();
      await client.ping();
      return { name: 'redis', status: 'ok', latencyMs: Math.round(performance.now() - t) };
    } catch (err) {
      return { name: 'redis', status: 'down', error: msg(err) };
    } finally {
      client.disconnect();
    }
  }

  private async probeAiProvider(deep: boolean): Promise<Probe> {
    try {
      const router = new ModelRouter();
      const provider = router.getProvider();
      const mode = router.isMock() ? 'mock' : 'live';

      if (mode === 'mock') return { name: 'ai_provider', status: 'ok', detail: `${provider} (mock mode)` };

      // Shallow: required config present?
      if (provider === 'openrouter' && !process.env['OPENROUTER_API_KEY']) {
        return { name: 'ai_provider', status: 'degraded', detail: 'openrouter: OPENROUTER_API_KEY not set' };
      }
      if (!deep) {
        return { name: 'ai_provider', status: 'ok', detail: `${provider} (configured; use ?deep=1 for a live probe)` };
      }
      // Deep: one tiny live completion.
      const t = performance.now();
      await router.route({ messages: [{ role: 'user', content: 'ping' }], costTier: 'fast', maxTokens: 1, temperature: 0 });
      return { name: 'ai_provider', status: 'ok', latencyMs: Math.round(performance.now() - t), detail: `${provider} (live)` };
    } catch (err) {
      return { name: 'ai_provider', status: 'down', error: msg(err) };
    }
  }

  private probeInngest(): Probe {
    const configured = !!process.env['INNGEST_EVENT_KEY'];
    const dev = process.env['INNGEST_DEV'] === '1';
    return configured
      ? { name: 'inngest', status: 'ok', detail: dev ? 'dev server' : 'configured' }
      : { name: 'inngest', status: 'degraded', detail: 'INNGEST_EVENT_KEY not set' };
  }

  private probeStorage(): Probe {
    return process.env['S3_ENDPOINT']
      ? { name: 'storage', status: 'ok', detail: process.env['S3_ENDPOINT'] }
      : { name: 'storage', status: 'degraded', detail: 'S3_ENDPOINT not set' };
  }

  private probeAuth(): Probe {
    return process.env['AUTH_SECRET']
      ? { name: 'auth', status: 'ok' }
      : { name: 'auth', status: 'down', detail: 'AUTH_SECRET not set' };
  }
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
