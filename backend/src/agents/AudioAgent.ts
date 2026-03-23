import { AgentConfig, TaskDefinition, TaskOutput } from '@agcs/shared';
import { BaseAgent } from './BaseAgent';
import { sleep } from '../utils/helpers';

export class AudioAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({ ...config, type: 'audio' });
  }

  protected async processTask(task: TaskDefinition): Promise<TaskOutput> {
    // Simulate audio generation latency (100-400ms)
    await sleep(100 + Math.random() * 300);

    const prompt = task.payload.prompt ?? '';
    const constraints = task.payload.constraints as Record<string, unknown> | undefined;
    const durationSec = (constraints?.durationSec as number | undefined) ?? 10;
    const sampleRate = (constraints?.sampleRate as number | undefined) ?? 44100;

    this.updateResourceUsage(
      40 + Math.random() * 40,
      256 + Math.random() * 128,
    );

    return {
      type: 'audio',
      content: {
        url: `https://placeholder.agcs/audio?prompt=${encodeURIComponent(prompt)}&duration=${durationSec}`,
        durationSec,
        sampleRate,
        format: 'mp3',
      },
      mimeType: 'audio/mpeg',
      metadata: {
        prompt,
        modelId: this.config.modelConfig.modelId,
        durationSec,
        sampleRate,
      },
    };
  }
}
