import { TaskResult } from '@agcs/shared';
import {
  ConditionSyntaxError,
  evaluateCondition,
  referencedStepIds,
} from '../../src/orchestration/conditions';

const results: Record<string, TaskResult> = {
  a: {
    taskId: 't-a',
    status: 'completed',
    output: { type: 'text', content: 'hello world' },
  },
  b: { taskId: 't-b', status: 'failed', error: 'boom' },
  c: {
    taskId: 't-c',
    status: 'completed',
    output: { type: 'json', content: { k: 1 } },
  },
};

describe('evaluateCondition', () => {
  it('treats empty and "always" as true, "never" as false', () => {
    expect(evaluateCondition('', results)).toBe(true);
    expect(evaluateCondition('   ', results)).toBe(true);
    expect(evaluateCondition('always', results)).toBe(true);
    expect(evaluateCondition('never', results)).toBe(false);
  });

  it('compares step status with == and !=', () => {
    expect(evaluateCondition("steps.a.status == 'completed'", results)).toBe(true);
    expect(evaluateCondition("steps.a.status != 'completed'", results)).toBe(false);
    expect(evaluateCondition("steps.b.status == 'failed'", results)).toBe(true);
    expect(evaluateCondition('steps.b.status == completed', results)).toBe(false);
  });

  it('accepts single quotes, double quotes and bare literals', () => {
    expect(evaluateCondition("steps.a.status == 'completed'", results)).toBe(true);
    expect(evaluateCondition('steps.a.status == "completed"', results)).toBe(true);
    expect(evaluateCondition('steps.a.status == completed', results)).toBe(true);
  });

  it('compares step output, serialising non-string content', () => {
    expect(evaluateCondition("steps.a.output == 'hello world'", results)).toBe(true);
    expect(evaluateCondition('steps.c.output == \'{"k":1}\'', results)).toBe(true);
  });

  it('combines terms with && and ||', () => {
    expect(
      evaluateCondition("steps.a.status == 'completed' && steps.b.status == 'failed'", results)
    ).toBe(true);
    expect(
      evaluateCondition("steps.a.status == 'failed' && steps.b.status == 'failed'", results)
    ).toBe(false);
    expect(
      evaluateCondition("steps.a.status == 'failed' || steps.b.status == 'failed'", results)
    ).toBe(true);
  });

  it('respects parenthesised grouping', () => {
    const expression =
      "(steps.a.status == 'failed' || steps.b.status == 'failed') && steps.a.status == 'completed'";
    expect(evaluateCondition(expression, results)).toBe(true);
  });

  it('treats a reference to a step with no result as unequal to everything', () => {
    expect(evaluateCondition("steps.missing.status == 'completed'", results)).toBe(false);
    expect(evaluateCondition("steps.missing.status != 'completed'", results)).toBe(true);
  });

  // The regression that mattered: an unparseable guard used to silently skip the step.
  it.each([
    'steps.a.status',
    'steps.a.status >= 3',
    'steps.a.status ==',
    'steps.a',
    'steps.a.bogus == 1',
    'totally bogus',
    "(steps.a.status == 'completed'",
    "steps.a.status == 'completed' extra",
  ])('throws ConditionSyntaxError for %p instead of returning false', (expression) => {
    expect(() => evaluateCondition(expression, results)).toThrow(ConditionSyntaxError);
  });
});

describe('referencedStepIds', () => {
  it('extracts every step id a condition depends on', () => {
    expect(
      referencedStepIds("steps.a.status == 'completed' && steps.b.output != 'x'")
    ).toEqual(['a', 'b']);
  });

  it('returns nothing for constant conditions', () => {
    expect(referencedStepIds('always')).toEqual([]);
  });
});
