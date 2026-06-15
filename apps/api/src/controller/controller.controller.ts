import { Controller, Get, Post, Param, Body, HttpCode, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ControllerService } from './controller.service.js';

const StartSessionSchema = z.object({ context: z.record(z.unknown()).optional() });
const CommandSchema = z.object({ command: z.string().min(1) });

@ApiTags('controller')
@ApiBearerAuth()
@Controller('v1/controller')
export class ControllerController {
  constructor(private readonly controller: ControllerService) {}

  private ctx(req: Request) {
    const tc = (req as any).tenantContext;
    const user = (req as any).user;
    return {
      organizationId: tc?.organizationId ?? '',
      workspaceId: tc?.workspaceId ?? '',
      userId: user?.id ?? '',
      role: tc?.role ?? user?.role,
    };
  }

  @Post('sessions')
  @HttpCode(201)
  @ApiOperation({ summary: 'Start an AI Controller session' })
  startSession(@Body(new ZodValidationPipe(StartSessionSchema)) _body: z.infer<typeof StartSessionSchema>) {
    const sessionId = `cs-${Date.now()}`;
    return { sessionId, status: 'active', startedAt: new Date() };
  }

  @Post('sessions/:id/command')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a natural-language command to the AI Controller' })
  async sendCommand(
    @Param('id') sessionId: string,
    @Body(new ZodValidationPipe(CommandSchema)) body: z.infer<typeof CommandSchema>,
    @Req() req: Request,
  ) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) {
      return { sessionId, command: body.command, summary: 'Please sign in to use the AI Controller.', actions: [], clientActions: [] };
    }
    return this.controller.dispatch(sessionId, body.command, ctx);
  }

  @Get('sessions/:id/actions')
  @ApiOperation({ summary: 'Get all actions taken in a Controller session' })
  getActions(@Param('id') sessionId: string) {
    return this.controller.getSession(sessionId);
  }
}
