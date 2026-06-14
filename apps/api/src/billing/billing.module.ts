import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller.js';
import { BillingWebhookController } from './billing-webhook.controller.js';
@Module({ controllers: [BillingController, BillingWebhookController] })
export class BillingModule {}
