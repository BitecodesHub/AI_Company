import { Module } from '@nestjs/common';
import { ControllerController } from './controller.controller.js';
import { ControllerService } from './controller.service.js';
import { AgentModule } from '../agent/agent.module.js';

@Module({
  imports: [AgentModule],
  controllers: [ControllerController],
  providers: [ControllerService],
})
export class ControllerModule {}
