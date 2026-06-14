import { Module, Global } from '@nestjs/common';
import { BetterAuthService } from './better-auth.service.js';
import { AuthController } from './auth.controller.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [BetterAuthService],
  exports: [BetterAuthService],
})
export class AuthModule {}
