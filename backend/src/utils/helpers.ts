import { randomUUID } from 'node:crypto';
import { AgentPriority, AgentType, TaskType } from '@agcs/shared';

export function generateId(): string {
  return randomUUID();
}

/**
 * Which agent types are capable of serving a given task type.
 * Ordered most-specialised first so schedulers can prefer a dedicated agent
 * over a generalist multimodal one.
 */
const TASK_CAPABILITY: Record<TaskType, AgentType[]> = {
  'generate-text': ['text', 'multimodal'],
  'generate-image': ['image', 'multimodal'],
  'generate-audio': ['audio', 'multimodal'],
  compose: ['multimodal'],
  analyze: ['text', 'multimodal'],
  transform: ['text', 'multimodal'],
};

export function agentTypesForTaskType(taskType: TaskType): AgentType[] {
  return TASK_CAPABILITY[taskType] ?? [];
}

export function canAgentHandle(agentType: AgentType, taskType: TaskType): boolean {
  return agentTypesForTaskType(taskType).includes(agentType);
}

/** Higher number wins. Used to order the cluster queue and break scheduling ties. */
const PRIORITY_RANK: Record<AgentPriority, number> = {
  critical: 3,
  high: 2,
  normal: 1,
  low: 0,
};

export function priorityRank(priority: AgentPriority | undefined): number {
  return PRIORITY_RANK[priority ?? 'normal'] ?? 1;
}

export function now(): number {
  return Date.now();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Generates a simple mock embedding vector from text.
 * In production this would call an embedding API.
 */
export function mockEmbedding(text: string, dimensions = 128): number[] {
  const embedding = new Array<number>(dimensions).fill(0);
  for (let i = 0; i < text.length; i++) {
    embedding[i % dimensions] += text.charCodeAt(i) / 128;
  }
  const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0)) || 1;
  return embedding.map((v) => v / norm);
}
