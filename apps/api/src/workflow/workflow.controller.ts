import { Controller, Get, Post, Patch, Param, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { inngest } from '../inngest/client.js';

const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  graph: z.object({ nodes: z.array(z.unknown()).default([]), edges: z.array(z.unknown()).default([]) }),
});

@ApiTags('workflows')
@ApiBearerAuth()
@Controller('v1/workflows')
export class WorkflowController {
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a workflow' })
  create(@Body(new ZodValidationPipe(CreateWorkflowSchema)) body: z.infer<typeof CreateWorkflowSchema>) {
    return { id: 'todo', ...body, status: 'draft', createdAt: new Date() };
  }

  @Get()
  @ApiOperation({ summary: 'List workflows' })
  list() { return { items: [], nextCursor: null }; }

  // Static routes MUST come before parameterised :id to avoid shadowing.
  @Get('runs')
  @ApiOperation({ summary: 'List all workflow runs (across workflows)' })
  listRuns() { return { items: [], nextCursor: null }; }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workflow' })
  findOne(@Param('id') id: string) { return { id }; }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a workflow' })
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) { return { id, ...body }; }

  @Post(':id/run')
  @HttpCode(202)
  @ApiOperation({ summary: 'Trigger a workflow run' })
  async run(@Param('id') workflowId: string, @Body() input: unknown) {
    const workflowRunId = `wf-run-${Date.now()}`;
    await inngest.send({ name: 'workflow/run', data: { workflowRunId, input } });
    return { workflowRunId, workflowId, status: 'queued' };
  }
}
