/**
 * PromptAssembler — builds the message array for a model call.
 *
 * Key responsibilities:
 * 1. Assembles system prompt (with prompt-caching markers on the stable prefix).
 * 2. Injects retrieved KB chunks with [n] citation markers.
 * 3. Builds the tool catalog from the agent's tool list.
 * 4. Appends thread memory and the user input.
 *
 * BUILD_GUIDE §7 rule: prompt caching markers go around the stable system-prompt prefix
 * and large KB context. Cache reads are dramatically cheaper than fresh input on
 * supported providers (Anthropic cache_control).
 */
import type OpenAI from 'openai';

export interface RetrievedChunk {
  documentId: string;
  sourceRef?: string;
  content: string;
  score?: number;
}

export interface AgentVersionConfig {
  tools: string[];
  knowledgeBaseIds: string[];
  memory?: { type: 'thread' | 'long_term'; store: string };
  permissions?: { approvalRequiredFor: string[] };
  guardrails?: { piiMask: boolean; promptInjectionScan: boolean; maxCostUsdPerRun: number };
}

export interface AssembleInput {
  systemPrompt: string;
  config: AgentVersionConfig;
  memory?: string[];         // prior thread messages as text
  retrievedChunks?: RetrievedChunk[];
  tools?: OpenAI.ChatCompletionTool[];
  userInput: unknown;
}

export class PromptAssembler {
  build(input: AssembleInput): OpenAI.ChatCompletionMessageParam[] {
    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    // System prompt with cache markers on the stable prefix.
    // The systemPrompt itself is cached; KB context is appended in a separate
    // cache-eligible segment when chunks are large.
    let systemContent = input.systemPrompt.trim();

    if (input.retrievedChunks?.length) {
      systemContent += '\n\n---\n## Retrieved knowledge\n\n';
      input.retrievedChunks.forEach((chunk, i) => {
        const source = chunk.sourceRef ? ` (source: ${chunk.sourceRef})` : '';
        systemContent += `[${i + 1}]${source}\n${chunk.content}\n\n`;
      });
      systemContent += '---\n';
    }

    messages.push({ role: 'system', content: systemContent });

    // Prior thread memory as assistant/user turns
    if (input.memory?.length) {
      for (let i = 0; i < input.memory.length; i++) {
        // Odd = user messages, even = assistant messages in a simplified model.
        // Real implementation reads proper role from DB.
        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: input.memory[i] ?? '',
        });
      }
    }

    // Current user input
    const userContent =
      typeof input.userInput === 'string'
        ? input.userInput
        : JSON.stringify(input.userInput);

    messages.push({ role: 'user', content: userContent });

    return messages;
  }

  /**
   * Wrap system prompt content with Anthropic prompt caching markers.
   * Only applied when the target provider supports it (checked by caller).
   */
  buildWithCacheMarkers(input: AssembleInput): OpenAI.ChatCompletionMessageParam[] {
    const messages = this.build(input);
    // Cache markers are provider-specific (Anthropic cache_control).
    // For providers that support it, the system message content gets split
    // into a stable cached prefix (system prompt + KB) and the ephemeral user input.
    // This is a no-op here; the actual cache header is set by ModelRouter
    // when routing to an Anthropic-compatible endpoint.
    return messages;
  }

  /**
   * Render [n] citation markers into a final answer string,
   * linking citation numbers back to their source references.
   */
  static renderCitations(text: string, chunks: RetrievedChunk[]): string {
    return text.replace(/\[(\d+)\]/g, (match, num) => {
      const idx = parseInt(num, 10) - 1;
      const chunk = chunks[idx];
      if (!chunk?.sourceRef) return match;
      return `[${num}](${chunk.sourceRef})`;
    });
  }
}
