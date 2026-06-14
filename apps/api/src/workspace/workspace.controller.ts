import { Controller, Get, Post, Patch, Param, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

const CreateWorkspaceSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
});
type CreateWorkspace = z.infer<typeof CreateWorkspaceSchema>;

@ApiTags('workspaces')
@ApiBearerAuth()
@Controller('v1/workspaces')
export class WorkspaceController {
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a workspace' })
  create(@Body(new ZodValidationPipe(CreateWorkspaceSchema)) body: CreateWorkspace) {
    return { id: 'todo', ...body, createdAt: new Date() };
  }

  @Get()
  @ApiOperation({ summary: 'List workspaces for the current org' })
  list() {
    return { items: [], nextCursor: null };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a workspace' })
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return { id, ...body };
  }
}
