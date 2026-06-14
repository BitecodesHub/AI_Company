/**
 * TenantGuard — resolves the tenant context for the request.
 *
 * Resolution order:
 *   1. If x-bitecodes-workspace header is present → validate membership, use it.
 *   2. If absent → fall back to the user's FIRST membership (their default workspace).
 *
 * Attaches { organizationId, workspaceId, role } to req.tenantContext and
 * req.memberRole (for RbacGuard). Throws TENANT_MISMATCH if the requested
 * workspace is not one the user belongs to.
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq, and } from 'drizzle-orm';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './auth.guard.js';
import { DrizzleService, workspaces, memberships } from '../../drizzle/drizzle.service.js';

const WORKSPACE_HEADER = 'x-bitecodes-workspace';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly drizzle: DrizzleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector?.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const user = (req as any).user;
    if (!user) return true; // AuthGuard already handled unauthenticated

    const headerWs = req.headers[WORKSPACE_HEADER] as string | undefined;

    if (headerWs) {
      // ── Explicit workspace selection ──────────────────────────────────────
      if (!UUID_RE.test(headerWs)) {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: `Invalid workspace ID format in ${WORKSPACE_HEADER}`,
        });
      }

      const wsRows = await this.drizzle.systemDb
        .select({ id: workspaces.id, organizationId: workspaces.organizationId })
        .from(workspaces)
        .where(eq(workspaces.id, headerWs))
        .limit(1);

      if (!wsRows.length) {
        throw new ForbiddenException({ code: 'TENANT_MISMATCH', message: 'Workspace not found.' });
      }
      const ws = wsRows[0]!;

      const memberRows = await this.drizzle.systemDb
        .select({ role: memberships.role })
        .from(memberships)
        .where(and(
          eq(memberships.userId, user.id),
          eq(memberships.organizationId, ws.organizationId),
          eq(memberships.workspaceId, headerWs),
        ))
        .limit(1);

      if (!memberRows.length) {
        throw new ForbiddenException({ code: 'TENANT_MISMATCH', message: 'You are not a member of this workspace.' });
      }

      (req as any).tenantContext = {
        organizationId: ws.organizationId,
        workspaceId: headerWs,
        role: memberRows[0]!.role,
      };
      (req as any).memberRole = memberRows[0]!.role;
      return true;
    }

    // ── No header → resolve the user's default (first) workspace ────────────
    const defaultMembership = await this.drizzle.systemDb
      .select({
        organizationId: memberships.organizationId,
        workspaceId: memberships.workspaceId,
        role: memberships.role,
      })
      .from(memberships)
      .where(eq(memberships.userId, user.id))
      .limit(1);

    if (defaultMembership.length && defaultMembership[0]!.workspaceId) {
      const m = defaultMembership[0]!;
      (req as any).tenantContext = {
        organizationId: m.organizationId,
        workspaceId: m.workspaceId,
        role: m.role,
      };
      (req as any).memberRole = m.role;
    }
    // If the user has no membership yet, proceed without tenant context
    // (endpoints that need it return their no-workspace fallback).
    return true;
  }
}
