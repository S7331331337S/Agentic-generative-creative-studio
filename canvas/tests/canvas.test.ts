import {
  assertVoice,
  CanvasStore,
  draftTextFormat,
  findBannedVocabulary,
  planCanvasJob,
  runCanvasJob,
  VoiceViolationError,
} from '../src';

describe('voice gate', () => {
  it('allows LABS copy that uses builder vocabulary', () => {
    expect(() =>
      assertVoice('labs', 'The agentic orchestration layer uses an LLM for CANVAS drafts.')
    ).not.toThrow();
  });

  it('rejects OPERATOR copy that mixes banned vocabulary', () => {
    expect(() =>
      assertVoice('operator', 'Our AI chatbot will auto-draft your LinkedIn.')
    ).toThrow(VoiceViolationError);
    expect(findBannedVocabulary('Our AI chatbot will auto-draft your LinkedIn.')).toEqual(
      expect.arrayContaining(['chatbot', 'AI'])
    );
  });
});

describe('CANVAS success test', () => {
  it('fans out Labs press_card + linkedin into two indexed items in one level', () => {
    const store = new CanvasStore();
    const result = runCanvasJob(store, {
      template: 'press_card',
      voice: 'labs',
      thesis:
        'MSTRMND Content Engine v2 collapses 19 editorial agents into six seats. CANVAS is the creation seat.',
      formats: ['press_card', 'linkedin'],
    });

    expect(result.plan.levels).toHaveLength(1);
    expect(result.plan.levels[0].map((s) => s.format).sort()).toEqual([
      'linkedin',
      'press_card',
    ]);
    expect(result.items).toHaveLength(2);
    expect(result.items.every((item) => item.status === 'indexed')).toBe(true);
    expect(result.items.map((item) => item.format).sort()).toEqual([
      'linkedin',
      'press_card',
    ]);
    for (const item of result.items) {
      expect(findBannedVocabulary(item.body).filter((h) => h !== 'AI')).toEqual([]);
    }
  });

  it('skips visual_spec when the SCOUT packet has no image brief', () => {
    const store = new CanvasStore();
    const job = store.startJob({
      template: 'press_card',
      voice: 'labs',
      thesis: 'One thesis in, multi-format out.',
      formats: ['press_card', 'linkedin', 'visual_spec'],
    });
    const plan = planCanvasJob(job);
    expect(plan.levels[0].map((s) => s.format).sort()).toEqual(['linkedin', 'press_card']);
  });

  it('includes visual_spec when an image brief exists', () => {
    const store = new CanvasStore();
    const result = runCanvasJob(store, {
      template: 'press_card',
      voice: 'labs',
      thesis: 'One thesis in, multi-format out.',
      scoutPacket: { imageBrief: 'Obsidian press card, platinum wordmark, no neon.' },
      formats: ['press_card', 'linkedin', 'visual_spec'],
    });
    expect(result.items.map((item) => item.format).sort()).toEqual([
      'linkedin',
      'press_card',
      'visual_spec',
    ]);
  });

  it('refuses an OPERATOR draft that mixes banned vocabulary', () => {
    const store = new CanvasStore();
    const job = store.startJob({
      template: 'linkedin',
      voice: 'operator',
      thesis: 'Cut response time under five minutes.',
      formats: ['linkedin'],
    });
    expect(() =>
      draftTextFormat(store, {
        jobId: job.id,
        format: 'linkedin',
        body: 'We use an LLM to draft this post.',
      })
    ).toThrow(VoiceViolationError);
  });

  it('routes visual_spec away from the text tool', () => {
    const store = new CanvasStore();
    const job = store.startJob({
      template: 'press_card',
      voice: 'labs',
      thesis: 'Capability routing.',
      formats: ['press_card'],
    });
    expect(() =>
      draftTextFormat(store, {
        jobId: job.id,
        format: 'visual_spec',
        body: 'should not land here',
      })
    ).toThrow(/cannot be drafted with draft_text_format/);
  });
});
