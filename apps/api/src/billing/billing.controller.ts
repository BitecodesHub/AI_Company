import { Controller, Get, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

const CheckoutSchema = z.object({
  plan: z.enum(['pro', 'team', 'enterprise']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

@ApiTags('billing')
@ApiBearerAuth()
@Controller('v1/billing')
export class BillingController {
  @Get('subscription')
  @ApiOperation({ summary: 'Get current subscription and usage' })
  getSubscription() {
    return { plan: 'free', seats: 1, creditsUsed: 0, creditsTotal: 1000, status: 'active' };
  }

  @Post('checkout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create a Stripe checkout session' })
  createCheckout(@Body(new ZodValidationPipe(CheckoutSchema)) body: z.infer<typeof CheckoutSchema>) {
    // TODO Phase 12: create Stripe checkout + Lago subscription
    return {
      checkoutUrl: `https://checkout.stripe.com/stub?plan=${body.plan}`,
      plan: body.plan,
    };
  }

  @Post('portal')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create a Stripe customer portal session' })
  createPortal() {
    return { portalUrl: 'https://billing.stripe.com/stub' };
  }
}
