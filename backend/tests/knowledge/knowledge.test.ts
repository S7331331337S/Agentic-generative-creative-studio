import { KnowledgeBase } from '../../src/knowledge/KnowledgeBase';
import { ContextAggregator } from '../../src/knowledge/ContextAggregator';
import { KnowledgeEntry } from '@agcs/shared';

describe('KnowledgeBase', () => {
  let kb: KnowledgeBase;

  beforeEach(() => {
    kb = new KnowledgeBase();
  });

  it('adds and retrieves an entry', async () => {
    const entry = await kb.addEntry({
      type: 'document',
      title: 'Creative Writing Guide',
      content: 'This guide covers narrative structure and character development.',
      tags: ['writing', 'creativity'],
    });

    expect(entry.id).toBeDefined();
    expect(entry.embedding).toBeDefined();
    expect(entry.createdAt).toBeGreaterThan(0);

    const retrieved = await kb.getEntry(entry.id);
    expect(retrieved?.title).toBe('Creative Writing Guide');
  });

  it('updates an entry', async () => {
    const entry = await kb.addEntry({
      type: 'document',
      title: 'Original Title',
      content: 'Original content',
      tags: [],
    });

    const updated = await kb.updateEntry(entry.id, { title: 'Updated Title' });
    expect(updated?.title).toBe('Updated Title');
    expect(updated?.content).toBe('Original content');
  });

  it('deletes an entry', async () => {
    const entry = await kb.addEntry({
      type: 'document',
      title: 'To Delete',
      content: 'temp',
      tags: [],
    });

    const deleted = await kb.deleteEntry(entry.id);
    expect(deleted).toBe(true);
    expect(await kb.getEntry(entry.id)).toBeUndefined();
  });

  it('returns false when deleting non-existent entry', async () => {
    const deleted = await kb.deleteEntry('nonexistent-id');
    expect(deleted).toBe(false);
  });

  it('searches by semantic similarity', async () => {
    await kb.addEntry({
      type: 'document',
      title: 'Music Theory',
      content: 'Music theory covers scales, chords, and rhythm.',
      tags: ['music'],
    });
    await kb.addEntry({
      type: 'document',
      title: 'Visual Art',
      content: 'Visual art includes painting, drawing, and sculpture.',
      tags: ['art'],
    });

    const results = await kb.search({ query: 'music scales harmony', limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThanOrEqual(0);
    // Music entry should rank higher for music query
    expect(results[0].entry.title).toBe('Music Theory');
  });

  it('filters search by type', async () => {
    await kb.addEntry({
      type: 'document',
      title: 'Doc 1',
      content: 'document content',
      tags: [],
    });
    await kb.addEntry({
      type: 'dataset',
      title: 'Dataset 1',
      content: 'dataset content',
      tags: [],
    });

    const results = await kb.search({
      query: 'content',
      filters: { types: ['dataset'] },
    });
    expect(results.every((r) => r.entry.type === 'dataset')).toBe(true);
  });

  it('filters search by tags', async () => {
    await kb.addEntry({
      type: 'document',
      title: 'Tagged',
      content: 'tagged content',
      tags: ['important'],
    });
    await kb.addEntry({
      type: 'document',
      title: 'Not Tagged',
      content: 'untagged content',
      tags: [],
    });

    const results = await kb.search({
      query: 'content',
      filters: { tags: ['important'] },
    });
    expect(results.every((r) => r.entry.tags.includes('important'))).toBe(true);
  });

  it('counts entries correctly', async () => {
    expect(kb.count()).toBe(0);
    await kb.addEntry({ type: 'document', title: 'A', content: 'a', tags: [] });
    await kb.addEntry({ type: 'document', title: 'B', content: 'b', tags: [] });
    expect(kb.count()).toBe(2);
  });

  it('emits entry:added event', async () => {
    const events: KnowledgeEntry[] = [];
    kb.on('entry:added', (e) => events.push(e));
    await kb.addEntry({ type: 'document', title: 'Test', content: 'test', tags: [] });
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Test');
  });
});

describe('ContextAggregator', () => {
  let kb: KnowledgeBase;
  let aggregator: ContextAggregator;

  beforeEach(async () => {
    kb = new KnowledgeBase();
    aggregator = new ContextAggregator(kb);

    // Seed knowledge base
    await kb.addEntry({
      type: 'document',
      title: 'Generative AI',
      content: 'Generative AI creates new content using neural networks.',
      tags: ['ai', 'generative'],
    });
    await kb.addEntry({
      type: 'document',
      title: 'Creative Workflows',
      content: 'Creative workflows integrate multiple media types.',
      tags: ['creative', 'workflow'],
    });
  });

  it('builds a context snapshot from queries', async () => {
    const snapshot = await aggregator.buildContext({
      queries: ['generative AI neural networks', 'creative media'],
      agentId: 'test-agent',
    });

    expect(snapshot.id).toBeDefined();
    expect(snapshot.agentId).toBe('test-agent');
    expect(snapshot.entries.length).toBeGreaterThan(0);
    expect(snapshot.createdAt).toBeGreaterThan(0);
  });

  it('resolves a context snapshot to knowledge entries', async () => {
    const snapshot = await aggregator.buildContext({
      queries: ['generative AI'],
    });

    const entries = await aggregator.resolveSnapshot(snapshot.id);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => typeof e.title === 'string')).toBe(true);
  });

  it('returns empty array for unknown snapshot', async () => {
    const entries = await aggregator.resolveSnapshot('nonexistent');
    expect(entries).toEqual([]);
  });

  it('deduplicates entries across multiple queries', async () => {
    const snapshot = await aggregator.buildContext({
      queries: ['generative AI', 'generative AI neural'],
    });
    // Check no duplicate IDs
    const uniqueIds = new Set(snapshot.entries);
    expect(uniqueIds.size).toBe(snapshot.entries.length);
  });
});
