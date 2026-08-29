/** DESK-shaped intake for a CANVAS job. */
export type CanvasVoice = 'labs' | 'operator';

export type CanvasSource = 'manual' | 'calendar' | 'trigger';

export type CanvasTouchpoint =
  | 'discovery'
  | 'conversion'
  | 'onboarding'
  | 'delivery'
  | 'retention'
  | 'brand';

export type CanvasFormat =
  | 'press_card'
  | 'linkedin'
  | 'x_thread'
  | 'email'
  | 'site'
  | 'proposal'
  | 'report'
  | 'visual_spec';

export type CanvasJobStatus =
  | 'queued'
  | 'research'
  | 'drafting'
  | 'gating'
  | 'awaiting_approval'
  | 'published'
  | 'killed';

export type CanvasItemStatus = 'drafted' | 'indexed' | 'rejected';

export interface ScoutPacket {
  thesis?: string;
  citations?: string[];
  imageBrief?: string;
  notes?: string;
}

export interface DeskPayload {
  source?: CanvasSource;
  touchpoint?: CanvasTouchpoint;
  /** Primary template DESK classified. Additional formats may be requested. */
  template: CanvasFormat;
  voice: CanvasVoice;
  thesis: string;
  scoutPacket?: ScoutPacket;
  /** Formats to fan out. Defaults to press_card + linkedin. */
  formats?: CanvasFormat[];
  priority?: number;
}

export interface DagStep {
  id: string;
  dependencies?: string[];
  condition?: string;
}

export interface StepResult {
  status: string;
  output?: string;
}

export interface CanvasJob {
  id: string;
  source: CanvasSource;
  touchpoint: CanvasTouchpoint;
  template: CanvasFormat;
  voice: CanvasVoice;
  thesis: string;
  scoutPacket: ScoutPacket;
  formats: CanvasFormat[];
  status: CanvasJobStatus;
  priority: number;
  createdAt: string;
}

export interface CanvasItem {
  id: string;
  jobId: string;
  format: CanvasFormat;
  draftCycle: number;
  body: string;
  contentRef: string;
  modelUsed: string;
  status: CanvasItemStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DraftToolInput {
  jobId: string;
  format: CanvasFormat;
  body: string;
  modelUsed?: string;
}

export interface VisualSpec {
  prompt: string;
  negativePrompt: string;
  palette: string[];
  aspect: string;
}

export interface ExecutionPlanStep {
  id: string;
  format: CanvasFormat;
  tool: 'draft_text_format' | 'draft_visual_spec';
  condition?: string;
}

export interface ExecutionPlan {
  jobId: string;
  levels: ExecutionPlanStep[][];
}
