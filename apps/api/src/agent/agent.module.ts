import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller.js';
import { AgentService } from './agent.service.js';
import { ControlsController } from './controls.controller.js';
import { ControlsService } from './controls.service.js';
import { TriggerController } from './trigger.controller.js';
import { TriggerService } from './trigger.service.js';
import { OnboardingModule } from '../onboarding/onboarding.module.js';
@Module({
  imports: [OnboardingModule],
  controllers: [AgentController, ControlsController, TriggerController],
  providers: [AgentService, ControlsService, TriggerService],
  exports: [AgentService, ControlsService],
})
export class AgentModule {}
