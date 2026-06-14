/**
 * agent/run — durable Inngest function for executing an agent.
 *
 * Lifecycle (ARCHITECTURE.md §7):
 * 1. Resolve run → agent → active version inside withTenant; set status=running.
 * 2. Assemble prompt (PromptAssembler): system prompt + config + input.
 * 3. Model call (ModelRouter → single AI gateway). Each call is a discrete step
 *    and is persisted as a run_steps row.
 * 4. Tool calls: data-driven approval gate (Phase D). If needed → insert an
 *    approvals row, emit approval:created, waitForEvent('approval/decided').
 * 5. Loop until final answer, cost/step limit, or cancelled/paused.
 * 6. Persist output + totals, write audit_logs, emit run/finished + run:status.
 *
 * BUILD_GUIDE §7 rule: controllers never call models synchronously — they enqueue
 * `agent/run`. Tenant context is mandatory: every query runs inside withTenant.
 */
import { NonRetriableError } from 'inngest';
import type OpenAI from 'openai';
import { eq, and, desc } from 'drizzle-orm';
import { inngest } from './client.js';
import { ModelRouter, ProviderError } from '@bitecodes/ai-core';
import { PromptAssembler } from '@bitecodes/ai-core';
import { Guardrails } from '@bitecodes/ai-core';
import type { AgentVersionConfig } from '@bitecodes/ai-core';
import { agentRuns, agents, agentVersions, runSteps, approvals, auditLogs, employeeControls, mcpTools, agentMessages, agentMemories, onboardingStates } from '@bitecodes/db';
import { withTenant, systemDb } from './runtime-db.js';
import { runsEmitter } from '../gateway/runs-emitter.js';
import { companyEmitter } from '../gateway/company-emitter.js';
import { approvalNotifier } from '../email/approval-notifier.js';

const MAX_STEPS = 50;
const promptAssembler = new PromptAssembler();
const guardrails = new Guardrails();

interface StoredConfig {
  tools?: string[];
  knowledgeBaseIds?: string[];
  guardrails?: { piiMask?: boolean; promptInjectionScan?: boolean; maxCostUsdPerRun?: number };
}

