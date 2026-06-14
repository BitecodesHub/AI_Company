import { Module } from '@nestjs/common';
import { OrchestrationController } from './orchestration.controller.js';
import { OrchestrationService } from './orchestration.service.js';

@Module({ controllers: [OrchestrationController], providers: [OrchestrationService] })
export class OrchestrationModule {}
