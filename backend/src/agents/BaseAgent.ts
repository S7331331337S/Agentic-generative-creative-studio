import { EventEmitter } from 'events';
import {
  AgentConfig,
  AgentState,
  AgentStatus,
  TaskDefinition,
  TaskResult,
  TaskStatus,
  WsEvent,
} from '@agcs/shared';
import { generateId, now } from '../utils/helpers';
import { logger } from '../utils/logger';

export abstract class BaseAgent extends EventEmitter {
  protected config: AgentConfig;
  protected state: AgentState;

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

  isAvailable(): boolean {
    return this.state.status === 'idle';
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

    this.setStatus('running', task);
    const startedAt = now();

    try {
      logger.debug(`Agent ${this.config.id} starting task ${task.id}`, {
        type: task.type,
      });

      const output = await this.processTask(task);

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
      this.setStatus('idle');
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
      this.setStatus('idle');
      this.emitEvent('task:failed', result);
      return result;
    }
  }

  pause(): void {
    if (this.state.status === 'running') {
      this.setStatus('paused');
    }
  }

  resume(): void {
    if (this.state.status === 'paused') {
      this.setStatus('idle');
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
