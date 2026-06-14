/**
 * Rate limit guard using @nestjs/throttler.
 * Per-workspace and per-IP limits — prevents abuse on auth + public endpoints.
 * (ARCHITECTURE.md §18, P14-05)
 */
import { Injectable, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

@Injectable()
export class WorkspaceRateLimitGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // Prefer workspace-scoped rate limiting over IP
    const workspaceId = req.headers['x-bitecodes-workspace'] as string | undefined;
    return workspaceId ?? req.ip ?? 'global';
  }

  protected throwThrottlingException(): never {
    const { HttpException, HttpStatus } = require('@nestjs/common');
    throw new HttpException(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
