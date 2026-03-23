import { AgentConfig, TaskDefinition, TaskOutput } from '@agcs/shared';
import { BaseAgent } from './BaseAgent';
import { sleep } from '../utils/helpers';

export class TextAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({ ...config, type: 'text' });
  }

  protected async processTask(task: TaskDefinition): Promise<TaskOutput> {
    // Simulate text generation latency (50-200ms)
    await sleep(50 + Math.random() * 150);

    const prompt = task.payload.prompt ?? '';
    const style = task.payload.style as Record<string, string> | undefined;
    const tonePrefix = style?.tone ? `[${style.tone}] ` : '';

    const generatedText = this.generateText(tonePrefix + prompt);

    this.updateResourceUsage(
      20 + Math.random() * 30,
      128 + Math.random() * 64,
    );

    return {
      type: 'text',
      content: generatedText,
      mimeType: 'text/plain',
      metadata: {
        prompt,
        modelId: this.config.modelConfig.modelId,
        wordCount: generatedText.split(' ').length,
      },
    };
  }

  private generateText(prompt: string): string {
    // Mock text generation – in production this calls an LLM API
    const templates = [
      `Generated narrative for "${prompt}": Once upon a time in a world shaped by artificial intelligence, ` +
        `creative minds collaborated with machines to produce extraordinary works.`,
      `Composition based on "${prompt}": The intersection of human creativity and machine intelligence ` +
        `yields unexpected and inspiring results.`,
      `Creative output for "${prompt}": In this piece, we explore the boundaries between organic thought ` +
        `and algorithmic expression, finding harmony in their overlap.`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }
}
