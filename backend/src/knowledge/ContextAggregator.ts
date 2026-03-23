import { ContextSnapshot, KnowledgeEntry, SearchResult } from '@agcs/shared';
import { KnowledgeBase } from './KnowledgeBase';
import { generateId, now } from '../utils/helpers';
import { logger } from '../utils/logger';

export class ContextAggregator {
  private snapshots: Map<string, ContextSnapshot> = new Map();
  private knowledgeBase: KnowledgeBase;

  constructor(knowledgeBase: KnowledgeBase) {
    this.knowledgeBase = knowledgeBase;
  }

  /**
   * Build a context snapshot for an agent/workflow by searching the knowledge base
   * with multiple related queries and aggregating the most relevant entries.
   */
  async buildContext(params: {
    queries: string[];
    agentId?: string;
    clusterId?: string;
    workflowRunId?: string;
    maxEntries?: number;
  }): Promise<ContextSnapshot> {
    const maxEntries = params.maxEntries ?? 20;
    const seenIds = new Set<string>();
    const allResults: SearchResult[] = [];

    for (const query of params.queries) {
      const results = await this.knowledgeBase.search({
        query,
        limit: Math.ceil(maxEntries / params.queries.length),
      });
      for (const result of results) {
        if (!seenIds.has(result.entry.id)) {
          seenIds.add(result.entry.id);
          allResults.push(result);
        }
      }
    }

    // Sort by score and take top-N
    const topEntries = allResults
      .sort((a, b) => b.score - a.score)
      .slice(0, maxEntries)
      .map((r) => r.entry.id);

    const snapshot: ContextSnapshot = {
      id: generateId(),
      agentId: params.agentId,
      clusterId: params.clusterId,
      workflowRunId: params.workflowRunId,
      entries: topEntries,
      createdAt: now(),
    };

    this.snapshots.set(snapshot.id, snapshot);
    logger.debug('Context snapshot created', {
      id: snapshot.id,
      entryCount: topEntries.length,
    });
    return snapshot;
  }

  /**
   * Retrieve the knowledge entries from a context snapshot.
   */
  async resolveSnapshot(snapshotId: string): Promise<KnowledgeEntry[]> {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return [];

    const entries: KnowledgeEntry[] = [];
    for (const entryId of snapshot.entries) {
      const entry = await this.knowledgeBase.getEntry(entryId);
      if (entry) entries.push(entry);
    }
    return entries;
  }

  getSnapshot(id: string): ContextSnapshot | undefined {
    return this.snapshots.get(id);
  }

  listSnapshots(): ContextSnapshot[] {
    return Array.from(this.snapshots.values());
  }
}
