import { All, Controller, Req, Res, SetMetadata } from '@nestjs/common';
import type { Request, Response } from 'express';
import { BetterAuthService } from './better-auth.service.js';
import { toNodeHandler } from 'better-auth/node';

// All /api/auth/* routes are handled by Better Auth — exempt from our AuthGuard.
const Public = () => SetMetadata('isPublic', true);

@Public()
@Controller('api/auth')
export class AuthController {
  constructor(private readonly betterAuth: BetterAuthService) {}

  @All('*path')
  async handleAuth(@Req() req: Request, @Res() res: Response) {
    return toNodeHandler(this.betterAuth.auth)(req, res);
  }
}
