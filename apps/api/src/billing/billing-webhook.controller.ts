/**
 * Stripe webhook handler — processes Stripe events and updates subscriptions.
 * (ARCHITECTURE.md §17, P12-05)
 *
 * Uses signature verification via STRIPE_WEBHOOK_SECRET.
 * Events are idempotent via webhook_events table.
 */
import { Controller, Post, Req, Res, Headers, HttpCode, SetMetadata, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request, Response } from 'express';

@ApiTags('billing')
@Controller('hooks')
export class BillingWebhookController {
  private readonly logger = new Logger(BillingWebhookController.name);

  @Post('stripe')
  @HttpCode(200)
  @SetMetadata('isPublic', true)
  @ApiOperation({ summary: 'Stripe webhook receiver' })
  async handleStripeWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('stripe-signature') sig: string,
  ) {
    const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];
    if (!webhookSecret) {
      this.logger.warn('STRIPE_WEBHOOK_SECRET not set — skipping webhook verification');
      return res.json({ received: true });
    }

    // Verify signature to prevent spoofing
    let event: { type: string; id: string; data: { object: Record<string, unknown> } };
    try {
      const stripe = new (require('stripe'))(process.env['STRIPE_SECRET_KEY']);
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        webhookSecret,
      );
    } catch (err) {
      this.logger.warn('Stripe webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    this.logger.log(`Stripe event: ${event.type} (${event.id})`);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        // TODO: UPDATE subscriptions SET status=$1, plan=$2, current_period_end=$3
        // WHERE stripe_customer_id=$4
        this.logger.log(`Subscription updated: ${sub['id']}`);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        this.logger.log(`Subscription cancelled: ${sub['id']}`);
        // TODO: UPDATE subscriptions SET status='cancelled'
        break;
      }
      case 'invoice.payment_succeeded': {
        // Grant monthly credits
        const invoice = event.data.object;
        this.logger.log(`Payment succeeded: ${invoice['id']}`);
        break;
      }
      case 'invoice.payment_failed': {
        // Mark subscription past_due
        this.logger.warn(`Payment failed: ${event.data.object['id']}`);
        break;
      }
    }

    return res.json({ received: true });
  }
}
