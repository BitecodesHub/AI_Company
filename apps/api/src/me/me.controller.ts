/**
 * GET /v1/me — the authenticated user's identity + active tenant context.
 *
 * Returns the current user, the active org/workspace + role (from the resolved
 * tenant context), and every workspace the user can switch to. The workspace
 * list is the user's own membership data, read via the system connection
 * (bootstrap lookup, same trust model as TenantGuard) — never another tenant's.
 */
import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import { DrizzleService, memberships, workspaces, organizations } from '../drizzle/drizzle.service.js';

@ApiTags('session')
@ApiBearerAuth()
@Controller('v1/me')
export class MeController {
  constructor(private readonly drizzle: DrizzleService) {}

  @Get()
  @ApiOperation({ summary: 'Current user, active tenant, role, and switchable workspaces' })
  async me(@Req() req: Request) {
    const user = (req as any).user as { id: string; email?: string; name?: string } | undefined;
    const tc = (req as any).tenantContext as
      | { organizationId: string; workspaceId?: string; role: string }
      | undefined;

    if (!user) return { user: null, org: null, workspace: null, role: null, workspaces: [] };

    // All active workspace memberships for this user, with org + workspace names.
    const rows = await this.drizzle.systemDb
      .select({
        workspaceId: memberships.workspaceId,
        role: memberships.role,
        organizationId: memberships.organizationId,
        orgName: organizations.name,
        orgSlug: organizations.slug,
        workspaceName: workspaces.name,
        workspaceSlug: workspaces.slug,
      })
      .from(memberships)
      .leftJoin(organizations, eq(organizations.id, memberships.organizationId))
      .leftJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
      .where(and(eq(memberships.userId, user.id), isNull(memberships.deactivatedAt)));

    const workspaceList = rows
      .filter((r) => r.workspaceId)
      .map((r) => ({
        id: r.workspaceId,
        name: r.workspaceName,
        slug: r.workspaceSlug,
        organizationId: r.organizationId,
        organizationName: r.orgName,
        role: r.role,
      }));

    const active = tc?.workspaceId
      ? workspaceList.find((w) => w.id === tc.workspaceId)
      : workspaceList[0];

    return {
      user: { id: user.id, email: user.email ?? null, name: user.name ?? null },
      org: active
        ? { id: active.organizationId, name: active.organizationName, slug: rows.find((r) => r.organizationId === active.organizationId)?.orgSlug ?? null }
        : null,
      workspace: active ? { id: active.id, name: active.name, slug: active.slug } : null,
      role: tc?.role ?? active?.role ?? null,
      workspaces: workspaceList,
    };
  }
}
