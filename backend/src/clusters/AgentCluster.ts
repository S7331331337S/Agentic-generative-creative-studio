import { EventEmitter } from 'events';
import {
  ClusterConfig,
  ClusterState,
  ClusterStatus,
  TaskDefinition,
  TaskResult,
} from '@agcs/shared';
import { BaseAgent, createAgent } from '../agents';
import { now } from '../utils/helpers';
import { logger } from '../utils/logger';

interface QueueEntry {
  task: TaskDefinition;
  resolve: (result: TaskResult) => void;
  reject: (err: Error) => void;
}

export class AgentCluster extends EventEmitter {
  private config: ClusterConfig;
  private agents: Map<string, BaseAgent> = new Map();
  private taskQueue: QueueEntry[] = [];
  private state: ClusterState;

  constructor(config: ClusterConfig) {
    super();
    this.config = config;
    this.state = {
      id: config.id,
      status: 'idle',
      activeAgents: 0,
      totalAgents: 0,
      queuedTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      createdAt: now(),
      updatedAt: now(),
    };
  }

  async initialize(): Promise<void> {
    for (const agentConfig of this.config.agentConfigs) {
      const agent = createAgent(agentConfig);
      agent.on('event', (event) => this.emit('event', event));
      this.agents.set(agentConfig.id, agent);
    }
    this.updateState({ totalAgents: this.agents.size, status: 'active' });
    logger.info(`Cluster ${this.config.id} initialized with ${this.agents.size} agents`);
  }

  getId(): string {
    return this.config.id;
  }

  getConfig(): ClusterConfig {
    return { ...this.config };
  }

  getState(): ClusterState {
    return { ...this.state };
  }

  getStatus(): ClusterStatus {
    return this.state.status;
  }

  getAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  getAgent(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId);
  }

  async submitTask(task: TaskDefinition): Promise<TaskResult> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject });
      this.updateState({ queuedTasks: this.taskQueue.length });
      this.dispatch();
    });
  }

  stop(): void {
    this.updateState({ status: 'stopped' });
    for (const entry of this.taskQueue) {
      entry.reject(new Error(`Cluster ${this.config.id} stopped`));
    }
    this.taskQueue = [];
  }

  private dispatch(): void {
    if (this.state.status === 'stopped') return;
    const agent = this.selectAgent();
    if (!agent || this.taskQueue.length === 0) return;

    const entry = this.taskQueue.shift();
    if (!entry) return;

    this.updateState({
      queuedTasks: this.taskQueue.length,
      activeAgents: this.countActiveAgents() + 1,
    });

    agent
      .executeTask(entry.task)
      .then((result) => {
        if (result.status === 'completed') {
          this.updateState({
            completedTasks: this.state.completedTasks + 1,
            activeAgents: this.countActiveAgents(),
          });
        } else {
          this.updateState({
            failedTasks: this.state.failedTasks + 1,
            activeAgents: this.countActiveAgents(),
          });
        }
        entry.resolve(result);
        this.dispatch(); // Process next queued task
      })
      .catch((err: Error) => {
        this.updateState({
          failedTasks: this.state.failedTasks + 1,
          activeAgents: this.countActiveAgents(),
        });
        entry.reject(err);
        this.dispatch();
      });
  }

  private selectAgent(): BaseAgent | undefined {
    const available = Array.from(this.agents.values()).filter((a) =>
      a.isAvailable()
    );
    if (available.length === 0) return undefined;

    switch (this.config.loadBalancingStrategy) {
      case 'round-robin':
        return available[this.state.completedTasks % available.length];
      case 'least-loaded':
        return available.reduce((best, agent) =>
          agent.getState().errorCount < best.getState().errorCount ? agent : best
        );
      case 'priority-based':
      case 'capability-based':
      default:
        return available[0];
    }
  }

  private countActiveAgents(): number {
    return Array.from(this.agents.values()).filter(
      (a) => a.getStatus() === 'running'
    ).length;
  }

  private updateState(partial: Partial<ClusterState>): void {
    this.state = { ...this.state, ...partial, updatedAt: now() };
    this.emit('state', this.state);
  }
}
