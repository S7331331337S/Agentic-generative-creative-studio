import { randomUUID } from 'crypto';
import {
  CanvasItem,
  CanvasJob,
  DeskPayload,
} from './types';
import { DEFAULT_FORMATS } from './fanout';

/** In-memory ce_jobs / ce_items stand-in. MSTRMND persists these in Supabase. */
export class CanvasStore {
  readonly jobs = new Map<string, CanvasJob>();
  readonly items = new Map<string, CanvasItem>();

  startJob(payload: DeskPayload): CanvasJob {
    const job: CanvasJob = {
      id: randomUUID(),
      source: payload.source ?? 'manual',
      touchpoint: payload.touchpoint ?? 'brand',
      template: payload.template,
      voice: payload.voice,
      thesis: payload.thesis,
      scoutPacket: payload.scoutPacket ?? {},
      formats: payload.formats ?? DEFAULT_FORMATS,
      status: 'drafting',
      priority: payload.priority ?? 3,
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);
    return job;
  }

  requireJob(jobId: string): CanvasJob {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Unknown CANVAS job "${jobId}"`);
    }
    return job;
  }

  addItem(item: CanvasItem): CanvasItem {
    this.items.set(item.id, item);
    return item;
  }

  itemsForJob(jobId: string): CanvasItem[] {
    return [...this.items.values()].filter((item) => item.jobId === jobId);
  }
}
