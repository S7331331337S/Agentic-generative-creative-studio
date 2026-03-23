import { AgentConfig, TaskDefinition, TaskOutput } from '@agcs/shared';
import { BaseAgent } from './BaseAgent';
import { sleep } from '../utils/helpers';

/**
 * MultiModalAgent coordinates text, image, and audio generation
 * within a single agent, producing combined creative outputs.
 */
export class MultiModalAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({ ...config, type: 'multimodal' });
  }

  protected async processTask(task: TaskDefinition): Promise<TaskOutput> {
    // Simulate multi-modal generation latency (300-700ms)
    await sleep(300 + Math.random() * 400);

    const prompt = task.payload.prompt ?? '';
    const outputFormat = task.payload.outputFormat ?? 'composite';

    this.updateResourceUsage(
      70 + Math.random() * 25,
      768 + Math.random() * 256,
    );

    const composite = {
      text: `Narrative for: ${prompt}`,
      imageUrl: `https://placeholder.agcs/image/512x512?prompt=${encodeURIComponent(prompt)}`,
      audioUrl: `https://placeholder.agcs/audio?prompt=${encodeURIComponent(prompt)}&duration=10`,
      outputFormat,
    };

    return {
      type: 'json',
      content: composite,
      mimeType: 'application/json',
      metadata: {
        prompt,
        modelId: this.config.modelConfig.modelId,
        modalities: ['text', 'image', 'audio'],
      },
    };
  }
}
