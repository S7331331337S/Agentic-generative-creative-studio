import { AgentConfig, TaskResult, WorkflowDefinition, WorkflowStep } from '@agcs/shared';
import { Orchestrator } from '../../src/orchestration/Orchestrator';
import { WorkflowValidationError } from '../../src/orchestration/dag';

function agentConfig(id: string, type: AgentConfig['type'] = 'text'): AgentConfig {
  return {
    id,
    name: id,
    type,
    priority: 'normal',
    maxConcurrentTasks: 1,
    contextWindowSize: 4096,
    modelConfig: { provider: 'mock', modelId: 'mock' },
  };
}

function step(overrides: Partial<WorkflowStep> & { id: string }): WorkflowStep {
  return {
    name: overrides.id,
    taskType: 'generate-text',
    agentType: 'text',
    payload: { prompt: overrides.id },
    ...overrides,
  };
}

function workflow(id: string, steps: WorkflowStep[]): WorkflowDefinition {
  return { id, name: id, steps, createdAt: Date.now() };
}

async function orchestratorWithCluster(
  clusterId: string,
  agents: AgentConfig[]
): Promise<Orchestrator> {
  const orchestrator = new Orchestrator();
  await orchestrator.clusterManager.createCluster({
    id: clusterId,
    name: clusterId,
    agentConfigs: agents,
    maxAgents: 10,
    loadBalancingStrategy: 'capability-based',
    autoScale: false,
    isolationLevel: 'none',
  });
  return orchestrator;
}

describe('WorkflowEngine — graph validation', () => {
  let orchestrator: Orchestrator;

  beforeEach(async () => {
    orchestrator = await orchestratorWithCluster('c', [agentConfig('a1')]);
  });

  afterEach(() => orchestrator.stop());

  it('refuses to register a cyclic workflow', () => {
    expect(() =>
      orchestrator.workflowEngine.registerWorkflow(
        workflow('cyclic', [
          step({ id: 'a', dependencies: ['b'] }),
          step({ id: 'b', dependencies: ['a'] }),
        ])
      )
    ).toThrow(WorkflowValidationError);
    expect(orchestrator.workflowEngine.getWorkflow('cyclic')).toBeUndefined();
  });

  it('refuses to register a workflow with a dangling dependency', () => {
    expect(() =>
      orchestrator.workflowEngine.registerWorkflow(
        workflow('dangling', [step({ id: 'only', dependencies: ['nope'] })])
      )
    ).toThrow(/unknown step "nope"/);
  });
});

describe('WorkflowEngine — conditions', () => {
  let orchestrator: Orchestrator;

  beforeEach(async () => {
    orchestrator = await orchestratorWithCluster('c', [agentConfig('a1')]);
  });

  afterEach(() => orchestrator.stop());

  it('runs a step whose condition holds', async () => {
    orchestrator.workflowEngine.registerWorkflow(
      workflow('cond-true', [
        step({ id: 'first' }),
        step({
          id: 'second',
          dependencies: ['first'],
          condition: "steps.first.status == 'completed'",
        }),
      ])
    );

    const run = await orchestrator.workflowEngine.runWorkflow('cond-true', 'c');
    expect(run.status).toBe('completed');
    expect(run.stepResults.second.status).toBe('completed');
  });

  it('marks a step cancelled — not silently absent — when its condition is false', async () => {
    orchestrator.workflowEngine.registerWorkflow(
      workflow('cond-false', [
        step({ id: 'first' }),
        step({
          id: 'second',
          dependencies: ['first'],
          condition: "steps.first.status == 'failed'",
        }),
      ])
    );

    const run = await orchestrator.workflowEngine.runWorkflow('cond-false', 'c');
    expect(run.status).toBe('completed');
    expect(run.stepResults.second.status).toBe('cancelled');
    expect(run.stepResults.second.error).toMatch(/condition .* evaluated false/);
  });

  it('fails the run when a condition cannot be parsed at execution time', async () => {
    // Bypass registration validation to prove the executor is defensive too.
    const definition = workflow('bad-cond', [step({ id: 'a' })]);
    orchestrator.workflowEngine.registerWorkflow(definition);
    definition.steps[0].condition = 'steps.a.status >= 3';

    const run = await orchestrator.workflowEngine.runWorkflow('bad-cond', 'c');
    expect(run.status).toBe('failed');
    expect(run.error).toMatch(/Invalid step condition/);
  });
});

