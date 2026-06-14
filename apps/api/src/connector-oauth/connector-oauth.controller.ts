import { Controller, Get, Post, Patch, Delete, Param, Body, Redirect, Query, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

/**
 * Connector OAuth controller — central OAuth2 flow for all connectors.
 * (ARCHITECTURE.md §10, P4-03, P4-21)
 *
 * /start generates a state+PKCE pair stored in oauth_states, redirects to provider.
 * /callback verifies state, exchanges code, seals token into connector_credentials.
 */
@ApiTags('connectors')
@ApiBearerAuth()
@Controller('v1/connectors')
export class ConnectorOauthController {
  @Get()
  @ApiOperation({ summary: 'List connectors' })
  list() { return { items: [], nextCursor: null }; }

  @Post(':type/oauth/start')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start OAuth flow for a connector type' })
  async oauthStart(@Param('type') type: string) {
    // TODO Phase 4: generate PKCE, store oauth_states, return authorization_url
    const state = `state-${Date.now()}`;
    return {
      authorizationUrl: `https://provider.example.com/oauth?state=${state}&type=${type}`,
      state,
    };
  }

  @Get(':type/oauth/callback')
  @Redirect()
  @ApiOperation({ summary: 'OAuth callback — exchange code for tokens' })
  async oauthCallback(
    @Param('type') type: string,
    @Query('code') _code: string,
    @Query('state') _state: string,
  ) {
    // TODO Phase 4: verify state, exchange code, seal token, create connector row
    return { url: `${process.env['APP_URL'] ?? 'http://localhost:3000'}/settings/connectors?connected=${type}` };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update connector settings' })
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) { return { id, ...body }; }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Disconnect a connector' })
  remove(@Param('id') _id: string) { return; }
}
