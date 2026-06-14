/**
 * DrizzleService — wraps the Drizzle ORM client and exposes withTenant().
 *
 * The API connects as `bitecodes_app` (NOBYPASSRLS), so every query
 * inside withTenant() is subject to RLS.  Migrations continue to use
 * the superuser URL (DATABASE_SUPERUSER_URL) via `pnpm db:push`.
 *
 * Schema source of truth: the full `@bitecodes/db` barrel (the same schema the
 * migrations are generated from). This file no longer hand-rolls an inline
 * subset — that drifted from the real tables. `drizzle-schema-superset.spec.ts`
 * guards that every table the API references is a key on `appSchema`.
 */
import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from '@bitecodes/db';

// ── Re-export the tables the API imports from this module ─────────────────────
// (kept stable so existing `import { agents } from '../drizzle/drizzle.service'`
// call sites continue to work; new code may import from '@bitecodes/db' directly.)
export const {
  organizations, workspaces, users, sessions, accounts, verifications,
  memberships, invitations, idempotencyKeys, oauthStates, apiKeys,
  agents, agentVersions, agentTriggers, agentRuns, runSteps, approvals, employeeControls,
  agentRelationships, routingDecisions,
  conversations, conversationMessages, agentMessages, onboardingStates,
  knowledgeBases, documents, documentChunks, agentMemories,
  socialAccounts, brandVoices, contentItems, contentVariants, inboxMessages,
  auditLogs, settings, webhookEvents, notifications, featureFlags,
  subscriptions, usageRecords, creditWallets, templates, blogPosts,
  seoPages, controllerSessions, controllerActions, templateRatings,
  workflows, workflowVersions, workflowRuns,
  connectors, connectorCredentials, mcpServers, mcpTools,
} = schema;

// Explicit table map handed to drizzle (and asserted by the superset test).
export const appSchema = {
  organizations, workspaces, users, sessions, accounts, verifications,
  memberships, invitations, idempotencyKeys, oauthStates, apiKeys,
  agents, agentVersions, agentTriggers, agentRuns, runSteps, approvals, employeeControls,
  agentRelationships, routingDecisions,
  conversations, conversationMessages, agentMessages, onboardingStates,
  knowledgeBases, documents, documentChunks, agentMemories,
  socialAccounts, brandVoices, contentItems, contentVariants, inboxMessages,
  auditLogs, settings, webhookEvents, notifications, featureFlags,
  subscriptions, usageRecords, creditWallets, templates, blogPosts,
  seoPages, controllerSessions, controllerActions, templateRatings,
  workflows, workflowVersions, workflowRuns,
  connectors, connectorCredentials, mcpServers, mcpTools,
} as const;

export type DbClient = ReturnType<typeof drizzle<typeof appSchema>>;

@Injectable()
export class DrizzleService implements OnModuleDestroy {
  private readonly logger = new Logger(DrizzleService.name);
  private readonly pool: Pool;
  private readonly systemPool: Pool;
  readonly db: DbClient;
  /**
   * systemDb — a connection that BYPASSES RLS (superuser).
   * Use ONLY for pre-tenant bootstrap lookups (e.g. resolving which workspace
   * an authenticated user belongs to in TenantGuard). NEVER use for serving
   * tenant data — that must always go through withTenant() on `db`.
   */
  readonly systemDb: DbClient;

  constructor() {
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString) throw new Error('DATABASE_URL is required');

    this.pool = new Pool({ connectionString, max: 20 });
    this.db = drizzle(this.pool, { schema: appSchema });

    // System pool — superuser, bypasses RLS. Falls back to the app URL if the
    // superuser URL is not configured (RLS lookups will then need the GUC).
    const systemUrl = process.env['DATABASE_SUPERUSER_URL'] ?? connectionString;
    this.systemPool = new Pool({ connectionString: systemUrl, max: 5 });
    this.systemDb = drizzle(this.systemPool, { schema: appSchema });

    this.logger.log('DrizzleService initialized (app + system pools)');
  }

  /**
   * withTenant — wraps fn in a transaction with RLS GUCs set.
   * EVERY tenant-scoped query MUST run inside this.
   */
  async withTenant<T>(
    organizationId: string,
    workspaceId: string | undefined,
    fn: (tx: DbClient) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.current_org', ${organizationId}, true)`);
      if (workspaceId) {
        await tx.execute(sql`SELECT set_config('app.current_workspace', ${workspaceId}, true)`);
      }
      return fn(tx as unknown as DbClient);
    });
  }

  async onModuleDestroy() {
    await this.pool.end();
    await this.systemPool.end();
  }
}
