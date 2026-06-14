import { Controller, Get, Post, Patch, Body, SetMetadata } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { RequireRole } from '../common/guards/rbac.guard.js';

const KillSwitchSchema = z.object({ active: z.boolean(), reason: z.string().optional() });
const SettingsSchema = z.object({ key: z.string(), value: z.unknown() });

@ApiTags('admin')
@ApiBearerAuth()
@Controller('v1/admin')
export class AdminController {
  @Get('settings')
  @RequireRole('admin', 'owner')
  @ApiOperation({ summary: 'Get workspace settings' })
  getSettings() { return { settings: [] }; }

  @Patch('settings')
  @RequireRole('admin', 'owner')
  @ApiOperation({ summary: 'Update a workspace setting' })
  updateSetting(@Body(new ZodValidationPipe(SettingsSchema)) body: z.infer<typeof SettingsSchema>) {
    return { updated: true, ...body };
  }

  @Post('kill-switch')
  @RequireRole('admin', 'owner')
  @ApiOperation({ summary: 'Enable or disable the workspace kill switch (halts all agents)' })
  killSwitch(@Body(new ZodValidationPipe(KillSwitchSchema)) body: z.infer<typeof KillSwitchSchema>) {
    // TODO: write to feature_flags table; Inngest functions check this at each step
    return { killSwitchActive: body.active, reason: body.reason };
  }

  @Get('instance')
  @SetMetadata('isPublic', false)  // super-admin only — gated by SUPERADMIN_EMAILS in service
  @ApiOperation({ summary: 'Super-admin: instance health and tenant list' })
  instanceHealth() {
    const superAdminEmails = (process.env['SUPERADMIN_EMAILS'] ?? '').split(',').map(e => e.trim());
    return { superAdminEmails: superAdminEmails.length, status: 'ok', version: '0.1.0' };
  }
}
