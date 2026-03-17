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
import { generateId, now } from '../utils/helpers';
import { logger } from '../utils/logger';

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

  registerWorkflow(definition: WorkflowDefinition): void {
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

  private async executeSteps(
    run: WorkflowRun,
    steps: WorkflowStep[],
    clusterId: string,
    inputOverrides: Record<string, unknown>
  ): Promise<void> {
    // Topological sort based on dependencies
    const sorted = this.topologicalSort(steps);

    for (const step of sorted) {
      // Check conditions
      if (step.condition && !this.evaluateCondition(step.condition, run.stepResults)) {
        logger.debug('Step skipped by condition', { stepId: step.id });
        continue;
      }

      // Gather context from knowledge base
      const contextSnapshot = await this.contextAggregator.buildContext({
        queries: [step.payload.prompt ?? step.name],
        workflowRunId: run.id,
      });

      // Merge step payload with overrides
      const payload = { ...step.payload, ...inputOverrides };

      const task: TaskDefinition = {
        id: generateId(),
        type: step.taskType,
        payload,
        priority: 'normal',
        clusterId,
        workflowId: run.workflowId,
        stepIndex: sorted.indexOf(step),
        contextIds: [contextSnapshot.id],
        createdAt: now(),
      };

      let result: TaskResult = { taskId: task.id, status: 'pending' };
      let attempts = 0;
      const maxRetries = step.maxRetries ?? 1;

      do {
        attempts++;
        result = await this.clusterManager.submitTask(clusterId, task);
        if (result.status === 'completed') break;
        if (attempts < maxRetries) {
          logger.warn('Retrying step', { stepId: step.id, attempt: attempts });
        }
      } while (attempts < maxRetries);

      run.stepResults[step.id] = result;
      this.emitRunEvent('workflow:step-completed', { run, stepId: step.id, result });

      if (result.status === 'failed' && step.onError === 'fail') {
        throw new Error(`Step ${step.id} failed: ${result.error}`);
      }

      // Store output in knowledge base for subsequent steps
      if (result.output) {
        const contentStr =
          typeof result.output.content === 'string'
            ? result.output.content
            : JSON.stringify(result.output.content);

        await this.knowledgeBase.addEntry({
          type: 'model-output',
          title: `Output of step ${step.name} (run ${run.id})`,
          content: contentStr,
          tags: ['workflow-output', `run:${run.id}`, `step:${step.id}`],
          sourceId: task.id,
        });
      }
    }
  }

  private topologicalSort(steps: WorkflowStep[]): WorkflowStep[] {
    const indexed = new Map(steps.map((s) => [s.id, s]));
    const visited = new Set<string>();
    const sorted: WorkflowStep[] = [];

    const visit = (step: WorkflowStep) => {
      if (visited.has(step.id)) return;
      visited.add(step.id);
      for (const depId of step.dependencies ?? []) {
        const dep = indexed.get(depId);
        if (dep) visit(dep);
      }
      sorted.push(step);
    };

    steps.forEach(visit);
    return sorted;
  }

  private evaluateCondition(
    condition: string,
    _stepResults: Record<string, TaskResult>
  ): boolean {
    // Simple condition: "always" or unknown conditions default to true
    return condition === 'always' || condition === '';
  }

  private emitRunEvent<T>(type: string, payload: T): void {
    this.emit('event', { type, payload, timestamp: now() });
  }
}
