import { Controller, Get, Post, Param, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { inngest } from '../inngest/client.js';
import { validateActionArgs } from '@bitecodes/ai-controller';

const StartSessionSchema = z.object({ context: z.record(z.unknown()).optional() });
const CommandSchema = z.object({ command: z.string().min(1) });

@ApiTags('controller')
@ApiBearerAuth()
@Controller('v1/controller')
export class ControllerController {
  @Post('sessions')
  @HttpCode(201)
  @ApiOperation({ summary: 'Start an AI Controller session' })
  startSession(@Body(new ZodValidationPipe(StartSessionSchema)) _body: z.infer<typeof StartSessionSchema>) {
    const sessionId = `cs-${Date.now()}`;
    return { sessionId, status: 'active', startedAt: new Date() };
  }

  @Post('sessions/:id/command')
  @HttpCode(202)
  @ApiOperation({ summary: 'Send a natural-language command to the AI Controller' })
  async sendCommand(
    @Param('id') sessionId: string,
    @Body(new ZodValidationPipe(CommandSchema)) body: z.infer<typeof CommandSchema>,
  ) {
    await inngest.send({ name: 'controller/dispatch', data: { sessionId, command: body.command } });
    return { sessionId, command: body.command, status: 'dispatched' };
  }

  @Get('sessions/:id/actions')
  @ApiOperation({ summary: 'Get all actions taken in a Controller session' })
  getActions(@Param('id') sessionId: string) {
    return { sessionId, actions: [] };
  }
}
