import { AgentConfig, TaskDefinition } from '@agcs/shared';
import { AgentCluster } from '../../src/clusters/AgentCluster';
import { ClusterConfig, LoadBalancingStrategy } from '@agcs/shared';

function agentConfig(
  id: string,
  type: AgentConfig['type'] = 'text',
  overrides: Partial<AgentConfig> = {}
): AgentConfig {
  return {
    id,
    name: id,
    type,
    priority: 'normal',
    maxConcurrentTasks: 1,
    contextWindowSize: 4096,
    modelConfig: { provider: 'mock', modelId: 'mock' },
    ...overrides,
  };
}

async function makeCluster(
  agents: AgentConfig[],
  strategy: LoadBalancingStrategy = 'round-robin'
): Promise<AgentCluster> {
  const config: ClusterConfig = {
    id: 'test-cluster',
    name: 'test-cluster',
    agentConfigs: agents,
    maxAgents: 20,
    loadBalancingStrategy: strategy,
    autoScale: false,
    isolationLevel: 'none',
  };
  const cluster = new AgentCluster(config);
  await cluster.initialize();
  return cluster;
}

function task(id: string, type: TaskDefinition['type'] = 'generate-text'): TaskDefinition {
  return {
    id,
    type,
    payload: { prompt: id },
    priority: 'normal',
    createdAt: Date.now(),
  };
}

describe('capability-aware routing', () => {
  it('never runs a task on an agent that cannot serve its type', async () => {
    const cluster = await makeCluster([agentConfig('text-only', 'text')]);

    const result = await cluster.submitTask(task('t1', 'generate-image'));

    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/no agent capable of task type 'generate-image'/);
    expect(result.agentId).toBeUndefined();
  });

  it('routes each task type to a matching specialist', async () => {
    const cluster = await makeCluster(
      [
        agentConfig('t', 'text'),
        agentConfig('i', 'image'),
        agentConfig('au', 'audio'),
        agentConfig('mm', 'multimodal'),
      ],
      'capability-based'
    );

    const [text, image, audio, composite] = await Promise.all([
      cluster.submitTask(task('a', 'generate-text')),
      cluster.submitTask(task('b', 'generate-image')),
      cluster.submitTask(task('c', 'generate-audio')),
      cluster.submitTask(task('d', 'compose')),
    ]);

    expect(text.agentId).toBe('t');
    expect(image.agentId).toBe('i');
    expect(audio.agentId).toBe('au');
    expect(composite.agentId).toBe('mm');
  });

  it('falls back to a multimodal agent when no specialist exists', async () => {
    const cluster = await makeCluster([agentConfig('mm', 'multimodal')], 'capability-based');

    const result = await cluster.submitTask(task('a', 'generate-image'));

    expect(result.status).toBe('completed');
    expect(result.agentId).toBe('mm');
  });

  it('prefers a specialist over a multimodal generalist', async () => {
    const cluster = await makeCluster(
      [agentConfig('mm', 'multimodal'), agentConfig('img', 'image')],
      'capability-based'
    );

    const result = await cluster.submitTask(task('a', 'generate-image'));

    expect(result.agentId).toBe('img');
  });
});

describe('per-agent concurrency', () => {
  it('honours maxConcurrentTasks above 1', async () => {
    const cluster = await makeCluster([
      agentConfig('wide', 'text', { maxConcurrentTasks: 4 }),
    ]);

    const startedAt = Date.now();
    const results = await Promise.all(
      [1, 2, 3, 4].map((i) => cluster.submitTask(task(`t${i}`)))
    );
    const elapsed = Date.now() - startedAt;

    expect(results.every((r) => r.status === 'completed')).toBe(true);
    expect(results.every((r) => r.agentId === 'wide')).toBe(true);
    // Serialised on one agent these four 50-200ms tasks would routinely exceed 400ms.
    expect(elapsed).toBeLessThan(400);
  });

  it('queues beyond the concurrency ceiling instead of overloading an agent', async () => {
    const cluster = await makeCluster([
      agentConfig('narrow', 'text', { maxConcurrentTasks: 1 }),
    ]);
    const agent = cluster.getAgent('narrow')!;

    const inFlight = Promise.all([1, 2, 3].map((i) => cluster.submitTask(task(`t${i}`))));
    expect(agent.getActiveTaskCount()).toBeLessThanOrEqual(1);

    const results = await inFlight;
    expect(results.every((r) => r.status === 'completed')).toBe(true);
    expect(agent.getActiveTaskCount()).toBe(0);
  });
});

