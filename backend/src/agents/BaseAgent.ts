import { EventEmitter } from 'events';
import {
  AgentConfig,
  AgentState,
  AgentStatus,
  TaskDefinition,
  TaskResult,
  WsEvent,
} from '@agcs/shared';
import { generateId, now } from '../utils/helpers';
import { logger } from '../utils/logger';

const DEFAULT_TASK_TIMEOUT_MS = 30_000;

export abstract class BaseAgent extends EventEmitter {
  protected config: AgentConfig;
  protected state: AgentState;
  /** In-flight task count. Bounded by config.maxConcurrentTasks. */
  private activeTasks = 0;

  constructor(config: AgentConfig) {
    super();
    this.config = config;
    this.state = {
      id: config.id,
      status: 'idle',
      completedTasks: 0,
      errorCount: 0,
      lastHeartbeat: now(),
      resourceUsage: { cpuPercent: 0, memoryMb: 0, activeConnections: 0 },
    };
  }

  getId(): string {
    return this.config.id;
  }

  getConfig(): AgentConfig {
    return { ...this.config };
  }

  getState(): AgentState {
    return { ...this.state };
  }

  getStatus(): AgentStatus {
    return this.state.status;
  }

  /** Concurrency ceiling for this agent; always at least 1. */
  getMaxConcurrentTasks(): number {
    return Math.max(1, this.config.maxConcurrentTasks ?? 1);
  }

  /** Number of tasks currently in flight — the real signal for load balancing. */
  getActiveTaskCount(): number {
    return this.activeTasks;
  }

  isAvailable(): boolean {
    if (this.state.status === 'paused' || this.state.status === 'error') {
      return false;
    }
    return this.activeTasks < this.getMaxConcurrentTasks();
  }

  async executeTask(task: TaskDefinition): Promise<TaskResult> {
    if (!this.isAvailable()) {
      return {
        taskId: task.id,
        status: 'failed',
        error: `Agent ${this.config.id} is not available (status: ${this.state.status})`,
        agentId: this.config.id,
      };
    }

    this.activeTasks++;
    this.setStatus('running', task);
    const startedAt = now();

    try {
      logger.debug(`Agent ${this.config.id} starting task ${task.id}`, {
        type: task.type,
      });

      const output = await this.withTimeout(this.processTask(task), task);

      const result: TaskResult = {
        taskId: task.id,
        status: 'completed',
        output,
        startedAt,
        completedAt: now(),
        agentId: this.config.id,
        metrics: {
          durationMs: now() - startedAt,
          modelCalls: 1,
          contextRetrievals: task.contextIds?.length ?? 0,
        },
      };

      this.state.completedTasks++;
      this.releaseSlot();
      this.emitEvent('task:completed', result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error(`Agent ${this.config.id} failed task ${task.id}`, { error });

      const result: TaskResult = {
        taskId: task.id,
        status: 'failed',
        error,
        startedAt,
        completedAt: now(),
        agentId: this.config.id,
      };

      this.state.errorCount++;
      this.releaseSlot();
      this.emitEvent('task:failed', result);
      return result;
    }
  }

  /**
   * A task that never settles would otherwise pin its concurrency slot forever
   * and stall the cluster queue behind it.
   */
  private withTimeout<T>(work: Promise<T>, task: TaskDefinition): Promise<T> {
    const timeoutMs = this.config.taskTimeoutMs ?? DEFAULT_TASK_TIMEOUT_MS;
    let timer: ReturnType<typeof setTimeout>;

    return Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `Task ${task.id} timed out after ${timeoutMs}ms on agent ${this.config.id}`
              )
            ),
          timeoutMs
        );
      }),
    ]).finally(() => clearTimeout(timer)) as Promise<T>;
  }

  /** Frees a concurrency slot and returns to idle only once fully drained. */
  private releaseSlot(): void {
    this.activeTasks = Math.max(0, this.activeTasks - 1);
    if (this.activeTasks === 0) {
      this.setStatus('idle');
    } else {
      this.state.lastHeartbeat = now();
      this.emitEvent('agent:status', this.getState());
    }
  }

  /** Stops the agent accepting new work. In-flight tasks are allowed to finish. */
  pause(): void {
    if (this.state.status !== 'paused') {
      this.setStatus('paused');
    }
  }

  /**
   * Returns the agent to service. Emits 'agent:available' so an owning cluster
   * can drain any queue that backed up while this agent was unavailable.
   */
  resume(): void {
    if (this.state.status === 'paused') {
      this.setStatus(this.activeTasks > 0 ? 'running' : 'idle');
      this.emit('available', this.getId());
    }
  }

  protected setStatus(status: AgentStatus, task?: TaskDefinition): void {
    this.state.status = status;
    this.state.lastHeartbeat = now();
    if (task) {
      this.state.currentTask = task;
    } else if (status === 'idle') {
      this.state.currentTask = undefined;
    }
    this.emitEvent('agent:status', this.getState());
  }

  protected emitEvent<T>(type: WsEvent['type'], payload: T): void {
    const event: WsEvent<T> = { type, payload, timestamp: now() };
    this.emit('event', event);
  }

  protected updateResourceUsage(cpu: number, memory: number): void {
    this.state.resourceUsage = {
      cpuPercent: cpu,
      memoryMb: memory,
      activeConnections: this.state.resourceUsage.activeConnections,
    };
  }

  /** Subclasses implement this to perform actual work */
  protected abstract processTask(task: TaskDefinition): Promise<TaskResult['output']>;

  static createId(): string {
    return generateId();
  }
}
