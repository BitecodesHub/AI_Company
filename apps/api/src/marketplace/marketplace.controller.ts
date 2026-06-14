import { Controller, Get, Post, Param, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

const CreateTemplateSchema = z.object({
  kind: z.enum(['agent', 'workflow', 'brand_voice', 'prompt']),
  title: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  visibility: z.enum(['private', 'unlisted', 'public']).default('private'),
  sourceId: z.string().uuid(),  // ID of the agent/workflow/etc to export
});

const RatingSchema = z.object({ stars: z.number().int().min(1).max(5), comment: z.string().optional() });

@ApiTags('marketplace')
@ApiBearerAuth()
@Controller('v1/templates')
export class MarketplaceController {
  @Get()
  @ApiOperation({ summary: 'Browse marketplace templates' })
  list() { return { items: [], nextCursor: null }; }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Publish a template to the marketplace' })
  create(@Body(new ZodValidationPipe(CreateTemplateSchema)) body: z.infer<typeof CreateTemplateSchema>) {
    // TODO Phase 11: export agent/workflow, sanitize payload (strip secrets + tenant IDs)
    return { id: `tmpl-${Date.now()}`, ...body, status: 'draft' };
  }

  @Post(':id/install')
  @HttpCode(201)
  @ApiOperation({ summary: 'Install/clone a template into the current workspace' })
  install(@Param('id') id: string) {
    return { templateId: id, installed: true, newResourceId: `res-${Date.now()}` };
  }

  @Post(':id/ratings')
  @HttpCode(201)
  @ApiOperation({ summary: 'Rate a template' })
  rate(@Param('id') id: string, @Body(new ZodValidationPipe(RatingSchema)) body: z.infer<typeof RatingSchema>) {
    return { templateId: id, ...body };
  }
}
