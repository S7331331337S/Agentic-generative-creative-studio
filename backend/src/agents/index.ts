import { AgentConfig, AgentType } from '@agcs/shared';
import { BaseAgent } from './BaseAgent';
import { TextAgent } from './TextAgent';
import { ImageAgent } from './ImageAgent';
import { AudioAgent } from './AudioAgent';
import { MultiModalAgent } from './MultiModalAgent';

export { BaseAgent, TextAgent, ImageAgent, AudioAgent, MultiModalAgent };

export function createAgent(config: AgentConfig): BaseAgent {
  const factories: Record<AgentType, (c: AgentConfig) => BaseAgent> = {
    text: (c) => new TextAgent(c),
    image: (c) => new ImageAgent(c),
    audio: (c) => new AudioAgent(c),
    multimodal: (c) => new MultiModalAgent(c),
  };

  const factory = factories[config.type];
  if (!factory) {
    throw new Error(`Unknown agent type: ${config.type}`);
  }
  return factory(config);
}
