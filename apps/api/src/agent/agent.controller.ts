import { Controller, Get, Post, Patch, Delete, Param, Body, HttpCode, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { AgentInputSchema, StartRunSchema } from '@bitecodes/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { executeAgentRun } from '../inngest/agent.run.js';
import type { AgentInput, StartRun } from '@bitecodes/shared';
import type { Request } from 'express';
import { AgentService, type HireInput } from './agent.service.js';

// Marketplace "hire" payload — supports the router flag + routing keywords that
// AgentInputSchema does not carry (kept out of the shared contract for now).
const HireSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(200),
  goal: z.string().max(500).optional(),
  systemPrompt: z.string().max(8000).optional(),
  costTier: z.enum(['fast', 'smart', 'auto']).optional(),
  avatar: z.string().max(16).optional(),
  isRouter: z.boolean().optional(),
  routingKeywords: z.array(z.string().max(40)).max(40).optional(),
});

@ApiTags('agents')
@ApiBearerAuth()
@Controller('v1/agents')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  private ctx(req: Request) {
    const tc = (req as any).tenantContext;
    const user = (req as any).user;
    return {
      organizationId: tc?.organizationId ?? '',
      workspaceId: tc?.workspaceId ?? '',
      userId: user?.id ?? '',
    };
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create an agent' })
  async create(@Body(new ZodValidationPipe(AgentInputSchema)) body: AgentInput, @Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { id: 'no-workspace', ...body };
    return this.agentService.createWithOnboarding(body, ctx);
  }

  @Post('hire')
  @HttpCode(201)
  @ApiOperation({ summary: 'Hire an employee from a role template (marketplace)' })
  async hire(@Body(new ZodValidationPipe(HireSchema)) body: HireInput, @Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { id: 'no-workspace', ...body };
    return this.agentService.hire(body, ctx);
  }

  @Get()
  @ApiOperation({ summary: 'List agents' })
  async list(@Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { items: [], nextCursor: null };
    return this.agentService.list(ctx);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an agent' })
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { id };
    return this.agentService.findById(id, ctx);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an agent' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AgentInputSchema.partial())) body: Partial<AgentInput>,
    @Req() req: Request,
  ) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { id, ...body };
    return this.agentService.update(id, body, ctx);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete an agent' })
  async remove(@Param('id') id: string, @Req() req: Request) {
    const ctx = this.ctx(req);
    if (ctx.organizationId) await this.agentService.softDelete(id, ctx);
    return;
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List agent versions' })
  async listVersions(@Param('id') id: string, @Req() req: Request) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { agentId: id, items: [] };
    const items = await this.agentService.listVersions(id, ctx);
    return { agentId: id, items };
  }

  @Post(':id/versions')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new agent version' })
  async createVersion(
    @Param('id') agentId: string,
    @Body() body: { systemPrompt: string; config: unknown },
    @Req() req: Request,
  ) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { agentId, versionNumber: 1, ...body };
    return this.agentService.createVersion(agentId, body, ctx);
  }

  @Post(':id/activate/:versionId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Set the active version for an agent' })
  async activate(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Req() req: Request,
  ) {
    const ctx = this.ctx(req);
    if (!ctx.organizationId) return { agentId: id, activeVersionId: versionId };
    return this.agentService.activateVersion(id, versionId, ctx);
  }

  @Post(':id/runs')
  @HttpCode(202)
  @ApiOperation({ summary: 'Trigger an agent run' })
  async run(
    @Param('id') agentId: string,
    @Body(new ZodValidationPipe(StartRunSchema)) body: StartRun,
    @Req() req: Request,
  ) {
    const ctx = this.ctx(req);
    // Create the run row, then execute IN-PROCESS — no external Inngest server
    // is required. Fire-and-forget; the client polls GET /v1/runs/:id for status.
    const runId = await this.agentService.createRun(agentId, body.input, ctx);
    const inlineStep = {
      async run<T>(_id: string, fn: () => Promise<T>): Promise<T> { return fn(); },
      async waitForEvent() { return null; },
      async sendEvent() { return undefined; },
    };
    const logger = {
      warn: (o: unknown, m?: string) => console.warn(m ?? '', o),
      error: (o: unknown, m?: string) => console.error(m ?? '', o),
    };
    void executeAgentRun({ event: { data: { runId } }, step: inlineStep, logger }).catch(
      (err: unknown) => console.error('[agent/run] inline execution failed:', err),
    );
    return { runId, agentId, status: 'queued' };
  }
}
