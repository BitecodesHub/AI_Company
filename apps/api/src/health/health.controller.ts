import { Controller, Get, HttpCode, SetMetadata } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SystemHealthService } from './system-health.service.js';

const Public = () => SetMetadata('isPublic', true);

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly systemHealth: SystemHealthService) {}

  @Get('health')
  @HttpCode(200)
  @Public()
  @ApiOperation({ summary: 'Liveness probe' })
  health() {
    return { status: 'ok' };
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness probe — real DB + Redis connectivity' })
  async ready() {
    return this.systemHealth.ready();
  }
}
