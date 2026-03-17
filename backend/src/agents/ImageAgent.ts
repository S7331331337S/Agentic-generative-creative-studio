import { AgentConfig, TaskDefinition, TaskOutput } from '@agcs/shared';
import { BaseAgent } from './BaseAgent';
import { sleep } from '../utils/helpers';

export class ImageAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({ ...config, type: 'image' });
  }

  protected async processTask(task: TaskDefinition): Promise<TaskOutput> {
    // Simulate image generation latency (200-500ms)
    await sleep(200 + Math.random() * 300);

    const prompt = task.payload.prompt ?? '';
    const constraints = task.payload.constraints as Record<string, unknown> | undefined;
    const width = (constraints?.width as number | undefined) ?? 512;
    const height = (constraints?.height as number | undefined) ?? 512;

    this.updateResourceUsage(
      60 + Math.random() * 30,
      512 + Math.random() * 256,
    );

    return {
      type: 'image',
      // Mock: return a placeholder image URL/descriptor instead of real binary
      content: {
        url: `https://placeholder.agcs/image/${width}x${height}?prompt=${encodeURIComponent(prompt)}`,
        width,
        height,
        format: 'png',
      },
      mimeType: 'image/png',
      metadata: {
        prompt,
        modelId: this.config.modelConfig.modelId,
        width,
        height,
        style: task.payload.style,
      },
    };
  }
}
