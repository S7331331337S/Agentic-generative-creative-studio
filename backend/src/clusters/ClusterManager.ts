import { EventEmitter } from 'events';
import {
  ClusterConfig,
  ClusterState,
  SystemMetrics,
  TaskDefinition,
  TaskResult,
} from '@agcs/shared';
import { AgentCluster } from './AgentCluster';
import { generateId, now } from '../utils/helpers';
import { logger } from '../utils/logger';

export class ClusterManager extends EventEmitter {
  private clusters: Map<string, AgentCluster> = new Map();
  private metricsInterval?: ReturnType<typeof setInterval>;

  constructor() {
    super();
  }

  async createCluster(config: Omit<ClusterConfig, 'id'> & { id?: string }): Promise<AgentCluster> {
    const id = config.id ?? generateId();
    const fullConfig: ClusterConfig = { ...config, id };

    if (this.clusters.has(id)) {
      throw new Error(`Cluster with id ${id} already exists`);
    }

    const cluster = new AgentCluster(fullConfig);
    cluster.on('event', (event) => this.emit('event', event));
    cluster.on('state', (state: ClusterState) => {
      logger.debug('Cluster state updated', { clusterId: state.id, status: state.status });
      this.emit('cluster:state', state);
    });

    await cluster.initialize();
    this.clusters.set(id, cluster);

    logger.info(`Cluster created: ${id} (${fullConfig.name})`);
    return cluster;
  }

  getCluster(id: string): AgentCluster | undefined {
    return this.clusters.get(id);
  }

  getAllClusters(): AgentCluster[] {
    return Array.from(this.clusters.values());
  }

  async removeCluster(id: string): Promise<void> {
    const cluster = this.clusters.get(id);
    if (!cluster) {
      throw new Error(`Cluster ${id} not found`);
    }
    cluster.stop();
    this.clusters.delete(id);
    logger.info(`Cluster removed: ${id}`);
  }

  async submitTask(clusterId: string, task: TaskDefinition): Promise<TaskResult> {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) {
      return {
        taskId: task.id,
        status: 'failed',
        error: `Cluster ${clusterId} not found`,
      };
    }
    return cluster.submitTask(task);
  }

  getSystemMetrics(): SystemMetrics {
    const clusters = this.getAllClusters();
    const states = clusters.map((c) => c.getState());

    const allAgentStates = clusters.flatMap((c) =>
      c.getAgents().map((a) => a.getState())
    );

    const systemCpuPercent =
      allAgentStates.reduce((s, a) => s + a.resourceUsage.cpuPercent, 0) /
      (allAgentStates.length || 1);

    const systemMemoryMb = allAgentStates.reduce(
      (s, a) => s + a.resourceUsage.memoryMb,
      0
    );

    return {
      timestamp: now(),
      totalAgents: allAgentStates.length,
      activeAgents: allAgentStates.filter((a) => a.status === 'running').length,
      totalClusters: clusters.length,
      activeClusters: states.filter((s) => s.status === 'active').length,
      tasksQueued: states.reduce((s, c) => s + c.queuedTasks, 0),
      tasksCompleted: states.reduce((s, c) => s + c.completedTasks, 0),
      tasksFailed: states.reduce((s, c) => s + c.failedTasks, 0),
      knowledgeEntries: 0, // Updated by orchestrator
      systemMemoryMb,
      systemCpuPercent,
    };
  }

  startMetricsBroadcast(intervalMs = 5000): void {
    this.metricsInterval = setInterval(() => {
      const metrics = this.getSystemMetrics();
      this.emit('event', { type: 'system:metrics', payload: metrics, timestamp: now() });
    }, intervalMs);
  }

  stopMetricsBroadcast(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
  }
}