// Minimal structural contract for the parts of the Inngest run context the
// executor uses. Lets the handler be invoked directly from tests with a mock.
interface StepLike {
  run<T>(id: string, fn: () => Promise<T>): Promise<T>;
  waitForEvent(
    id: string,
    opts: { event: string; timeout: string; match: string },
  ): Promise<{ data: unknown } | null>;
  sendEvent(id: string, payload: { name: string; data: unknown }): Promise<unknown>;
}
interface LoggerLike {
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

export async function executeAgentRun(ctx: {
  event: { data: { runId: string } };
  step: StepLike;
  logger: LoggerLike;
}) {
  const { event, step, logger } = ctx;
  {
    const { runId } = event.data as { runId: string };

    // ── Step 1: resolve run → agent → version, set running ───────────────────
    const runData = await step.run('resolve-run', async () => {
      // Bootstrap: the runId is trusted (emitted by our own controller). Resolve
      // the tenant from the row via the superuser connection, then do everything
      // else under withTenant so RLS applies.
      const [run] = await systemDb()
        .select({
          organizationId: agentRuns.organizationId,
          workspaceId: agentRuns.workspaceId,
          agentId: agentRuns.agentId,
          agentVersionId: agentRuns.agentVersionId,
          status: agentRuns.status,
          input: agentRuns.input,
        })
        .from(agentRuns)
        .where(eq(agentRuns.id, runId))
        .limit(1);

      if (!run) throw new NonRetriableError(`RUN_NOT_FOUND: ${runId}`);
      if (run.status === 'cancelled') throw new NonRetriableError(`RUN_CANCELLED: ${runId}`);

      const orgId = run.organizationId;
      const wsId = run.workspaceId ?? undefined;

      return withTenant(orgId, wsId, async (tx) => {
        const [agent] = await tx
          .select({ defaultModel: agents.defaultModel, costTier: agents.costTier })
          .from(agents)
          .where(eq(agents.id, run.agentId))
          .limit(1);
        if (!agent) throw new NonRetriableError(`AGENT_NOT_FOUND: ${run.agentId}`);

        const [version] = await tx
          .select({ systemPrompt: agentVersions.systemPrompt, config: agentVersions.config })
          .from(agentVersions)
          .where(eq(agentVersions.id, run.agentVersionId))
          .limit(1);
        if (!version) throw new NonRetriableError(`AGENT_VERSION_NOT_FOUND: ${run.agentVersionId}`);

        // Per-employee controls (defaults when no row exists yet).
        const [ctrl] = await tx
          .select({
            activationState: employeeControls.activationState,
            approvalMode: employeeControls.approvalMode,
            bypassPermission: employeeControls.bypassPermission,
            planMode: employeeControls.planMode,
          })
          .from(employeeControls)
          .where(eq(employeeControls.agentId, run.agentId))
          .limit(1);

        const controls = {
          activationState: ctrl?.activationState ?? 'active',
          approvalMode: ctrl?.approvalMode ?? 'risky',
          bypassPermission: ctrl?.bypassPermission ?? false,
          planMode: ctrl?.planMode ?? false,
        };

        // A paused/deactivated employee must not run. Set running only if active.
        if (controls.activationState === 'active') {
          await tx
            .update(agentRuns)
            .set({ status: 'running', startedAt: new Date() })
            .where(eq(agentRuns.id, runId));
        }

        const cfg = (version.config ?? {}) as StoredConfig;
        const g = cfg.guardrails ?? {};
        const config: AgentVersionConfig = {
          tools: cfg.tools ?? [],
          knowledgeBaseIds: cfg.knowledgeBaseIds ?? [],
          guardrails: {
            piiMask: g.piiMask ?? false,
            promptInjectionScan: g.promptInjectionScan ?? true,
            maxCostUsdPerRun: g.maxCostUsdPerRun ?? 0.5,
          },
        };
        return {
          runId,
          organizationId: orgId,
          workspaceId: wsId,
          agentId: run.agentId,
          defaultModel: agent.defaultModel ?? null,
          costTier: agent.costTier ?? 'auto',
          systemPrompt: version.systemPrompt || 'You are a helpful AI assistant.',
          config,
          controls,
          input: run.input,
        };
      });
    });

    const orgId = runData.organizationId;
    const wsId = runData.workspaceId;

    // ── Activation gate: a non-active employee does not execute ──────────────
    if (runData.controls.activationState !== 'active') {
      const reason = runData.controls.activationState === 'paused' ? 'EMPLOYEE_PAUSED' : 'EMPLOYEE_DEACTIVATED';
      await step.run('reject-inactive', async () => {
        await withTenant(orgId, wsId, async (tx) => {
          await tx
            .update(agentRuns)
            .set({ status: 'failed', failureReason: reason, finishedAt: new Date() })
            .where(eq(agentRuns.id, runId));
        });
        if (wsId) runsEmitter()?.emitRunStatus(wsId, { runId, status: 'failed', reason });
      });
      await step.sendEvent('emit-run-finished-inactive', {
        name: 'run/finished',
        data: { runId, status: 'failed' },
      });
      return { runId, status: 'failed' as const, reason };
    }

    // Stream live status so the Run Inspector reflects 'running' immediately.
    if (wsId) runsEmitter()?.emitRunStatus(wsId, { runId, status: 'running' });

    // One router per run, wired to this agent's model override (or env default).
    const modelRouter = new ModelRouter({
      defaultModel: runData.defaultModel ?? process.env['DEFAULT_MODEL'],
    });

    // ── Step 2: kill switch ──────────────────────────────────────────────────
    await step.run('check-kill-switch', async () => {
      const killSwitchActive = false; // TODO: settings/feature_flags lookup (Phase E)
      if (killSwitchActive) throw new NonRetriableError('KILL_SWITCH_ACTIVE');
    });

    // ── Step 3a: load long-term memory (layered prompt assembly) ─────────────
    const memory = await step.run('load-memory', async () => {
      const topK = Number(process.env['MEMORY_LONGTERM_TOPK'] ?? 5);
      return withTenant(orgId, wsId, async (tx) => {
        const rows = await tx
          .select({ content: agentMemories.content, kind: agentMemories.kind })
          .from(agentMemories)
          .where(and(
            eq(agentMemories.agentId, runData.agentId),
            eq(agentMemories.organizationId, orgId),
            eq(agentMemories.scope, 'long_term'),
          ))
          .orderBy(desc(agentMemories.salience), desc(agentMemories.createdAt))
          .limit(topK);
        return rows.map((r) => `(${r.kind}) ${r.content}`);
      });
    });

    // ── Step 3b: assemble messages (system + memory + input) ─────────────────
    const initialMessages = await step.run('assemble-prompt', async () => {
      const scan = guardrails.scanUserInput(
        typeof runData.input === 'string' ? runData.input : JSON.stringify(runData.input),
      );
      if (!scan.safe) logger.warn({ flags: scan.flags }, 'Prompt injection flagged in user input');

      return promptAssembler.build({
        systemPrompt: runData.systemPrompt,
        config: runData.config,
        memory,
        userInput: runData.input,
      });
    });

    // ── Step 4: agentic loop ─────────────────────────────────────────────────
    const messages = [...initialMessages];
    let totalCostUsd = 0;
    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let stepCount = 0;
    let stepIndex = 0;
    const maxCost = runData.config.guardrails?.maxCostUsdPerRun ?? 0.5;
    let terminalError: string | null = null;

    try {
      while (stepCount < MAX_STEPS) {
        stepCount++;

        if (totalCostUsd >= maxCost) {
          logger.warn({ totalCostUsd }, 'Run cost ceiling reached');
          break;
        }

        // Model call — its own Inngest step for retry & replay.
        const modelResponse = await step.run(`llm-step-${stepCount}`, async () => {
          return modelRouter.route({
            messages: messages as Parameters<typeof modelRouter.route>[0]['messages'],
            costTier: runData.costTier as 'fast' | 'smart' | 'auto',
          });
        });

        totalCostUsd += modelResponse.costUsd;
        totalTokensIn += modelResponse.usage.promptTokens;
        totalTokensOut += modelResponse.usage.completionTokens;

        // Persist the llm step + stream it live.
        const thisIndex = stepIndex++;
        await step.run(`persist-llm-step-${stepCount}`, async () => {
          await withTenant(orgId, wsId, async (tx) => {
            await tx.insert(runSteps).values({
              runId,
              organizationId: orgId,
              workspaceId: wsId ?? null,
              index: thisIndex,
              type: 'llm',
              name: `model:${modelResponse.model}`,
              output: { content: modelResponse.message.content ?? null },
              status: 'succeeded',
              costUsd: String(modelResponse.costUsd),
              tokensIn: modelResponse.usage.promptTokens,
              tokensOut: modelResponse.usage.completionTokens,
              model: modelResponse.model,
              startedAt: new Date(),
              finishedAt: new Date(),
            });
          });
          if (wsId) {
            runsEmitter()?.emitRunStep(wsId, {
              runId, index: thisIndex, type: 'llm', model: modelResponse.model, status: 'succeeded',
            });
          }
        });

        messages.push(modelResponse.message as OpenAI.ChatCompletionMessageParam);

        const toolCalls = modelResponse.message.tool_calls ?? [];
        if (toolCalls.length === 0) break; // final answer

        for (const toolCall of toolCalls) {
          const fn = (toolCall as { function?: { name: string; arguments?: string } }).function;
          const toolName = fn?.name ?? 'unknown';

          // Data-driven approval gate (Phase D): employee_controls + mcp_tools.
          //   bypass_permission        → never gate
          //   approval_mode = never    → never gate
          //   approval_mode = always   → always gate
          //   plan_mode = true         → gate every tool (act only after approval)
          //   approval_mode = risky    → gate only risky/approval-required tools
          const needsApproval = await step.run(`check-approval-${toolCall.id}`, async () => {
            const c = runData.controls;
            if (c.bypassPermission || c.approvalMode === 'never') return false;
            if (c.approvalMode === 'always' || c.planMode) return true;
            // risky: consult mcp_tools for this tool name.
            const risky = await withTenant(orgId, wsId, async (tx) => {
              const [tool] = await tx
                .select({ approvalRequired: mcpTools.approvalRequired, riskClass: mcpTools.riskClass })
                .from(mcpTools)
                .where(eq(mcpTools.name, toolName))
                .limit(1);
              if (tool) return tool.approvalRequired || ['write', 'admin', 'destructive'].includes(tool.riskClass);
              // Unknown tool → conservative name heuristic.
              return toolName.toLowerCase().includes('delete') || toolName.toLowerCase().includes('send');
            });
            return risky;
          });

          if (needsApproval) {
            const approvalId = await step.run(`create-approval-${toolCall.id}`, async () => {
              return withTenant(orgId, wsId, async (tx) => {
                const ttlHours = Number(process.env['APPROVAL_LINK_TTL_HOURS'] ?? 72);
                const [row] = await tx
                  .insert(approvals)
                  .values({
                    organizationId: orgId,
                    workspaceId: wsId ?? null,
                    runId,
                    kind: 'tool_call',
                    status: 'pending',
                    payload: { toolName, arguments: fn?.arguments ?? null },
                    expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
                  })
                  .returning({ id: approvals.id });
                await tx
                  .update(agentRuns)
                  .set({ status: 'waiting_approval' })
                  .where(eq(agentRuns.id, runId));
                return row!.id;
              });
            });

            if (wsId) {
              runsEmitter()?.emitApprovalCreated(wsId, { approvalId, runId });
              runsEmitter()?.emitRunStatus(wsId, { runId, status: 'waiting_approval' });
            }

            // Email org admins/owners a signed approve/reject link (best-effort).
            await step.run(`notify-approval-${toolCall.id}`, async () => {
              const ttlHours = Number(process.env['APPROVAL_LINK_TTL_HOURS'] ?? 72);
              await approvalNotifier()?.notifyApprovalCreated({
                approvalId,
                runId,
                organizationId: orgId,
                workspaceId: wsId,
                toolName,
                expiresAtMs: Date.now() + ttlHours * 60 * 60 * 1000,
              });
            });

            const decision = await step.waitForEvent(`await-approval-${toolCall.id}`, {
              event: 'approval/decided',
              timeout: '7d',
              match: 'data.approvalId',
            });

            // Resume → running.
            await step.run(`resume-after-approval-${toolCall.id}`, async () => {
              await withTenant(orgId, wsId, async (tx) => {
                await tx.update(agentRuns).set({ status: 'running' }).where(eq(agentRuns.id, runId));
              });
              if (wsId) runsEmitter()?.emitRunStatus(wsId, { runId, status: 'running' });
            });

            if (!decision || (decision.data as { decision: string }).decision === 'rejected') {
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: 'Tool call rejected by human reviewer.',
              });
              continue;
            }
          }

          // Execute the tool (real MCP/connector dispatch lands in Phase 4).
          const toolResult = await step.run(`tool-${toolCall.id}`, async () => {
            return { result: `[stub] executed ${toolName}` };
          });

          const toolIndex = stepIndex++;
          await step.run(`persist-tool-step-${toolCall.id}`, async () => {
            await withTenant(orgId, wsId, async (tx) => {
              await tx.insert(runSteps).values({
                runId,
                organizationId: orgId,
                workspaceId: wsId ?? null,
                index: toolIndex,
                type: 'tool',
                name: toolName,
                output: toolResult,
                status: 'succeeded',
                startedAt: new Date(),
                finishedAt: new Date(),
              });
            });
            if (wsId) {
              runsEmitter()?.emitRunStep(wsId, { runId, index: toolIndex, type: 'tool', name: toolName, status: 'succeeded' });
            }
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        }
      }
    } catch (err) {
      // A provider failure is a real run failure — surface it, do not fake success.
      terminalError = err instanceof ProviderError ? err.message : err instanceof Error ? err.message : String(err);
      logger.error({ runId, error: terminalError }, 'Agent run failed');
    }

    // ── Step 5: finalize (persist totals + audit + emit) ─────────────────────
    const finalAnswer = await step.run('finalize', async () => {
      const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
      const output = typeof lastAssistant?.content === 'string'
        ? lastAssistant.content
        : JSON.stringify(lastAssistant?.content ?? null);
      const status: 'succeeded' | 'failed' = terminalError ? 'failed' : 'succeeded';

      await withTenant(orgId, wsId, async (tx) => {
        await tx
          .update(agentRuns)
          .set({
            status,
            output: terminalError ? { error: terminalError } : { text: output },
            costUsd: String(totalCostUsd),
            tokensIn: totalTokensIn,
            tokensOut: totalTokensOut,
            finishedAt: new Date(),
          })
          .where(eq(agentRuns.id, runId));

        await tx.insert(auditLogs).values({
          organizationId: orgId,
          workspaceId: wsId ?? null,
          actorType: 'agent',
          actorId: runData.agentId,
          action: 'run.finished',
          targetType: 'agent_run',
          targetId: runId,
          metadata: { status, costUsd: totalCostUsd, tokensIn: totalTokensIn, tokensOut: totalTokensOut, steps: stepCount },
        });

        // Surface run completion on the company timeline (inter-agent bus).
        await tx.insert(agentMessages).values({
          organizationId: orgId,
          workspaceId: wsId ?? null,
          runId,
          fromAgentId: runData.agentId,
          kind: 'observation',
          body: status === 'succeeded' ? `Run completed: ${output.slice(0, 280)}` : `Run failed: ${terminalError ?? 'unknown'}`,
          metadata: { status, steps: stepCount },
        });

        // Onboarding: a first successful run advances the checklist (server-owned).
        if (status === 'succeeded') {
          const [ob] = await tx
            .select({ id: onboardingStates.id, completedSteps: onboardingStates.completedSteps, completedAt: onboardingStates.completedAt })
            .from(onboardingStates)
            .where(eq(onboardingStates.organizationId, orgId))
            .limit(1);
          const done = new Set<string>(((ob?.completedSteps as string[] | undefined) ?? []));
          if (!done.has('first_run')) {
            done.add('first_run');
            const arr = [...done];
            const allReq = done.has('hire_employee') && done.has('first_run');
            const completedAt = allReq ? (ob?.completedAt ?? new Date()) : null;
            if (ob) {
              await tx.update(onboardingStates).set({ completedSteps: arr, completedAt, updatedAt: new Date() }).where(eq(onboardingStates.id, ob.id));
            } else {
              await tx.insert(onboardingStates).values({ organizationId: orgId, workspaceId: wsId ?? null, completedSteps: arr, completedAt });
            }
          }
        }
      });

      if (wsId) {
        runsEmitter()?.emitRunStatus(wsId, { runId, status });
        companyEmitter()?.emitMessage(wsId, { runId, agentId: runData.agentId, kind: 'observation', status });
      }

      return { runId, status, output, totalCostUsd, totalTokensIn, totalTokensOut, steps: stepCount };
    });

    // Terminal lifecycle event (BUILD_GUIDE §6).
    await step.sendEvent('emit-run-finished', {
      name: 'run/finished',
      data: { runId, status: finalAnswer.status },
    });

    return finalAnswer;
  }
}

export const agentRunFunction = inngest.createFunction(
  {
    id: 'agent/run',
    name: 'Execute agent run',
    retries: 3,
    throttle: { limit: 100, period: '1m' },
  },
  { event: 'agent/run' },
  async ({ event, step, logger }) => executeAgentRun({ event, step, logger } as never),
);
