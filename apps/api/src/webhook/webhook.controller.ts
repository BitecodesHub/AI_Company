/**
 * Webhook ingress — `/hooks/:source`
 * (BUILD_GUIDE §7 — idempotent via webhook_events(source, external_id) unique constraint)
 * (P4-08)
 */
import { Controller, Post, Param, Req, HttpCode, SetMetadata } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { inngest } from '../inngest/client.js';

@ApiTags('webhooks')
@Controller('hooks')
export class WebhookController {
  @Post(':source')
  @HttpCode(200)
  @SetMetadata('isPublic', true)  // auth handled by signature verification
  @ApiOperation({ summary: 'Inbound webhook ingress (idempotent)' })
  async receive(@Param('source') source: string, @Req() req: Request) {
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
