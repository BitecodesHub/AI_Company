/**
 * MemberService — real member + invitation persistence, tenant-scoped.
 *
 * All reads/writes run inside withTenant so RLS applies. Invitation acceptance
 * uses the system connection because the accepting user is not yet a member of
 * the target tenant (bootstrap, same trust model as TenantGuard).
 */
import { Injectable } from '@nestjs/common';
import { eq, and, isNull, desc } from 'drizzle-orm';
import crypto from 'node:crypto';
import { DrizzleService, memberships, users, invitations } from '../drizzle/drizzle.service.js';
import type { Role } from '@bitecodes/shared';

export interface TenantCtx {
  organizationId: string;
  workspaceId?: string;
  userId: string;
}

const INVITE_TTL_DAYS = 7;

@Injectable()
export class MemberService {
  constructor(private readonly drizzle: DrizzleService) {}

  /** Active members of the current org, with user identity + role + status. */
  async list(ctx: TenantCtx) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const rows = await tx
        .select({
          id: memberships.id,
          userId: memberships.userId,
          role: memberships.role,
          deactivatedAt: memberships.deactivatedAt,
          joinedAt: memberships.createdAt,
          email: users.email,
          name: users.name,
        })
        .from(memberships)
        .leftJoin(users, eq(users.id, memberships.userId))
        .where(eq(memberships.organizationId, ctx.organizationId))
        .orderBy(desc(memberships.createdAt));

      return {
        items: rows.map((r) => ({
          id: r.id,
          userId: r.userId,
          email: r.email,
          name: r.name,
          role: r.role,
          status: r.deactivatedAt ? 'deactivated' : 'active',
          joinedAt: r.joinedAt,
        })),
        nextCursor: null,
      };
    });
  }

  async listInvitations(ctx: TenantCtx) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const rows = await tx
        .select({
          id: invitations.id,
          email: invitations.email,
          role: invitations.role,
          expiresAt: invitations.expiresAt,
          acceptedAt: invitations.acceptedAt,
          createdAt: invitations.createdAt,
        })
        .from(invitations)
        .where(and(eq(invitations.organizationId, ctx.organizationId), isNull(invitations.acceptedAt)))
        .orderBy(desc(invitations.createdAt));
      return { items: rows, nextCursor: null };
    });
  }

  async invite(ctx: TenantCtx, input: { email: string; role: Role; workspaceId?: string }) {
    const token = crypto.randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [row] = await tx
        .insert(invitations)
        .values({
          organizationId: ctx.organizationId,
          workspaceId: input.workspaceId ?? ctx.workspaceId ?? null,
          email: input.email.toLowerCase(),
          role: input.role,
          token,
          expiresAt,
        })
        .returning({ id: invitations.id, email: invitations.email, role: invitations.role, expiresAt: invitations.expiresAt });
      return { ...row!, token };
    });
  }

  /** Accept an invitation: create (or reactivate) the membership for the user. */
  async accept(token: string, userId: string) {
    const db = this.drizzle.systemDb;
    const [inv] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);
    if (!inv) return { accepted: false, reason: 'INVITATION_NOT_FOUND' };
    if (inv.acceptedAt) return { accepted: false, reason: 'ALREADY_ACCEPTED' };
    if (inv.expiresAt.getTime() < Date.now()) return { accepted: false, reason: 'EXPIRED' };

    const [existing] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.organizationId, inv.organizationId)))
      .limit(1);

    if (existing) {
      await db.update(memberships).set({ deactivatedAt: null, role: inv.role }).where(eq(memberships.id, existing.id));
    } else {
      await db.insert(memberships).values({
        userId,
        organizationId: inv.organizationId,
        workspaceId: inv.workspaceId,
        role: inv.role,
      });
    }
    await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, inv.id));
    return { accepted: true, organizationId: inv.organizationId, role: inv.role };
  }

  async updateRole(ctx: TenantCtx, membershipId: string, role: Role) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      const [row] = await tx
        .update(memberships)
        .set({ role })
        .where(and(eq(memberships.id, membershipId), eq(memberships.organizationId, ctx.organizationId)))
        .returning({ id: memberships.id, role: memberships.role });
      return row ?? null;
    });
  }

  /** Soft-delete: keep the row, set deactivated_at so access is revoked. */
  async deactivate(ctx: TenantCtx, membershipId: string) {
    return this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId, async (tx) => {
      await tx
        .update(memberships)
        .set({ deactivatedAt: new Date() })
        .where(and(eq(memberships.id, membershipId), eq(memberships.organizationId, ctx.organizationId)));
    });
  }
}
