import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DrizzleService } from '../drizzle/drizzle.service.js';
import { organizations, workspaces } from '../drizzle/drizzle.service.js';
import crypto from 'node:crypto';

@Injectable()
export class OrgService {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(input: { name: string; slug: string; userId: string }) {
    // Orgs are global (not tenant-scoped) — insert without RLS context
    const existing = await this.drizzle.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, input.slug))
      .limit(1);

    if (existing.length) {
      throw new ConflictException({ code: 'CONFLICT', message: `Slug '${input.slug}' is already taken.` });
    }

    const id = crypto.randomUUID();
    const [org] = await this.drizzle.db
      .insert(organizations)
      .values({ id, name: input.name, slug: input.slug, plan: 'free' })
      .returning();
    return org;
  }

  async listForUser(userId: string) {
    // Return orgs the user is a member of
    const { memberships } = this.drizzle.db._.schema as any;
    const rows = await this.drizzle.db
      .select({ org: organizations })
      .from(organizations)
      .innerJoin(memberships, eq(memberships.organizationId, organizations.id))
      .where(eq(memberships.userId, userId));
    return rows.map(r => r.org);
  }

  async findById(orgId: string) {
    const [org] = await this.drizzle.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    if (!org) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Organization not found.' });
    return org;
  }

  async update(orgId: string, data: Partial<{ name: string; branding: unknown; settings: unknown }>) {
    const [updated] = await this.drizzle.db
      .update(organizations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organizations.id, orgId))
      .returning();
    if (!updated) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Organization not found.' });
    return updated;
  }
}
