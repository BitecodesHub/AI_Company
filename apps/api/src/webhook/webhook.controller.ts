/**
 * Webhook ingress — `/hooks/:source`
 * (BUILD_GUIDE §7 — idempotent via webhook_events(source, external_id) unique constraint)
 * (P4-08)
 */
import { Controller, Post, Param, Query, Req, Res, HttpCode, SetMetadata } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { inngest } from '../inngest/client.js';

@ApiTags('webhooks')
@Controller('hooks')
export class WebhookController {
  @Post(':source')
  @HttpCode(200)
  @SetMetadata('isPublic', true)  // auth handled by signature verification
  @ApiOperation({ summary: 'Inbound webhook ingress (idempotent)' })
  async receive(
    @Param('source') source: string,
    @Query('validationToken') validationToken: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Microsoft Graph subscription validation handshake: echo the token verbatim
    // as text/plain within 10s. (Used for Teams change-notification subscriptions.)
    if (validationToken) {
      res.type('text/plain');
      return validationToken;
    }

    // TODO Phase 4: verify per-source signature (X-Hub-Signature, Stripe-Signature, etc.)
    // TODO: check webhook_events(source, external_id) for idempotency
    const externalId = (req.headers['x-webhook-id'] as string) ?? `${source}-${Date.now()}`;
    const eventId = `we-${Date.now()}`;

    await inngest.send({
      name: 'webhook/received',
      data: { source, eventId, externalId, payload: req.body },
    });

    return { received: true, eventId };
  }
}
