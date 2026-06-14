import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ProvidersHealthController } from './providers.controller';
import { SystemHealthController } from './system-health.controller.js';
import { SystemHealthService } from './system-health.service.js';
import { DrizzleModule } from '../drizzle/drizzle.module.js';

@Module({
  imports: [DrizzleModule],
  controllers: [HealthController, ProvidersHealthController, SystemHealthController],
  providers: [SystemHealthService],
})
export class HealthModule {}
