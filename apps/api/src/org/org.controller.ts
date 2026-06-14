import { Controller, Get, Post, Patch, Param, Body, HttpCode, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import type { Request } from 'express';
import { OrgService } from './org.service.js';

const CreateOrgSchema = z.object({ name: z.string().min(1).max(100), slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/) });
const UpdateOrgSchema = z.object({ name: z.string().min(1).max(100).optional(), branding: z.record(z.unknown()).optional(), settings: z.record(z.unknown()).optional() });

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('v1/orgs')
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create an organization' })
  async create(
    @Body(new ZodValidationPipe(CreateOrgSchema)) body: z.infer<typeof CreateOrgSchema>,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id ?? 'unknown';
    return this.orgService.create({ ...body, userId });
  }

  @Get()
  @ApiOperation({ summary: 'List organizations for the current user' })
  async list(@Req() req: Request) {
    const userId = (req as any).user?.id;
    if (!userId) return { items: [], nextCursor: null };
    const items = await this.orgService.listForUser(userId);
    return { items, nextCursor: null };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an organization' })
  async findOne(@Param('id') id: string) {
    return this.orgService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an organization' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateOrgSchema)) body: z.infer<typeof UpdateOrgSchema>,
  ) {
    return this.orgService.update(id, body);
  }
}
