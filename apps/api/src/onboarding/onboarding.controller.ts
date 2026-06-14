import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { OnboardingService, ONBOARDING_STEPS, type OnboardingCtx, type OnboardingStep } from './onboarding.service.js';

const AdvanceSchema = z.object({ step: z.enum(ONBOARDING_STEPS) });

@ApiTags('onboarding')
@ApiBearerAuth()
@Controller('v1/onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  private ctx(req: Request): OnboardingCtx {
    const tc = (req as any).tenantContext;
    return { organizationId: tc?.organizationId ?? '', workspaceId: tc?.workspaceId, userId: (req as any).user?.id ?? '' };
  }

  @Get()
  @ApiOperation({ summary: 'Get the onboarding checklist state' })
  async get(@Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { completedSteps: [], currentStep: null, completedAt: null, steps: [] };
    return this.onboarding.get(ctx);
  }

  @Post('advance')
  @ApiOperation({ summary: 'Mark an onboarding step complete' })
  async advance(@Body(new ZodValidationPipe(AdvanceSchema)) body: { step: OnboardingStep }, @Req() req: Request) {
    return this.onboarding.advance(this.ctx(req), body.step);
  }
}