describe('WorkflowEngine — failure propagation', () => {
  let orchestrator: Orchestrator;

  beforeEach(async () => {
    orchestrator = await orchestratorWithCluster('c', [agentConfig('a1')]);
  });

  afterEach(() => orchestrator.stop());

  function forceFailure(times = Infinity): { attempts: () => number } {
    let attempts = 0;
    jest
      .spyOn(orchestrator.clusterManager, 'submitTask')
      .mockImplementation(async (_clusterId, task) => {
        attempts++;
        const result: TaskResult =
          attempts <= times
            ? { taskId: task.id, status: 'failed', error: 'induced failure' }
            : {
                taskId: task.id,
                status: 'completed',
                output: { type: 'text', content: 'ok' },
              };
        return result;
      });
    return { attempts: () => attempts };
  }

  it('fails the whole run by default when a step fails', async () => {
    forceFailure();
    orchestrator.workflowEngine.registerWorkflow(workflow('f', [step({ id: 'a' })]));

    const run = await orchestrator.workflowEngine.runWorkflow('f', 'c');
    expect(run.status).toBe('failed');
    expect(run.error).toMatch(/Step a failed/);
  });

  it('continues past a failed step when onError is skip', async () => {
    forceFailure();
    orchestrator.workflowEngine.registerWorkflow(
      workflow('skip', [step({ id: 'a', onError: 'skip' })])
    );

    const run = await orchestrator.workflowEngine.runWorkflow('skip', 'c');
    expect(run.status).toBe('completed');
    expect(run.stepResults.a.status).toBe('failed');
  });

  it('cancels dependents of a skipped step rather than running them on missing input', async () => {
    forceFailure();
    orchestrator.workflowEngine.registerWorkflow(
      workflow('cascade', [
        step({ id: 'a', onError: 'skip' }),
        step({ id: 'b', dependencies: ['a'] }),
      ])
    );

    const run = await orchestrator.workflowEngine.runWorkflow('cascade', 'c');
    expect(run.stepResults.a.status).toBe('failed');
    expect(run.stepResults.b.status).toBe('cancelled');
    expect(run.stepResults.b.error).toMatch(/dependency "a" did not complete/);
  });
});

describe('WorkflowEngine — retries', () => {
  let orchestrator: Orchestrator;

  beforeEach(async () => {
    orchestrator = await orchestratorWithCluster('c', [agentConfig('a1')]);
  });

  afterEach(() => orchestrator.stop());

  function countingSubmit(failFirst: number) {
    let attempts = 0;
    jest
      .spyOn(orchestrator.clusterManager, 'submitTask')
      .mockImplementation(async (_clusterId, task) => {
        attempts++;
        return attempts <= failFirst
          ? { taskId: task.id, status: 'failed' as const, error: 'transient' }
          : {
              taskId: task.id,
              status: 'completed' as const,
              output: { type: 'text' as const, content: 'ok' },
            };
      });
    return () => attempts;
  }

  it('makes exactly one attempt when maxRetries is omitted', async () => {
    const attempts = countingSubmit(Infinity);
    orchestrator.workflowEngine.registerWorkflow(
      workflow('r0', [step({ id: 'a', onError: 'skip' })])
    );

    await orchestrator.workflowEngine.runWorkflow('r0', 'c');
    expect(attempts()).toBe(1);
  });

  it('makes 1 + maxRetries attempts — maxRetries means retries, not total tries', async () => {
    const attempts = countingSubmit(Infinity);
    orchestrator.workflowEngine.registerWorkflow(
      workflow('r2', [step({ id: 'a', maxRetries: 2, retryBackoffMs: 1, onError: 'skip' })])
    );

    await orchestrator.workflowEngine.runWorkflow('r2', 'c');
    expect(attempts()).toBe(3);
  });

  it('stops retrying as soon as an attempt succeeds', async () => {
    const attempts = countingSubmit(1);
    orchestrator.workflowEngine.registerWorkflow(
      workflow('r-ok', [step({ id: 'a', maxRetries: 5, retryBackoffMs: 1 })])
    );

    const run = await orchestrator.workflowEngine.runWorkflow('r-ok', 'c');
    expect(run.status).toBe('completed');
    expect(attempts()).toBe(2);
  });

  it('backs off exponentially between retries', async () => {
    countingSubmit(Infinity);
    orchestrator.workflowEngine.registerWorkflow(
      workflow('r-backoff', [
        step({ id: 'a', maxRetries: 3, retryBackoffMs: 40, onError: 'skip' }),
      ])
    );

    const startedAt = Date.now();
    await orchestrator.workflowEngine.runWorkflow('r-backoff', 'c');
    // Delays are 40 + 80 + 160 = 280ms; allow generous scheduler slack.
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(240);
  });
});

