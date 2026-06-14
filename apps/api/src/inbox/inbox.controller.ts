import { Controller, Get, Post, Param, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { inngest } from '../inngest/client.js';

const ReplySchema = z.object({
  draft: z.string().min(1),
  sendImmediately: z.boolean().default(false),
});

@ApiTags('inbox')
@ApiBearerAuth()
@Controller('v1/inbox')
export class InboxController {
  @Get()
  @ApiOperation({ summary: 'List inbox messages (all platforms)' })
  list() { return { items: [], nextCursor: null }; }

  @Post(':id/reply')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send or queue a reply' })
  async reply(
    @Param('id') messageId: string,
    @Body(new ZodValidationPipe(ReplySchema)) body: z.infer<typeof ReplySchema>,
  ) {
    if (body.sendImmediately) {
      // Enqueue connector send via approval/decided or direct
      await inngest.send({ name: 'inbox/ingest', data: { socialAccountId: 'todo' } });
    }
    return { messageId, draft: body.draft, status: body.sendImmediately ? 'sending' : 'drafted' };
  }

  @Post('/draft-all')
  @HttpCode(202)
  @ApiOperation({ summary: 'Bulk AI-draft replies for all new messages' })
  async draftAll() {
    await inngest.send({ name: 'agent/run', data: { runId: `run-inbox-draft-${Date.now()}`, task: 'draft_inbox_replies' } });
    return { queued: true };
  }
}
