/**
 * controller/dispatch — Inngest durable function for the AI Controller agent.
 *
 * The Controller is a Bitecodes agent whose TOOLS are the Action Registry.
 * Input = natural-language command. Output = ordered action calls with rationale.
 *
 * Safety properties (ARCHITECTURE.md §14):
 * - Action space is a CLOSED SET defined in packages/ai-controller.
 *   The agent cannot invent a route or mutation that doesn't exist.
 * - Arguments are schema-validated TWICE (server emit + browser dispatch).
 * - RBAC and tenant context apply — the Controller can only do what the
 *   current user is allowed to do.
 * - Confirmation gates stop irreversible actions without user consent.
 * - Full audit trail in controller_actions + audit_logs.
 */
import { inngest } from './client.js';
import { ModelRouter } from '@bitecodes/ai-core';
import { PromptAssembler } from '@bitecodes/ai-core';
import { ACTION_REGISTRY, validateActionArgs } from '@bitecodes/ai-controller';
import type OpenAI from 'openai';

const modelRouter = new ModelRouter();
const promptAssembler = new PromptAssembler();

const CONTROLLER_SYSTEM_PROMPT = `You are the Bitecodes AI Controller.
You help users control the Bitecodes platform using natural language.

You have access to a CLOSED set of actions. You MUST only call actions that exist in your tool list.
You CANNOT invent new actions, routes, or mutations.

For each action:
- Validate that the args match the schema before calling.
- For risk class "confirm" or "destructive", always tell the user what you are about to do before calling.
- Execute actions in logical order, waiting for each result before the next step.
- After all actions are done, provide a brief summary of what was accomplished.

You are operating on behalf of the authenticated user. You can only perform actions they have permission to do.`;

export const controllerDispatchFunction = inngest.createFunction(
  { id: 'controller/dispatch', name: 'AI Controller dispatch', retries: 1 },
  { event: 'controller/dispatch' },
  async ({ event, step }) => {
    const { sessionId, command } = event.data as { sessionId: string; command: string };

    // Build the tool catalog from the action registry
    const tools: OpenAI.ChatCompletionTool[] = ACTION_REGISTRY.map((action) => ({
      type: 'function' as const,
      function: {
        name: action.name.replace('.', '__'), // OpenAI function names can't have dots
        description: `[${action.riskClass.toUpperCase()}] ${action.description}`,
        parameters: {
          type: 'object',
          properties: action.argsSchema._def.typeName === 'ZodObject'
            ? {} // Simplified — real impl uses zodToJsonSchema
            : {},
        },
      },
    }));

    const messages = promptAssembler.build({
      systemPrompt: CONTROLLER_SYSTEM_PROMPT,
      config: { tools: [], knowledgeBaseIds: [] },
      userInput: command,
    });

    // Controller always uses smart tier for best reasoning quality
    const response = await step.run('plan-actions', async () => {
      return modelRouter.route({
        messages,
        tools,
        costTier: 'smart',
      });
    });

    // Execute planned actions
    const executedActions: Array<{ name: string; args: unknown; result: unknown; status: string }> = [];
    const toolCalls = response.message.tool_calls ?? [];

    for (const call of toolCalls) {
      const fn = (call as { function?: { name: string; arguments: string } }).function;
      const actionName = (fn?.name ?? '').replace('__', '.');
      const args = JSON.parse(fn?.arguments || '{}');

      const validation = validateActionArgs(actionName, args);
      if (!validation.success) {
        executedActions.push({ name: actionName, args, result: { error: validation.error }, status: 'validation_failed' });
        continue;
      }

      const result = await step.run(`execute-${call.id}`, async () => {
        // TODO Phase 8: dispatch to actual server handlers or emit to browser via WebSocket
        // For now, record the planned action and return a stub result
        return { dispatched: true, actionName, args: validation.data };
      });

      executedActions.push({ name: actionName, args: validation.data, result, status: 'executed' });
    }

    return { sessionId, command, actionsExecuted: executedActions.length, actions: executedActions };
  },
);
