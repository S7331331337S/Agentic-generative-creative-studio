import { EventEmitter } from 'events';
import {
  TaskDefinition,
  TaskResult,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowStep,
} from '@agcs/shared';
import { ClusterManager } from '../clusters/ClusterManager';
import { KnowledgeBase } from '../knowledge/KnowledgeBase';
import { ContextAggregator } from '../knowledge/ContextAggregator';
import { generateId, now, sleep } from '../utils/helpers';
import { logger } from '../utils/logger';
import { evaluateCondition } from './conditions';
import { toExecutionLevels, validateSteps, WorkflowValidationError } from './dag';

const DEFAULT_RETRY_BACKOFF_MS = 100;

export { WorkflowValidationError };

export class WorkflowEngine extends EventEmitter {
  private clusterManager: ClusterManager;
  private knowledgeBase: KnowledgeBase;
  private contextAggregator: ContextAggregator;
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private runs: Map<string, WorkflowRun> = new Map();

  constructor(
    clusterManager: ClusterManager,
    knowledgeBase: KnowledgeBase,
    contextAggregator: ContextAggregator
  ) {
    super();
    this.clusterManager = clusterManager;
    this.knowledgeBase = knowledgeBase;
    this.contextAggregator = contextAggregator;
  }

  /** @throws WorkflowValidationError | ConditionSyntaxError if the graph is not a valid DAG. */
  registerWorkflow(definition: WorkflowDefinition): void {
    validateSteps(definition.steps);
    this.workflows.set(definition.id, definition);
    logger.info('Workflow registered', { id: definition.id, name: definition.name });
  }

