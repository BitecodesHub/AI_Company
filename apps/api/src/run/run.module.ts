import { Module } from '@nestjs/common';
import { RunController } from './run.controller.js';
import { ApprovalService } from './approval.service.js';
@Module({ controllers: [RunController], providers: [ApprovalService] })
export class RunModule {}
