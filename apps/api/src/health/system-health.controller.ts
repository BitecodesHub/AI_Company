/**
 * GET /v1/system-health — subsystem status for the Admin → System panel.
 * Public (operational status, no tenant data), consistent with /health and
 * /v1/providers/health. Pass ?deep=1 for a live AI provider probe.
 */
import { Controller, Get, Query, SetMetadata } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SystemHealthService } from './system-health.service.js';

const Public = () => SetMetadata('isPublic', true);

@ApiTags('health')
@Controller('v1/system-health')
export class SystemHealthController {
  constructor(private readonly health: SystemHealthService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Probe DB, Redis, AI provider, Inngest, storage, auth' })
  async check(@Query('deep') deep?: string) {
    return this.health.check({ deep: deep === '1' || deep === 'true' });
  }
}
