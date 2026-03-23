import { EventEmitter } from 'events';
import {
  KnowledgeEntry,
  KnowledgeEntryType,
  SearchQuery,
  SearchResult,
} from '@agcs/shared';
import { generateId, now, mockEmbedding, cosineSimilarity } from '../utils/helpers';
import { logger } from '../utils/logger';

export class KnowledgeBase extends EventEmitter {
  private entries: Map<string, KnowledgeEntry> = new Map();

  async addEntry(
    data: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt' | 'embedding'>
  ): Promise<KnowledgeEntry> {
    const id = generateId();
    const embedding = mockEmbedding(data.content + ' ' + data.title);
    const entry: KnowledgeEntry = {
      ...data,
      id,
      embedding,
      createdAt: now(),
      updatedAt: now(),
    };
    this.entries.set(id, entry);
    this.emit('entry:added', entry);
    logger.debug('Knowledge entry added', { id, type: data.type, title: data.title });
    return entry;
  }

  async getEntry(id: string): Promise<KnowledgeEntry | undefined> {
    return this.entries.get(id);
  }

  async updateEntry(
    id: string,
    updates: Partial<Omit<KnowledgeEntry, 'id' | 'createdAt'>>
  ): Promise<KnowledgeEntry | undefined> {
    const existing = this.entries.get(id);
    if (!existing) return undefined;

    const updated: KnowledgeEntry = {
      ...existing,
      ...updates,
      id,
      updatedAt: now(),
    };

    if (updates.content || updates.title) {
      updated.embedding = mockEmbedding(
        (updates.content ?? existing.content) + ' ' + (updates.title ?? existing.title)
      );
    }

    this.entries.set(id, updated);
    return updated;
  }

  async deleteEntry(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const queryEmbedding = mockEmbedding(query.query);
    const limit = query.limit ?? 10;

    let candidates = Array.from(this.entries.values());

    if (query.filters?.types?.length) {
      candidates = candidates.filter((e) =>
        query.filters!.types!.includes(e.type)
      );
    }
    if (query.filters?.tags?.length) {
      candidates = candidates.filter((e) =>
        query.filters!.tags!.some((tag) => e.tags.includes(tag))
      );
    }
    if (query.filters?.dateRange) {
      const { from, to } = query.filters.dateRange;
      candidates = candidates.filter(
        (e) => e.createdAt >= from && e.createdAt <= to
      );
    }

    const scored: SearchResult[] = candidates.map((entry) => ({
      entry: query.includeEmbeddings ? entry : { ...entry, embedding: undefined },
      score: entry.embedding
        ? cosineSimilarity(queryEmbedding, entry.embedding)
        : 0,
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  listByType(type: KnowledgeEntryType): KnowledgeEntry[] {
    return Array.from(this.entries.values()).filter((e) => e.type === type);
  }

  getAll(): KnowledgeEntry[] {
    return Array.from(this.entries.values());
  }

  count(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}
