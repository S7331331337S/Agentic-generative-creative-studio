import { AgentCluster } from '../../src/clusters/AgentCluster';
import { ClusterManager } from '../../src/clusters/ClusterManager';
import { ClusterConfig, TaskDefinition } from '@agcs/shared';

function makeClusterConfig(id = 'cluster-test'): ClusterConfig {
  return {
    id,
    name: 'Test Cluster',
    agentConfigs: [
      {
        id: 'agent-1',
        name: 'Text Agent 1',
        type: 'text',
        priority: 'normal',
        maxConcurrentTasks: 1,
        contextWindowSize: 4096,
        modelConfig: { provider: 'mock', modelId: 'mock' },
      },
      {
        id: 'agent-2',
        name: 'Text Agent 2',
        type: 'text',
        priority: 'normal',
        maxConcurrentTasks: 1,
        contextWindowSize: 4096,
        modelConfig: { provider: 'mock', modelId: 'mock' },
      },
    ],
    maxAgents: 5,
    loadBalancingStrategy: 'round-robin',
    autoScale: false,
    isolationLevel: 'none',
  };
}

function makeTask(): TaskDefinition {
  return {
    id: `task-${Date.now()}-${Math.random()}`,
    type: 'generate-text',
    payload: { prompt: 'Hello world' },
    priority: 'normal',
    createdAt: Date.now(),
  };
}

describe('AgentCluster', () => {
  let cluster: AgentCluster;

  beforeEach(async () => {
    cluster = new AgentCluster(makeClusterConfig());
    await cluster.initialize();
  });

  it('initializes with correct state', () => {
    const state = cluster.getState();
    expect(state.status).toBe('active');
    expect(state.totalAgents).toBe(2);
    expect(state.completedTasks).toBe(0);
  });

  it('submits a task and returns a completed result', async () => {
    const result = await cluster.submitTask(makeTask());
    expect(result.status).toBe('completed');
    expect(result.output).toBeDefined();
  });

  it('processes multiple tasks in parallel', async () => {
    const tasks = [makeTask(), makeTask(), makeTask()];
    const results = await Promise.all(tasks.map((t) => cluster.submitTask(t)));
    expect(results.every((r) => r.status === 'completed')).toBe(true);
    expect(cluster.getState().completedTasks).toBe(3);
  });

  it('stops and rejects queued tasks', async () => {
    // Submit tasks without awaiting to fill the queue
    const promises = [makeTask(), makeTask(), makeTask()].map((t) =>
      cluster.submitTask(t).catch((e) => ({ error: e.message }))
    );
    cluster.stop();
    const results = await Promise.all(promises);
    expect(cluster.getState().status).toBe('stopped');
    // At least some tasks should have been rejected
    expect(results.some((r) => 'error' in r)).toBe(true);
  });
});

describe('ClusterManager', () => {
  let manager: ClusterManager;

  beforeEach(() => {
    manager = new ClusterManager();
  });

  afterEach(() => {
    manager.stopMetricsBroadcast();
  });

  it('creates a cluster', async () => {
    const cluster = await manager.createCluster(makeClusterConfig());
    expect(cluster.getId()).toBe('cluster-test');
    expect(manager.getAllClusters()).toHaveLength(1);
  });

  it('throws when creating duplicate cluster id', async () => {
    await manager.createCluster(makeClusterConfig());
    await expect(manager.createCluster(makeClusterConfig())).rejects.toThrow();
  });

  it('removes a cluster', async () => {
    await manager.createCluster(makeClusterConfig());
    await manager.removeCluster('cluster-test');
    expect(manager.getAllClusters()).toHaveLength(0);
  });

  it('submits a task to a cluster', async () => {
    await manager.createCluster(makeClusterConfig());
    const result = await manager.submitTask('cluster-test', makeTask());
    expect(result.status).toBe('completed');
  });

  it('returns failure result when cluster not found', async () => {
    const result = await manager.submitTask('nonexistent', makeTask());
    expect(result.status).toBe('failed');
    expect(result.error).toContain('not found');
  });

  it('returns system metrics', async () => {
    await manager.createCluster(makeClusterConfig());
    const metrics = manager.getSystemMetrics();
    expect(metrics.totalClusters).toBe(1);
    expect(metrics.totalAgents).toBe(2);
    expect(metrics.timestamp).toBeGreaterThan(0);
  });
});
