import { evaluateCondition } from './conditions';
import { toExecutionLevels, validateSteps } from './dag';
import {
  CanvasFormat,
  CanvasJob,
  DagStep,
  ExecutionPlan,
  ExecutionPlanStep,
  StepResult,
} from './types';

const TEXT_FORMATS = new Set<CanvasFormat>([
  'press_card',
  'linkedin',
  'x_thread',
  'email',
  'site',
  'proposal',
  'report',
]);

export const DEFAULT_FORMATS: CanvasFormat[] = ['press_card', 'linkedin'];

function toolFor(format: CanvasFormat): ExecutionPlanStep['tool'] {
  return format === 'visual_spec' ? 'draft_visual_spec' : 'draft_text_format';
}

/**
 * Capability routing: text formats → draft_text_format, visual_spec → draft_visual_spec.
 * Independent formats share a level (studio cluster fan-out). visual_spec is skipped
 * when the SCOUT packet has no image brief (`condition: never` analogue).
 */
export function planCanvasJob(job: CanvasJob): ExecutionPlan {
  const formats = job.formats.length > 0 ? job.formats : DEFAULT_FORMATS;
  const hasImageBrief = Boolean(job.scoutPacket.imageBrief?.trim());

  const steps: DagStep[] = formats
    .filter((format) => {
      if (format === 'visual_spec') return hasImageBrief;
      return TEXT_FORMATS.has(format);
    })
    .map((format) => ({
      id: format,
      dependencies: [],
      condition: 'always',
    }));

  if (steps.length === 0) {
    throw new Error('CANVAS job has no executable formats');
  }

  validateSteps(steps);
  const levels = toExecutionLevels(steps).map((level) =>
    level.map((step): ExecutionPlanStep => ({
      id: step.id,
      format: step.id as CanvasFormat,
      tool: toolFor(step.id as CanvasFormat),
      condition: step.condition,
    }))
  );

  return { jobId: job.id, levels };
}

/** Drop steps whose guard evaluates false. Malformed guards throw. */
export function filterLevel(
  level: ExecutionPlanStep[],
  stepResults: Record<string, StepResult>
): ExecutionPlanStep[] {
  return level.filter((step) => {
    if (!step.condition) return true;
    return evaluateCondition(step.condition, stepResults);
  });
}
