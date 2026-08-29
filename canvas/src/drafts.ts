import { randomUUID } from 'crypto';
import { CanvasStore } from './store';
import { CanvasFormat, CanvasItem, VisualSpec } from './types';
import { assertVoice } from './voice';

const TEXT_FORMATS = new Set<CanvasFormat>([
  'press_card',
  'linkedin',
  'x_thread',
  'email',
  'site',
  'proposal',
  'report',
]);

export class DraftCapabilityError extends Error {
  constructor(format: CanvasFormat, tool: string) {
    super(`Format "${format}" cannot be drafted with ${tool}`);
    this.name = 'DraftCapabilityError';
  }
}

function persistItem(
  store: CanvasStore,
  jobId: string,
  format: CanvasFormat,
  body: string,
  modelUsed: string,
  metadata: Record<string, unknown>
): CanvasItem {
  const id = randomUUID();
  return store.addItem({
    id,
    jobId,
    format,
    draftCycle: 1,
    body,
    contentRef: `ce_items/${id}`,
    modelUsed,
    status: 'drafted',
    metadata,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Text-format worker. Specialists only — visual_spec is rejected here
 * (studio capability routing: specialist over generalist).
 */
export function draftTextFormat(
  store: CanvasStore,
  input: { jobId: string; format: CanvasFormat; body: string; modelUsed?: string }
): CanvasItem {
  const job = store.requireJob(input.jobId);
  if (!TEXT_FORMATS.has(input.format)) {
    throw new DraftCapabilityError(input.format, 'draft_text_format');
  }
  assertVoice(job.voice, input.body);
  return persistItem(store, job.id, input.format, input.body, input.modelUsed ?? 'canvas-text', {
    voice: job.voice,
    template: job.template,
  });
}

const PALETTE = ['#0a0a0b', '#e8e2d0', '#8a8580'];

/**
 * Visual-spec worker. Builds an image-gen prompt from design tokens + thesis.
 * Does not call an image model — CIPHER / Phase 2 video stay deferred.
 */
export function draftVisualSpec(
  store: CanvasStore,
  input: { jobId: string; prompt?: string; modelUsed?: string }
): CanvasItem {
  const job = store.requireJob(input.jobId);
  const brief = job.scoutPacket.imageBrief?.trim() || job.thesis;
  const spec: VisualSpec = {
    prompt:
      input.prompt?.trim() ||
      [
        'Dark Swiss editorial still.',
        `Obsidian ground ${PALETTE[0]}, platinum type ${PALETTE[1]}, graphite accent ${PALETTE[2]}.`,
        'No neon, no decorative gradient, no stock-handshake cliché.',
        `Subject: ${brief}`,
      ].join(' '),
    negativePrompt: 'neon, rainbow gradient, cluttered UI, watermark, cartoon mascot',
    palette: [...PALETTE],
    aspect: '16:9',
  };
  assertVoice(job.voice, spec.prompt);
  return persistItem(
    store,
    job.id,
    'visual_spec',
    JSON.stringify(spec, null, 2),
    input.modelUsed ?? 'canvas-visual-spec',
    { voice: job.voice, kind: 'visual_spec' }
  );
}

/** Marks a drafted item indexed so CIPHER (later) can pick it up. */
export function indexItem(store: CanvasStore, itemId: string): CanvasItem {
  const item = store.items.get(itemId);
  if (!item) {
    throw new Error(`Unknown CANVAS item "${itemId}"`);
  }
  item.status = 'indexed';
  item.metadata = {
    ...item.metadata,
    indexedAt: new Date().toISOString(),
    tags: ['canvas-output', `job:${item.jobId}`, `format:${item.format}`],
  };
  return item;
}
