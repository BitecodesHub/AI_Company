/**
 * LangfuseService — traces every model call, run, and step.
 * (ARCHITECTURE.md §20, P14-01)
 *
 * Exported as a global singleton so any service can trace without DI.
 * Traces are linked to agent_runs by runId.
 */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export interface TraceModelCallOptions {
  runId: string;
  model: string;
  costTier: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
  workspaceId?: string;
}

@Injectable()
export class LangfuseService implements OnModuleDestroy {
  private readonly logger = new Logger(LangfuseService.name);
  private client: InstanceType<typeof import('langfuse').Langfuse> | null = null;

  constructor() {
    const publicKey = process.env['LANGFUSE_PUBLIC_KEY'];
    const secretKey = process.env['LANGFUSE_SECRET_KEY'];
    if (publicKey && secretKey) {
      import('langfuse').then(({ Langfuse }) => {
        this.client = new Langfuse({
          publicKey,
          secretKey,
          baseUrl: process.env['LANGFUSE_HOST'] ?? 'https://cloud.langfuse.com',
          flushInterval: 10_000,
        });
        this.logger.log('Langfuse tracing enabled');
      }).catch((err) => this.logger.warn('Langfuse init failed:', err.message));
    } else {
      this.logger.debug('Langfuse not configured — tracing disabled (set LANGFUSE_PUBLIC_KEY + LANGFUSE_SECRET_KEY)');
    }
  }

  traceModelCall(opts: TraceModelCallOptions): void {
    if (!this.client) return;
    try {
      const trace = this.client.trace({
        id: opts.runId,
        name: 'agent-run',
        metadata: { workspaceId: opts.workspaceId },
      });
      trace.generation({
        name: 'llm-call',
        model: opts.model,
        usage: { promptTokens: opts.promptTokens, completionTokens: opts.completionTokens },
        metadata: { costUsd: opts.costUsd, latencyMs: opts.latencyMs, costTier: opts.costTier },
      });
    } catch (err) {
      this.logger.debug('Langfuse trace failed:', err);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.shutdownAsync?.();
  }
}