  getWorkflow(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id);
  }

  listWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  async runWorkflow(
    workflowId: string,
    clusterId: string,
    inputOverrides?: Record<string, unknown>
  ): Promise<WorkflowRun> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const runId = generateId();
    const run: WorkflowRun = {
      id: runId,
      workflowId,
      status: 'active',
      stepResults: {},
      startedAt: now(),
    };
    this.runs.set(runId, run);
    this.emitRunEvent('workflow:started', run);

    try {
      await this.executeSteps(run, workflow.steps, clusterId, inputOverrides ?? {});
      run.status = 'completed';
      run.completedAt = now();
      this.emitRunEvent('workflow:completed', run);
    } catch (err) {
      run.status = 'failed';
      run.completedAt = now();
      run.error = err instanceof Error ? err.message : String(err);
      logger.error('Workflow run failed', { runId, error: run.error });
      this.emitRunEvent('workflow:failed', run);
    }

    this.runs.set(runId, run);
    return run;
  }

  getRunStatus(runId: string): WorkflowRun | undefined {
    return this.runs.get(runId);
  }

  listRuns(workflowId?: string): WorkflowRun[] {
    const runs = Array.from(this.runs.values());
    return workflowId ? runs.filter((r) => r.workflowId === workflowId) : runs;
  }

  /**
   * Executes the graph level by level. Steps within a level have no dependency
   * on one another and run concurrently; the cluster decides how much of that
   * concurrency it can actually absorb.
   */
  private async executeSteps(
    run: WorkflowRun,
    steps: WorkflowStep[],
    clusterId: string,
    inputOverrides: Record<string, unknown>
  ): Promise<void> {
    const levels = toExecutionLevels(steps);
    const skipped = new Set<string>();

    for (const level of levels) {
      const outcomes = await Promise.all(
        level.map((step) => this.executeStep(run, step, clusterId, inputOverrides, skipped))
      );

      // Surface a hard failure only once the whole level has settled, so sibling
      // steps are never abandoned mid-flight.
      const fatal = outcomes.find((o) => o.fatalError);
      if (fatal?.fatalError) throw fatal.fatalError;
    }
  }

  private async executeStep(
    run: WorkflowRun,
    step: WorkflowStep,
    clusterId: string,
    inputOverrides: Record<string, unknown>,
    skipped: Set<string>
  ): Promise<{ fatalError?: Error }> {
    const dependencies = step.dependencies ?? [];

    // A step whose dependency never produced a usable result cannot run.
    const blocker = dependencies.find(
      (id) => skipped.has(id) || run.stepResults[id]?.status !== 'completed'
    );
    if (blocker) {
      this.recordSkip(
        run,
        step,
        skipped,
        `dependency "${blocker}" did not complete successfully`
      );
      return {};
    }

    if (step.condition !== undefined) {
      let allowed: boolean;
      try {
        allowed = evaluateCondition(step.condition, run.stepResults);
      } catch (err) {
        // A malformed guard is a workflow authoring bug: fail loudly.
        return { fatalError: err instanceof Error ? err : new Error(String(err)) };
      }
      if (!allowed) {
        this.recordSkip(run, step, skipped, `condition "${step.condition}" evaluated false`);
        return {};
      }
    }

    const contextSnapshot = await this.contextAggregator.buildContext({
      queries: [step.payload.prompt ?? step.name],
      workflowRunId: run.id,
    });

    const task: TaskDefinition = {
      id: generateId(),
      type: step.taskType,
      payload: {
        ...step.payload,
        ...inputOverrides,
        // Make upstream results addressable by dependent steps.
        inputData: this.collectDependencyOutputs(run, dependencies),
      },
      priority: 'normal',
      clusterId,
      workflowId: run.workflowId,
      contextIds: [contextSnapshot.id],
      dependencies,
      createdAt: now(),
    };

    const result = await this.runWithRetries(step, clusterId, task);
    run.stepResults[step.id] = result;
    this.emitRunEvent('workflow:step-completed', { run, stepId: step.id, result });

    if (result.status === 'failed') {
      const onError = step.onError ?? 'fail';
      if (onError === 'fail') {
        return { fatalError: new Error(`Step ${step.id} failed: ${result.error}`) };
      }
      skipped.add(step.id);
      logger.warn('Step failed but onError=skip; continuing', {
        stepId: step.id,
        error: result.error,
      });
      return {};
    }

    await this.indexStepOutput(run, step, task, result);
    return {};
  }

  /** Attempts = 1 initial try + maxRetries, with exponential backoff in between. */
  private async runWithRetries(
    step: WorkflowStep,
    clusterId: string,
    task: TaskDefinition
  ): Promise<TaskResult> {
    const retries = Math.max(0, step.maxRetries ?? 0);
    const backoffMs = step.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS;
    let result: TaskResult = { taskId: task.id, status: 'pending' };

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        const delay = backoffMs * 2 ** (attempt - 1);
        logger.warn('Retrying step', { stepId: step.id, attempt, delayMs: delay });
        await sleep(delay);
      }
      result = await this.clusterManager.submitTask(clusterId, task);
      if (result.status === 'completed') return result;
    }

    return result;
  }

  private collectDependencyOutputs(
    run: WorkflowRun,
    dependencies: string[]
  ): Record<string, unknown> | undefined {
    if (dependencies.length === 0) return undefined;
    const inputs: Record<string, unknown> = {};
    for (const id of dependencies) {
      inputs[id] = run.stepResults[id]?.output?.content;
    }
    return inputs;
  }

  private recordSkip(
    run: WorkflowRun,
    step: WorkflowStep,
    skipped: Set<string>,
    reason: string
  ): void {
    skipped.add(step.id);
    const result: TaskResult = {
      taskId: `skipped-${step.id}`,
      status: 'cancelled',
      error: `Step skipped: ${reason}`,
    };
    run.stepResults[step.id] = result;
    logger.debug('Step skipped', { stepId: step.id, reason });
    this.emitRunEvent('workflow:step-completed', { run, stepId: step.id, result });
  }

  private async indexStepOutput(
    run: WorkflowRun,
    step: WorkflowStep,
    task: TaskDefinition,
    result: TaskResult
  ): Promise<void> {
    if (!result.output) return;

    const content =
      typeof result.output.content === 'string'
        ? result.output.content
        : JSON.stringify(result.output.content);

    await this.knowledgeBase.addEntry({
      type: 'model-output',
      title: `Output of step ${step.name} (run ${run.id})`,
      content,
      tags: ['workflow-output', `run:${run.id}`, `step:${step.id}`],
      sourceId: task.id,
    });
  }

  private emitRunEvent<T>(type: string, payload: T): void {
    this.emit('event', { type, payload, timestamp: now() });
  }
}