describe('pause and resume', () => {
  it('drains work queued while every agent was paused', async () => {
    const cluster = await makeCluster([agentConfig('p1')]);
    const agent = cluster.getAgent('p1')!;

    agent.pause();
    expect(agent.isAvailable()).toBe(false);

    const pending = cluster.submitTask(task('queued'));
    // Nothing can run yet, so the task must still be waiting.
    expect(cluster.getState().queuedTasks).toBe(1);

    agent.resume();

    // Previously this promise never settled — the queue had no way to be re-driven.
    const result = await pending;
    expect(result.status).toBe('completed');
    expect(result.agentId).toBe('p1');
  });

  it('lets in-flight work finish after a pause', async () => {
    const cluster = await makeCluster([agentConfig('p2')]);
    const agent = cluster.getAgent('p2')!;

    const running = cluster.submitTask(task('inflight'));
    agent.pause();

    await expect(running).resolves.toMatchObject({ status: 'completed' });
  });
});

describe('load balancing strategies', () => {
  it('round-robin rotates across agents rather than keying off completion count', async () => {
    const cluster = await makeCluster(
      [agentConfig('r1'), agentConfig('r2'), agentConfig('r3')],
      'round-robin'
    );

    const results = await Promise.all(
      [1, 2, 3].map((i) => cluster.submitTask(task(`t${i}`)))
    );

    expect(new Set(results.map((r) => r.agentId)).size).toBe(3);
  });

  it('least-loaded picks the agent with the fewest in-flight tasks', async () => {
    const cluster = await makeCluster(
      [
        agentConfig('busy', 'text', { maxConcurrentTasks: 4 }),
        agentConfig('free', 'text', { maxConcurrentTasks: 4 }),
      ],
      'least-loaded'
    );

    const busy = cluster.getAgent('busy')!;
    const free = cluster.getAgent('free')!;
    // Occupy 'busy' directly so the scheduler sees asymmetric load.
    const occupying = busy.executeTask(task('occupier'));
    expect(busy.getActiveTaskCount()).toBe(1);
    expect(free.getActiveTaskCount()).toBe(0);

    const result = await cluster.submitTask(task('next'));
    expect(result.agentId).toBe('free');

    await occupying;
  });

  it('priority-based prefers the higher-priority agent', async () => {
    const cluster = await makeCluster(
      [
        agentConfig('low', 'text', { priority: 'low' }),
        agentConfig('critical', 'text', { priority: 'critical' }),
      ],
      'priority-based'
    );

    const result = await cluster.submitTask(task('t'));
    expect(result.agentId).toBe('critical');
  });
});

describe('queue ordering', () => {
  it('dispatches higher-priority tasks ahead of queued normal work', async () => {
    const cluster = await makeCluster([agentConfig('single', 'text')]);
    const completionOrder: string[] = [];

    const record = (id: string) => (r: { taskId: string }) => {
      completionOrder.push(r.taskId);
      return id;
    };

    // Fill the single slot, then queue a normal task followed by a critical one.
    const first = cluster.submitTask({ ...task('occupier'), priority: 'normal' });
    const normal = cluster.submitTask({ ...task('normal'), priority: 'normal' });
    const critical = cluster.submitTask({ ...task('critical'), priority: 'critical' });

    await Promise.all([
      first.then(record('occupier')),
      normal.then(record('normal')),
      critical.then(record('critical')),
    ]);

    expect(completionOrder[0]).toBe('occupier');
    expect(completionOrder[1]).toBe('critical');
    expect(completionOrder[2]).toBe('normal');
  });
});

describe('stopped cluster', () => {
  it('rejects new submissions after stop', async () => {
    const cluster = await makeCluster([agentConfig('s1')]);
    cluster.stop();

    const result = await cluster.submitTask(task('late'));
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/is stopped/);
  });
});

describe('task timeouts', () => {
  it('fails a task that exceeds its agent timeout instead of pinning the slot', async () => {
    const cluster = await makeCluster([
      agentConfig('slow', 'text', { taskTimeoutMs: 10 }),
    ]);
    const agent = cluster.getAgent('slow')!;

    jest
      .spyOn(agent as unknown as { processTask: () => Promise<unknown> }, 'processTask')
      .mockImplementation(() => new Promise(() => undefined)); // never settles

    const result = await cluster.submitTask(task('hang'));

    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/timed out after 10ms/);
    // Crucially the slot is released, so the cluster is still usable.
    expect(agent.getActiveTaskCount()).toBe(0);
    expect(agent.isAvailable()).toBe(true);
  });
});
