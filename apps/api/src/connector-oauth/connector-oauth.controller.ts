import {
  Controller, Get, Post, Patch, Delete, Param, Body, Redirect, Query, HttpCode, Req, SetMetadata,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import {
  DrizzleService, connectors, connectorCredentials, oauthStates, socialAccounts,
} from '../drizzle/drizzle.service.js';
import { sealSecret } from './vault.js';

/** Public-route escape hatch for the OAuth callback (a browser redirect carries no bearer). */
const Public = () => SetMetadata('isPublic', true);

/** A placeholder host the UI refuses to redirect to — signals "not configured yet". */
const STUB_HOST = 'provider.example.com';
const stubUrl = (type: string) => `https://${STUB_HOST}/oauth?type=${type}`;

type ProviderConfig = {
  displayName: string;
  isSocial: boolean;
  clientIdEnv: string;
  clientSecretEnv: string;
  scopes: string[];
  authorizeUrl: () => string;
  tokenUrl: () => string;
  profileUrl?: string;
};

const msTenant = () => process.env['MICROSOFT_TENANT_ID'] || 'common';

/**
 * OAuth provider catalog. Only Microsoft Teams is wired for live exchange today;
 * other connector types fall through to the "not configured" path until built.
 */
const PROVIDERS: Record<string, ProviderConfig> = {
  teams: {
    displayName: 'Microsoft Teams',
    isSocial: true,
    clientIdEnv: 'MICROSOFT_CLIENT_ID',
    clientSecretEnv: 'MICROSOFT_CLIENT_SECRET',
    scopes: [
      'offline_access', 'openid', 'profile', 'User.Read',
      'Team.ReadBasic.All', 'Channel.ReadBasic.All', 'ChannelMessage.Read.All',
      'ChannelMessage.Send', 'Chat.Read', 'ChatMessage.Send',
    ],
    authorizeUrl: () => `https://login.microsoftonline.com/${msTenant()}/oauth2/v2.0/authorize`,
    tokenUrl: () => `https://login.microsoftonline.com/${msTenant()}/oauth2/v2.0/token`,
    profileUrl: 'https://graph.microsoft.com/v1.0/me',
  },
};

/**
 * No-config connectors — built-in capabilities that connect INSTANTLY with no
 * OAuth and no credentials, so a fresh workspace has working tools out of the box.
 */
const NO_CONFIG: Record<string, { name: string; config?: () => Record<string, unknown> }> = {
  web:     { name: 'Web Access' },
  webhook: { name: 'Inbound Webhook', config: () => ({ url: `${process.env['APP_URL'] ?? ''}/v1/webhooks/in/${crypto.randomBytes(8).toString('hex')}`, secret: crypto.randomBytes(16).toString('hex') }) },
  http:    { name: 'HTTP / REST' },
  rss:     { name: 'RSS Feeds' },
};

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

/**
 * Connector OAuth controller — central OAuth2 flow for all connectors.
 * (ARCHITECTURE.md §10, P4-03, P4-21)
 *
 * /start  → authenticated: generate state+PKCE, persist in oauth_states, return the
 *           provider authorize URL. Gated on env: no client id ⇒ "not configured".
 * /callback → public (browser redirect): verify state, exchange code, seal token into
 *           connector_credentials, create the connector (+ social account) row.
 */
@ApiTags('connectors')
@ApiBearerAuth()
@Controller('v1/connectors')
export class ConnectorOauthController {
  constructor(private readonly drizzle: DrizzleService) {}

  private ctx(req: Request) {
    const tc = (req as any).tenantContext;
    return {
      organizationId: (tc?.organizationId as string) || '',
      workspaceId: (tc?.workspaceId as string) || '',
    };
  }

  private redirectUri(type: string): string {
    return (
      process.env['MICROSOFT_REDIRECT_URI'] ||
      `${process.env['API_URL'] ?? 'http://localhost:4000'}/v1/connectors/${type}/oauth/callback`
    );
  }

  @Get()
  @ApiOperation({ summary: 'List connectors' })
  async list(@Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { items: [], nextCursor: null };
    const rows = await this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId || undefined, (tx) =>
      tx.select({
        id: connectors.id, type: connectors.type, name: connectors.name,
        status: connectors.status, createdAt: connectors.createdAt,
      }).from(connectors),
    );
    return {
      items: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      })),
      nextCursor: null,
    };
  }

  @Post(':type/oauth/start')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start OAuth flow for a connector type' })
  async oauthStart(@Param('type') type: string, @Req() req: Request) {
    const ctx = this.ctx(req);

    // No-config connectors connect INSTANTLY (no OAuth, no credentials). Idempotent.
    const builtin = NO_CONFIG[type];
    if (builtin) {
      if (!ctx.organizationId) return { connected: false, configured: true, noConfig: true };
      await this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId || undefined, async (tx) => {
        const existing = await tx.select({ id: connectors.id }).from(connectors).where(eq(connectors.type, type)).limit(1);
        if (existing.length === 0) {
          await tx.insert(connectors).values({
            organizationId: ctx.organizationId,
            workspaceId: ctx.workspaceId || null,
            type,
            name: builtin.name,
            status: 'connected',
            config: builtin.config ? builtin.config() : {},
          });
        }
      });
      return { connected: true, configured: true, noConfig: true };
    }

    const provider = PROVIDERS[type];
    const clientId = provider ? process.env[provider.clientIdEnv] : undefined;

    // Gate on env + tenant: surface a stub URL the UI maps to "not configured".
    if (!provider || !clientId || !ctx.organizationId) {
      return { authUrl: stubUrl(type), authorizationUrl: stubUrl(type), configured: false };
    }

    const state = crypto.randomBytes(24).toString('base64url');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const redirectUri = this.redirectUri(type);

    await this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId || undefined, (tx) =>
      tx.insert(oauthStates).values({
        organizationId: ctx.organizationId,
        workspaceId: ctx.workspaceId || null,
        connectorType: type,
        state,
        codeVerifier,
        redirectUri,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      }),
    );

    const url = new URL(provider.authorizeUrl());
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', provider.scopes.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return { authUrl: url.toString(), authorizationUrl: url.toString(), state, configured: true };
  }

  @Get(':type/oauth/callback')
  @Public()
  @Redirect()
  @ApiOperation({ summary: 'OAuth callback — exchange code for tokens' })
  async oauthCallback(
    @Param('type') _type: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
  ) {
    const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000';
    const back = (q: string) => ({ url: `${appUrl}/app/connectors?${q}` });
    if (error) return back(`error=${encodeURIComponent(error)}`);
    if (!code || !state) return back('error=missing_code');

    // State lookup bypasses RLS (no tenant context on a browser redirect).
    const stRows = await this.drizzle.systemDb
      .select().from(oauthStates).where(eq(oauthStates.state, state)).limit(1);
    const st = stRows[0];
    if (!st) return back('error=invalid_state');
    if (st.expiresAt.getTime() < Date.now()) {
      await this.drizzle.systemDb.delete(oauthStates).where(eq(oauthStates.id, st.id));
      return back('error=expired_state');
    }

    const provider = PROVIDERS[st.connectorType];
    const clientId = provider ? process.env[provider.clientIdEnv] : undefined;
    const clientSecret = provider ? process.env[provider.clientSecretEnv] : undefined;
    if (!provider || !clientId || !clientSecret) return back('error=not_configured');

    // Exchange the authorization code for tokens.
    const tokenRes = await fetch(provider.tokenUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: st.redirectUri,
        code_verifier: st.codeVerifier ?? '',
        scope: provider.scopes.join(' '),
      }),
    });
    const token = (await tokenRes.json().catch(() => ({}))) as TokenResponse;
    if (!tokenRes.ok || !token.access_token) {
      await this.drizzle.systemDb.delete(oauthStates).where(eq(oauthStates.id, st.id));
      return back('error=token_exchange_failed');
    }

    // Best-effort profile fetch for the account handle.
    let handle = provider.displayName;
    if (provider.profileUrl) {
      try {
        const meRes = await fetch(provider.profileUrl, {
          headers: { Authorization: `Bearer ${token.access_token}` },
        });
        if (meRes.ok) {
          const me = (await meRes.json()) as Record<string, unknown>;
          handle = (me['userPrincipalName'] as string) || (me['displayName'] as string) || handle;
        }
      } catch {
        // non-fatal — fall back to the provider display name
      }
    }

    const sealed = await sealSecret(JSON.stringify({
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      scope: token.scope ?? provider.scopes.join(' '),
      token_type: token.token_type ?? 'Bearer',
    }));
    const tokenExpiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null;

    await this.drizzle.withTenant(st.organizationId, st.workspaceId ?? undefined, async (tx) => {
      const inserted = await tx.insert(connectors).values({
        organizationId: st.organizationId,
        workspaceId: st.workspaceId ?? null,
        type: st.connectorType,
        name: provider.displayName,
        status: 'connected',
      }).returning({ id: connectors.id });
      const connectorId = inserted[0]!.id;

      await tx.insert(connectorCredentials).values({
        connectorId,
        organizationId: st.organizationId,
        workspaceId: st.workspaceId ?? null,
        encryptedSecret: sealed,
        tokenExpiresAt,
      });

      if (provider.isSocial) {
        await tx.insert(socialAccounts).values({
          organizationId: st.organizationId,
          workspaceId: st.workspaceId ?? null,
          platform: st.connectorType as 'teams',
          handle,
          connectorId,
          status: 'active',
        });
      }

      await tx.delete(oauthStates).where(eq(oauthStates.id, st.id));
    });

    return back(`connected=${st.connectorType}`);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update connector settings' })
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>, @Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { id, ...body };
    const patch: Record<string, unknown> = {};
    if (typeof body['name'] === 'string') patch['name'] = body['name'];
    if (typeof body['status'] === 'string') patch['status'] = body['status'];
    if (body['config'] !== undefined) patch['config'] = body['config'];
    if (Object.keys(patch).length === 0) return { id };
    const rows = await this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId || undefined, (tx) =>
      tx.update(connectors).set(patch).where(eq(connectors.id, id)).returning(),
    );
    return rows[0] ?? { id };
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Disconnect a connector' })
  async remove(@Param('id') id: string, @Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return;
    await this.drizzle.withTenant(ctx.organizationId, ctx.workspaceId || undefined, async (tx) => {
      await tx.delete(connectorCredentials).where(eq(connectorCredentials.connectorId, id));
      await tx.delete(connectors).where(eq(connectors.id, id));
    });
  }
}
