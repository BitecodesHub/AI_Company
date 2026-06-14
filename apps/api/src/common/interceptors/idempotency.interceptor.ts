/**
 * Idempotency-Key interceptor — caches responses for mutating requests.
 * (ARCHITECTURE.md §23, BUILD_GUIDE §3, P1-17)
 *
 * If an Idempotency-Key header is present on a POST/PUT/PATCH/DELETE,
 * the first response is stored. Subsequent replays return the stored response
 * immediately without re-executing the handler.
 *
 * Stored scoped per organization_id to prevent cross-tenant key collisions.
 */
import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import { type Observable, EMPTY } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';

const IDEMPOTENT_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const cache = new Map<string, { status: number; body: unknown; at: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const key = req.headers['idempotency-key'] as string | undefined;

    if (!key || !IDEMPOTENT_METHODS.has(req.method)) {
      return next.handle();
    }

    // Scope key to org to prevent cross-tenant replay
    const orgId = (req as any).tenantContext?.organizationId ?? 'global';
    const cacheKey = `${orgId}:${key}`;

    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      res.status(cached.status);
      res.setHeader('X-Idempotency-Replayed', 'true');
      res.json(cached.body);
      // Response already sent — EMPTY completes without emitting so Nest does
      // not try to serialise a second response body.
      return EMPTY;
    }

    return next.handle().pipe(
      tap((body) => {
        cache.set(cacheKey, { status: res.statusCode, body, at: Date.now() });
        // TODO Phase 1 wire: persist to idempotency_keys table via DB service
      }),
    );
  }
}
