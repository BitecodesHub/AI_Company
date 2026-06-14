/**
 * DrizzleModule — global singleton providing `DrizzleService` to every module.
 * Imports schema directly (no @bitecodes/db ESM resolution issues at runtime).
 */
import { Module, Global } from '@nestjs/common';
import { DrizzleService } from './drizzle.service.js';

@Global()
@Module({
  providers: [DrizzleService],
  exports: [DrizzleService],
})
export class DrizzleModule {}
