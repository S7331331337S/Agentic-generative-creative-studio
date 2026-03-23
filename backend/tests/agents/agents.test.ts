import { BaseAgent } from '../../src/agents/BaseAgent';
import { TextAgent } from '../../src/agents/TextAgent';
import { ImageAgent } from '../../src/agents/ImageAgent';
import { AudioAgent } from '../../src/agents/AudioAgent';
import { MultiModalAgent } from '../../src/agents/MultiModalAgent';
import { createAgent } from '../../src/agents';
import { AgentConfig, TaskDefinition } from '@agcs/shared';

function makeConfig(type: AgentConfig['type']): AgentConfig {
  return {
    id: `agent-${type}-test`,
    name: `Test ${type} agent`,
    type,
    priority: 'normal',
    maxConcurrentTasks: 1,
    contextWindowSize: 4096,
    modelConfig: { provider: 'mock', modelId: 'mock-model' },
  };
}

function makeTask(type: TaskDefinition['type']): TaskDefinition {
  return {
    id: `task-${Date.now()}`,
    type,
    payload: { prompt: 'Test creative prompt' },
    priority: 'normal',
    createdAt: Date.now(),
  };
}

describe('TextAgent', () => {
  let agent: TextAgent;

  beforeEach(() => {
    agent = new TextAgent(makeConfig('text'));
  });

  it('starts in idle status', () => {
    expect(agent.getStatus()).toBe('idle');
    expect(agent.isAvailable()).toBe(true);
  });

  it('executes a generate-text task and returns text output', async () => {
    const task = makeTask('generate-text');
    const result = await agent.executeTask(task);

    expect(result.status).toBe('completed');
    expect(result.output?.type).toBe('text');
    expect(typeof result.output?.content).toBe('string');
    expect(result.agentId).toBe(agent.getId());
    expect(result.metrics?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns to idle after task completion', async () => {
    await agent.executeTask(makeTask('generate-text'));
    expect(agent.getStatus()).toBe('idle');
  });

  it('emits a task:completed event', async () => {
    const events: string[] = [];
    agent.on('event', (e) => events.push(e.type));
    await agent.executeTask(makeTask('generate-text'));
    expect(events).toContain('task:completed');
  });

  it('rejects duplicate concurrent execution', async () => {
    // Start first task (don't await)
    const first = agent.executeTask(makeTask('generate-text'));
    // Immediately try second task — agent should be running
    const second = agent.executeTask(makeTask('generate-text'));
    const [r1, r2] = await Promise.all([first, second]);
    // One should succeed and one should fail (busy agent)
    const statuses = [r1.status, r2.status];
    expect(statuses).toContain('completed');
    expect(statuses).toContain('failed');
  });
});

describe('ImageAgent', () => {
  let agent: ImageAgent;

  beforeEach(() => {
    agent = new ImageAgent(makeConfig('image'));
  });

  it('executes generate-image task', async () => {
    const result = await agent.executeTask(makeTask('generate-image'));
    expect(result.status).toBe('completed');
    expect(result.output?.type).toBe('image');
    expect(result.output?.mimeType).toBe('image/png');
  });
});

describe('AudioAgent', () => {
  let agent: AudioAgent;

  beforeEach(() => {
    agent = new AudioAgent(makeConfig('audio'));
  });

  it('executes generate-audio task', async () => {
    const result = await agent.executeTask(makeTask('generate-audio'));
    expect(result.status).toBe('completed');
    expect(result.output?.type).toBe('audio');
    expect(result.output?.mimeType).toBe('audio/mpeg');
  });
});

describe('MultiModalAgent', () => {
  let agent: MultiModalAgent;

  beforeEach(() => {
    agent = new MultiModalAgent(makeConfig('multimodal'));
  });

  it('executes compose task returning composite output', async () => {
    const result = await agent.executeTask(makeTask('compose'));
    expect(result.status).toBe('completed');
    expect(result.output?.type).toBe('json');
    const content = result.output?.content as Record<string, unknown>;
    expect(content.text).toBeDefined();
    expect(content.imageUrl).toBeDefined();
    expect(content.audioUrl).toBeDefined();
  });
});

describe('createAgent factory', () => {
  it('creates the correct agent type for each supported type', () => {
    const types: AgentConfig['type'][] = ['text', 'image', 'audio', 'multimodal'];
    for (const type of types) {
      const agent = createAgent(makeConfig(type));
      expect(agent).toBeInstanceOf(BaseAgent);
      expect(agent.getConfig().type).toBe(type);
    }
  });

  it('throws for unknown agent type', () => {
    expect(() =>
      createAgent({ ...makeConfig('text'), type: 'unknown' as AgentConfig['type'] })
    ).toThrow();
  });
});
