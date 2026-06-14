/**
 * content/generate — Inngest function for social content generation.
 * (ARCHITECTURE.md §13, Phase 6)
 */
import { inngest } from './client.js';
import { ModelRouter } from '@bitecodes/ai-core';
import { PromptAssembler } from '@bitecodes/ai-core';

const modelRouter = new ModelRouter();
const assembler = new PromptAssembler();

export const contentGenerateFunction = inngest.createFunction(
  { id: 'content/generate', name: 'Generate social content', retries: 2 },
  { event: 'content/generate' },
  async ({ event, step, logger }) => {
    const { scope, brandVoiceId, platforms = ['x', 'linkedin'], topic } = event.data as {
      scope: 'single' | 'week';
      brandVoiceId?: string;
      platforms?: string[];
      topic?: string;
      sourceUrl?: string;
    };

    const count = scope === 'week' ? 7 : 1;

    const drafts = await step.run('generate-drafts', async () => {
      const systemPrompt = `You are a social media content expert for Bitecodes.
Generate ${count} ${scope === 'week' ? 'daily' : ''} social media posts.
Brand voice ID: ${brandVoiceId ?? 'default'}.
Target platforms: ${platforms.join(', ')}.
${topic ? `Topic: ${topic}` : ''}

For each post, provide:
- A main body text (platform-adapted)
- Suggested hashtags
- Recommended posting time (day of week + time)

Output as a JSON array of content items.`;

      const response = await modelRouter.route({
        messages: assembler.build({
          systemPrompt,
          config: { tools: [], knowledgeBaseIds: [] },
          userInput: topic ?? 'Generate engaging content for this week',
        }),
        costTier: 'smart',
      });

      // TODO: parse structured JSON from response; persist content_items + content_variants
      logger.info({ count, platforms }, 'Content generation complete');
      return { generated: count, brandVoiceId, platforms };
    });

    return drafts;
  },
);
