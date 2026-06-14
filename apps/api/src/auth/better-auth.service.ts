import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import crypto from 'node:crypto';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, text, boolean, timestamp, uuid, pgEnum } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

// Minimal inline Drizzle schema matching Better Auth's expected table shapes.
// These must match the actual DB tables created during pnpm db:push.
// Using the exact column names Better Auth expects by default.
const users = pgTable('users', {
  id:            text('id').primaryKey(),
  name:          text('name').notNull(),
  email:         text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image:         text('image'),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().default(sql`now()`),
});

const sessions = pgTable('sessions', {
  id:         text('id').primaryKey(),
  expiresAt:  timestamp('expires_at', { withTimezone: true }).notNull(),
  token:      text('token').notNull().unique(),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt:  timestamp('updated_at', { withTimezone: true }).notNull(),
  ipAddress:  text('ip_address'),
  userAgent:  text('user_agent'),
  userId:     text('user_id').notNull(),
});

const accounts = pgTable('accounts', {
  id:                     text('id').primaryKey(),
  accountId:              text('account_id').notNull(),
  providerId:             text('provider_id').notNull(),
  userId:                 text('user_id').notNull(),
  accessToken:            text('access_token'),
  refreshToken:           text('refresh_token'),
  idToken:                text('id_token'),
  accessTokenExpiresAt:  timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope:                  text('scope'),
  password:               text('password'),
  createdAt:              timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt:              timestamp('updated_at', { withTimezone: true }).notNull(),
});

const verifications = pgTable('verifications', {
  id:         text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value:      text('value').notNull(),
  expiresAt:  timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt:  timestamp('created_at', { withTimezone: true }),
  updatedAt:  timestamp('updated_at', { withTimezone: true }),
});

const authSchema = { users, sessions, accounts, verifications };
type BetterAuthInstance = ReturnType<typeof betterAuth>;

@Injectable()
export class BetterAuthService implements OnModuleInit {
  private readonly logger = new Logger(BetterAuthService.name);
  private _auth!: BetterAuthInstance;

  get auth(): BetterAuthInstance {
    return this._auth;
  }

  onModuleInit() {
    const pool = new Pool({
      connectionString: process.env['DATABASE_URL'],
      max: 10,
    });

    const db = drizzle(pool, { schema: authSchema });

    this._auth = betterAuth({
      database: drizzleAdapter(db, {
        provider: 'pg',
        // Map Better Auth's model names to our table variable names
        schema: {
          user:         users,
          session:      sessions,
          account:      accounts,
          verification: verifications,
        },
      }),
      // Generate UUIDs to match our uuid() column type in Postgres
      advanced: {
        generateId: () => crypto.randomUUID(),
      },
      // Trust all local dev origins so CORS works from the Next.js web app
      trustedOrigins: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        process.env['APP_URL'] ?? 'http://localhost:3002',
      ],
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
      },
      socialProviders: {
        ...(process.env['GOOGLE_CLIENT_ID']
          ? {
              google: {
                clientId: process.env['GOOGLE_CLIENT_ID'] as string,
                clientSecret: process.env['GOOGLE_CLIENT_SECRET'] as string,
              },
            }
          : {}),
        ...(process.env['GITHUB_CLIENT_ID']
          ? {
              github: {
                clientId: process.env['GITHUB_CLIENT_ID'] as string,
                clientSecret: process.env['GITHUB_CLIENT_SECRET'] as string,
              },
            }
          : {}),
      },
      secret: process.env['AUTH_SECRET'] ?? 'dev-secret-change-me',
      baseURL: process.env['AUTH_URL'] ?? process.env['API_URL'] ?? 'http://localhost:4000',
      basePath: '/api/auth',
      // ── First-run hook: auto-create org + workspace + owner membership ────────
      databaseHooks: {
        user: {
          create: {
            after: async (user) => {
              try {
                const slug = user.email
                  .split('@')[0]!
                  .toLowerCase()
                  .replace(/[^a-z0-9]/g, '-')
                  .slice(0, 40);
                const orgId = crypto.randomUUID();
                const wsId  = crypto.randomUUID();
                const memId = crypto.randomUUID();

                // Use SUPERUSER URL for this hook so it bypasses RLS
                const superPool = new Pool({
                  connectionString:
                    process.env['DATABASE_SUPERUSER_URL'] ??
                    process.env['DATABASE_URL'],
                });
                try {
                  await superPool.query(
                    `INSERT INTO organizations (id, name, slug, plan, created_at, updated_at)
                     VALUES ($1, $2, $3, 'free', now(), now())`,
                    [orgId, `${user.name}'s workspace`, slug],
                  );
                  await superPool.query(
                    `INSERT INTO workspaces (id, organization_id, name, slug, created_at, updated_at)
                     VALUES ($1, $2, 'Default', 'default', now(), now())`,
                    [wsId, orgId],
                  );
                  await superPool.query(
                    `INSERT INTO memberships (id, user_id, organization_id, workspace_id, role, created_at)
                     VALUES ($1, $2, $3, $4, 'owner', now())`,
                    [memId, user.id, orgId, wsId],
                  );
                  this.logger.log(`Auto-provisioned org ${orgId} + workspace ${wsId} for user ${user.id}`);
                } finally {
                  await superPool.end();
                }
              } catch (err) {
                this.logger.error('Failed to auto-provision workspace:', err);
              }
            },
          },
        },
      },
    });

    this.logger.log('Better Auth initialized with Drizzle adapter (inline schema)');
  }
}
