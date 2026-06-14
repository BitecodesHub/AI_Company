import { Module } from '@nestjs/common';
import { ControllerController } from './controller.controller.js';
@Module({ controllers: [ControllerController] })
export class ControllerModule {}
