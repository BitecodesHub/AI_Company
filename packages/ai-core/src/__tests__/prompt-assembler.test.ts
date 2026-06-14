import { describe, it, expect } from 'vitest';
import { PromptAssembler } from '../prompt/prompt-assembler.js';

const assembler = new PromptAssembler();

describe('PromptAssembler', () => {
  it('builds a basic message array with system + user', () => {
    const messages = assembler.build({
      systemPrompt: 'You are a helpful assistant.',
      config: { tools: [], knowledgeBaseIds: [] },
      userInput: 'Hello!',
    });
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('system');
    expect(messages[1]?.role).toBe('user');
    expect(messages[1]?.content).toBe('Hello!');
  });

  it('injects KB chunks with citation markers', () => {
    const messages = assembler.build({
      systemPrompt: 'You are helpful.',
      config: { tools: [], knowledgeBaseIds: ['kb-1'] },
      retrievedChunks: [
        { documentId: 'doc-1', sourceRef: 'https://example.com/doc', content: 'Paris is the capital of France.' },
      ],
      userInput: 'What is the capital of France?',
    });
    const systemMsg = messages[0];
    expect(typeof systemMsg?.content === 'string' && systemMsg.content).toContain('[1]');
    expect(typeof systemMsg?.content === 'string' && systemMsg.content).toContain('Paris');
  });

  it('includes memory turns before user input', () => {
    const messages = assembler.build({
      systemPrompt: 'You are helpful.',
      config: { tools: [], knowledgeBaseIds: [] },
      memory: ['What is 2+2?', '2+2 is 4.'],
      userInput: 'What about 3+3?',
    });
    // system + 2 memory + user = 4
    expect(messages).toHaveLength(4);
    expect(messages.at(-1)?.role).toBe('user');
  });

  it('renderCitations replaces [n] with linked source', () => {
    const chunks = [{ documentId: 'd1', sourceRef: 'https://src.com', content: 'x' }];
    const rendered = PromptAssembler.renderCitations('See [1] for details.', chunks);
    expect(rendered).toBe('See [1](https://src.com) for details.');
  });
});