describe('WorkflowEngine — parallel execution and data flow', () => {
  it('runs independent steps concurrently across available agents', async () => {
    const orchestrator = await orchestratorWithCluster('par', [
      agentConfig('p1'),
      agentConfig('p2'),
      agentConfig('p3'),
      agentConfig('p4'),
    ]);

    orchestrator.workflowEngine.registerWorkflow(
      workflow(
        'fanout',
        [1, 2, 3, 4].map((i) => step({ id: `s${i}` }))
      )
    );

    const startedAt = Date.now();
    const run = await orchestrator.workflowEngine.runWorkflow('fanout', 'par');
    const elapsed = Date.now() - startedAt;

    expect(run.status).toBe('completed');
    // A text task sleeps 50-200ms. Four in sequence would exceed 200ms of pure
    // sleep in the worst case and average ~500ms; in parallel the level is bounded
    // by the slowest single task.
    expect(elapsed).toBeLessThan(450);

    const agentsUsed = new Set(Object.values(run.stepResults).map((r) => r.agentId));
    expect(agentsUsed.size).toBeGreaterThan(1);

    orchestrator.stop();
  });

  it('passes upstream outputs to dependent steps as inputData', async () => {
    const orchestrator = await orchestratorWithCluster('flow', [agentConfig('f1')]);
    const seen: Array<Record<string, unknown> | undefined> = [];

    const real = orchestrator.clusterManager.submitTask.bind(orchestrator.clusterManager);
    jest
      .spyOn(orchestrator.clusterManager, 'submitTask')
      .mockImplementation(async (clusterId, task) => {
        seen.push(task.payload.inputData as Record<string, unknown> | undefined);
        return real(clusterId, task);
      });

    orchestrator.workflowEngine.registerWorkflow(
      workflow('flow', [step({ id: 'up' }), step({ id: 'down', dependencies: ['up'] })])
    );

    const run = await orchestrator.workflowEngine.runWorkflow('flow', 'flow');
    expect(run.status).toBe('completed');

    expect(seen[0]).toBeUndefined(); // root step has no inputs
    expect(seen[1]).toBeDefined();
    expect(seen[1]).toHaveProperty('up');
    expect(seen[1]?.up).toBe(run.stepResults.up.output?.content);

    orchestrator.stop();
  });

  it('respects level ordering for a diamond graph', async () => {
    const orchestrator = await orchestratorWithCluster('diamond', [
      agentConfig('d1'),
      agentConfig('d2'),
    ]);
    const order: string[] = [];

    orchestrator.workflowEngine.on('event', (event) => {
      if (event.type === 'workflow:step-completed') {
        order.push((event.payload as { stepId: string }).stepId);
      }
    });

    orchestrator.workflowEngine.registerWorkflow(
      workflow('diamond', [
        step({ id: 'root' }),
        step({ id: 'left', dependencies: ['root'] }),
        step({ id: 'right', dependencies: ['root'] }),
        step({ id: 'join', dependencies: ['left', 'right'] }),
      ])
    );

    const run = await orchestrator.workflowEngine.runWorkflow('diamond', 'diamond');
    expect(run.status).toBe('completed');
    expect(order[0]).toBe('root');
    expect(order[3]).toBe('join');
    expect(order.slice(1, 3).sort()).toEqual(['left', 'right']);

    orchestrator.stop();
  });
});

describe('Orchestrator metrics', () => {
  it('reports the real knowledge entry count', async () => {
    const orchestrator = await orchestratorWithCluster('m', [agentConfig('m1')]);
    await orchestrator.knowledgeBase.addEntry({
      type: 'document',
      title: 't',
      content: 'c',
      tags: [],
    });

    // The cluster manager alone cannot see the knowledge base...
    expect(orchestrator.clusterManager.getSystemMetrics().knowledgeEntries).toBe(0);
    // ...so every consumer must read metrics through the orchestrator.
    expect(orchestrator.getSystemMetrics().knowledgeEntries).toBe(1);

    orchestrator.stop();
  });

  it('broadcasts the same knowledge count it serves over REST', async () => {
    const orchestrator = await orchestratorWithCluster('m2', [agentConfig('m2a')]);
    await orchestrator.knowledgeBase.addEntry({
      type: 'document',
      title: 't',
      content: 'c',
      tags: [],
    });

    const broadcast = new Promise<number>((resolve) => {
      orchestrator.on('event', (event) => {
        if (event.type === 'system:metrics') resolve(event.payload.knowledgeEntries);
      });
    });

    orchestrator.start(10);
    await expect(broadcast).resolves.toBe(orchestrator.getSystemMetrics().knowledgeEntries);

    orchestrator.stop();
  });
});
