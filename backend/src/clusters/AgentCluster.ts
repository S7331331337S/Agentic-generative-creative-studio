import { EventEmitter } from 'events';
import {
  ClusterConfig,
  ClusterState,
  ClusterStatus,
  TaskDefinition,
  TaskResult,
} from '@agcs/shared';
import { BaseAgent, createAgent } from '../agents';
import { canAgentHandle, now, priorityRank } from '../utils/helpers';
import { logger } from '../utils/logger';

interface QueueEntry {
  task: TaskDefinition;
  resolve: (result: TaskResult) => void;
  reject: (err: Error) => void;
  enqueuedAt: number;
}

export class AgentCluster extends EventEmitter {
  private config: ClusterConfig;
  private agents: Map<string, BaseAgent> = new Map();
  private taskQueue: QueueEntry[] = [];
  private state: ClusterState;
  /** Rotation cursor for round-robin. Advances once per dispatch, not per completion. */
  private roundRobinCursor = 0;

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
      // A resumed agent frees capacity that queued work may have been waiting on.
      agent.on('available', () => this.dispatch());
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
    if (this.state.status === 'stopped') {
      return {
        taskId: task.id,
        status: 'failed',
        error: `Cluster ${this.config.id} is stopped`,
      };
    }

    // Reject up front rather than queueing work no agent in this cluster can serve.
    if (!this.getAgents().some((a) => canAgentHandle(a.getConfig().type, task.type))) {
      return {
        taskId: task.id,
        status: 'failed',
        error: `Cluster ${this.config.id} has no agent capable of task type '${task.type}'`,
      };
    }

    return new Promise((resolve, reject) => {
      this.enqueue({ task, resolve, reject, enqueuedAt: now() });
      this.updateState({ queuedTasks: this.taskQueue.length });
      this.dispatch();
    });
  }

  stop(): void {
    this.updateState({ status: 'stopped' });
    const queued = this.taskQueue;
    this.taskQueue = [];
    this.updateState({ queuedTasks: 0 });
    for (const entry of queued) {
      entry.reject(new Error(`Cluster ${this.config.id} stopped`));
    }
  }

  /** Insert by priority, FIFO within a priority band. */
  private enqueue(entry: QueueEntry): void {
    const rank = priorityRank(entry.task.priority);
    const insertAt = this.taskQueue.findIndex(
      (queued) => priorityRank(queued.task.priority) < rank
    );
    if (insertAt === -1) {
      this.taskQueue.push(entry);
    } else {
      this.taskQueue.splice(insertAt, 0, entry);
    }
  }

  /**
   * Drains the queue against all currently free capacity. Loops rather than
   * dispatching a single task, so freeing one slot can start several tasks when
   * multiple agents are idle.
   */
  private dispatch(): void {
    if (this.state.status === 'stopped') return;

    for (;;) {
      const next = this.taskQueue[0];
      if (!next) break;

      const agent = this.selectAgent(next.task);
      if (!agent) break; // At capacity; a completing task will re-drive this.

      this.taskQueue.shift();
      this.runOnAgent(agent, next);
    }

    this.updateState({
      queuedTasks: this.taskQueue.length,
      activeAgents: this.countActiveAgents(),
    });
  }

  private runOnAgent(agent: BaseAgent, entry: QueueEntry): void {
    agent
      .executeTask(entry.task)
      .then((result) => {
        this.updateState(
          result.status === 'completed'
            ? { completedTasks: this.state.completedTasks + 1 }
            : { failedTasks: this.state.failedTasks + 1 }
        );
        entry.resolve(result);
      })
      .catch((err: Error) => {
        this.updateState({ failedTasks: this.state.failedTasks + 1 });
        entry.reject(err);
      })
      .finally(() => {
        this.updateState({ activeAgents: this.countActiveAgents() });
        this.dispatch();
      });
  }

  /**
   * Picks a free agent that can actually serve this task type. Returns undefined
   * when the cluster is at capacity — never an agent of the wrong type.
   */
  private selectAgent(task: TaskDefinition): BaseAgent | undefined {
    const candidates = Array.from(this.agents.values()).filter(
      (a) => a.isAvailable() && canAgentHandle(a.getConfig().type, task.type)
    );
    if (candidates.length === 0) return undefined;

    switch (this.config.loadBalancingStrategy) {
      case 'round-robin': {
        const agent = candidates[this.roundRobinCursor % candidates.length];
        this.roundRobinCursor = (this.roundRobinCursor + 1) % Number.MAX_SAFE_INTEGER;
        return agent;
      }

      case 'least-loaded':
        return candidates.reduce((best, agent) =>
          agent.getActiveTaskCount() < best.getActiveTaskCount() ? agent : best
        );

      case 'priority-based':
        return candidates.reduce((best, agent) =>
          priorityRank(agent.getConfig().priority) >
          priorityRank(best.getConfig().priority)
            ? agent
            : best
        );

      case 'capability-based':
      default: {
        // Prefer a specialist so multimodal generalists stay free for compose work.
        const specialised = candidates.find((a) => a.getConfig().type !== 'multimodal');
        return specialised ?? candidates[0];
      }
    }
  }

  private countActiveAgents(): number {
    return Array.from(this.agents.values()).filter((a) => a.getActiveTaskCount() > 0)
      .length;
  }

  private updateState(partial: Partial<ClusterState>): void {
    this.state = { ...this.state, ...partial, updatedAt: now() };
    this.emit('state', this.state);
  }
}
