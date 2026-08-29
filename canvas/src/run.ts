import { CanvasItem, DeskPayload, ExecutionPlan, StepResult } from './types';
import { draftTextFormat, draftVisualSpec, indexItem } from './drafts';
import { filterLevel, planCanvasJob } from './fanout';
import { CanvasStore } from './store';

export interface RunCanvasResult {
  jobId: string;
  plan: ExecutionPlan;
  items: CanvasItem[];
}

/**
 * Execute a DESK-shaped payload: start job, fan out independent formats,
 * draft, then index. This is the studio cluster idea without Express.
 */
export function runCanvasJob(
  store: CanvasStore,
  payload: DeskPayload,
  drafts: Partial<Record<string, string>> = {}
): RunCanvasResult {
  const job = store.startJob(payload);
  const plan = planCanvasJob(job);
  const stepResults: Record<string, StepResult> = {};
  const items: CanvasItem[] = [];

  for (const level of plan.levels) {
    const runnable = filterLevel(level, stepResults);
    for (const step of runnable) {
      const body = drafts[step.format] ?? defaultDraft(job.voice, job.thesis, step.format);
      const item =
        step.tool === 'draft_visual_spec'
          ? draftVisualSpec(store, { jobId: job.id, prompt: body })
          : draftTextFormat(store, {
              jobId: job.id,
              format: step.format,
              body,
            });
      const indexed = indexItem(store, item.id);
      items.push(indexed);
      stepResults[step.id] = { status: 'completed', output: indexed.body };
    }
  }

  job.status = 'awaiting_approval';
  return { jobId: job.id, plan, items };
}

function defaultDraft(voice: string, thesis: string, format: string): string {
  if (voice === 'labs') {
    return [
      `## ${format}`,
      '',
      thesis,
      '',
      'Architecture: one pipeline, six seats, N templates. CANVAS fans out formats in parallel.',
      'Next: human one-tap before HERALD.',
    ].join('\n');
  }
  return [
    `## ${format}`,
    '',
    thesis,
    '',
    'What ships: classified job in, two drafts out, waiting on one-tap approval.',
    'What this is not: a new product surface.',
  ].join('\n');
}
