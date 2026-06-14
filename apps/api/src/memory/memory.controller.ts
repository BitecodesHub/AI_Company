import { Controller, Get, Delete, Param, HttpCode, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { RequireRole } from '../common/guards/rbac.guard.js';
import { MemoryService, type MemoryCtx } from './memory.service.js';

@ApiTags('memory')
@ApiBearerAuth()
@Controller('v1/agents')
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  private ctx(req: Request): MemoryCtx {
    const tc = (req as any).tenantContext;
    return { organizationId: tc?.organizationId ?? '', workspaceId: tc?.workspaceId, userId: (req as any).user?.id ?? '' };
  }

  @Get(':id/memories')
  @ApiOperation({ summary: 'List an employee’s memories' })
  async list(@Param('id') id: string, @Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { items: [], nextCursor: null };
    return this.memory.list(ctx, id);
  }

  @Delete(':id/memories/:memoryId')
  @HttpCode(204)
  @RequireRole('member')
  @ApiOperation({ summary: 'Forget a specific memory' })
  async remove(@Param('id') id: string, @Param('memoryId') memoryId: string, @Req() req: Request) {
    await this.memory.delete(this.ctx(req), id, memoryId);
  }
}
