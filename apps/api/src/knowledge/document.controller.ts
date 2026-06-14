/**
 * DocumentController — operations on individual documents (reindex).
 * Separate from KnowledgeController to give the reindex route a clean,
 * non-ambiguous path: POST /v1/documents/:id/reindex.
 */
import { Controller, Post, Param, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { inngest } from '../inngest/client.js';

@ApiTags('knowledge')
@ApiBearerAuth()
@Controller('v1/documents')
export class DocumentController {
  @Post(':id/reindex')
  @HttpCode(202)
  @ApiOperation({ summary: 'Re-index a document' })
  async reindex(@Param('id') documentId: string) {
    await inngest.send({ name: 'kb/ingest', data: { documentId } });
    return { queued: true, documentId };
  }
}
