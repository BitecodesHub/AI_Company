import { Module } from '@nestjs/common';
import { InngestController } from './inngest.controller.js';

@Module({ controllers: [InngestController] })
export class InngestModule {}
