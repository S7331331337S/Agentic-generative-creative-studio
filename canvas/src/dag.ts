import { DagStep } from './types';
import { referencedStepIds } from './conditions';

/** Thrown when a workflow's step graph is not a valid DAG. */
export class WorkflowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowValidationError';
  }
}

/**
 * Rejects duplicate step IDs, dangling dependency/condition references, and
 * dependency cycles. Called at registration so a bad workflow can never reach
 * execution and report a misleading "completed".
 *
 * Extracted from the studio WorkflowEngine — the scheduling reference MSTRMND
 * CANVAS reuses. This package does not import the Express dashboard.
 */
export function validateSteps(steps: DagStep[]): void {
  if (steps.length === 0) {
    throw new WorkflowValidationError('Workflow must declare at least one step');
  }

  const byId = new Map<string, DagStep>();
  for (const step of steps) {
    if (!step.id) {
      throw new WorkflowValidationError('Every step requires a non-empty id');
    }
    if (byId.has(step.id)) {
      throw new WorkflowValidationError(`Duplicate step id "${step.id}"`);
    }
    byId.set(step.id, step);
  }

  for (const step of steps) {
    for (const dependencyId of step.dependencies ?? []) {
      if (!byId.has(dependencyId)) {
        throw new WorkflowValidationError(
          `Step "${step.id}" depends on unknown step "${dependencyId}"`
        );
      }
      if (dependencyId === step.id) {
        throw new WorkflowValidationError(`Step "${step.id}" depends on itself`);
      }
    }

    if (step.condition) {
      for (const referenced of referencedStepIds(step.condition)) {
        if (!byId.has(referenced)) {
          throw new WorkflowValidationError(
            `Condition on step "${step.id}" references unknown step "${referenced}"`
          );
        }
      }
    }
  }

  detectCycle(steps, byId);
}

function detectCycle(steps: DagStep[], byId: Map<string, DagStep>): void {
  const UNVISITED = 0;
  const IN_PROGRESS = 1;
  const DONE = 2;
  const marks = new Map<string, number>(steps.map((s) => [s.id, UNVISITED]));

  const walk = (stepId: string, trail: string[]): void => {
    const mark = marks.get(stepId);
    if (mark === DONE) return;
    if (mark === IN_PROGRESS) {
      const cycleStart = trail.indexOf(stepId);
      const cycle = [...trail.slice(cycleStart), stepId].join(' -> ');
      throw new WorkflowValidationError(`Workflow contains a dependency cycle: ${cycle}`);
    }

    marks.set(stepId, IN_PROGRESS);
    for (const dependencyId of byId.get(stepId)?.dependencies ?? []) {
      walk(dependencyId, [...trail, stepId]);
    }
    marks.set(stepId, DONE);
  };

  for (const step of steps) walk(step.id, []);
}

/**
 * Groups steps into dependency levels. Every step in a level is independent of
 * its siblings, so a level can be executed concurrently.
 */
export function toExecutionLevels(steps: DagStep[]): DagStep[][] {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const depth = new Map<string, number>();

  const depthOf = (stepId: string): number => {
    const cached = depth.get(stepId);
    if (cached !== undefined) return cached;

    const dependencies = byId.get(stepId)?.dependencies ?? [];
    const value = dependencies.length
      ? Math.max(...dependencies.map((id) => depthOf(id) + 1))
      : 0;
    depth.set(stepId, value);
    return value;
  };

  const levels: DagStep[][] = [];
  for (const step of steps) {
    const level = depthOf(step.id);
    (levels[level] ??= []).push(step);
  }
  return levels.filter((level) => level && level.length > 0);
}
