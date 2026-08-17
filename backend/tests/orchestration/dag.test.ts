import { WorkflowStep } from '@agcs/shared';
import {
  toExecutionLevels,
  validateSteps,
  WorkflowValidationError,
} from '../../src/orchestration/dag';
import { ConditionSyntaxError } from '../../src/orchestration/conditions';

function step(id: string, dependencies?: string[], condition?: string): WorkflowStep {
  return {
    id,
    name: id,
    taskType: 'generate-text',
    agentType: 'text',
    payload: { prompt: id },
    dependencies,
    condition,
  };
}

describe('validateSteps', () => {
  it('accepts a well-formed DAG', () => {
    expect(() =>
      validateSteps([step('a'), step('b', ['a']), step('c', ['a', 'b'])])
    ).not.toThrow();
  });

  it('rejects an empty workflow', () => {
    expect(() => validateSteps([])).toThrow(WorkflowValidationError);
  });

  it('rejects duplicate step ids', () => {
    expect(() => validateSteps([step('a'), step('a')])).toThrow(/Duplicate step id "a"/);
  });

  it('rejects a dependency on an unknown step', () => {
    expect(() => validateSteps([step('a', ['ghost'])])).toThrow(
      /depends on unknown step "ghost"/
    );
  });

  it('rejects a self-dependency', () => {
    expect(() => validateSteps([step('a', ['a'])])).toThrow(/depends on itself/);
  });

  it('rejects a two-node cycle', () => {
    expect(() => validateSteps([step('a', ['b']), step('b', ['a'])])).toThrow(
      /dependency cycle/
    );
  });

  it('rejects a longer cycle and names the path', () => {
    expect(() =>
      validateSteps([step('a', ['c']), step('b', ['a']), step('c', ['b'])])
    ).toThrow(/dependency cycle: a -> c -> b -> a/);
  });

  it('rejects a condition referencing an unknown step', () => {
    expect(() =>
      validateSteps([step('a'), step('b', ['a'], "steps.ghost.status == 'completed'")])
    ).toThrow(/references unknown step "ghost"/);
  });

  it('rejects a malformed condition at registration time', () => {
    expect(() => validateSteps([step('a', undefined, 'a >= b')])).toThrow(
      ConditionSyntaxError
    );
  });
});

describe('toExecutionLevels', () => {
  it('puts fully independent steps in a single level', () => {
    const levels = toExecutionLevels([step('a'), step('b'), step('c')]);
    expect(levels).toHaveLength(1);
    expect(levels[0].map((s) => s.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('produces one level per dependency depth', () => {
    const levels = toExecutionLevels([step('a'), step('b', ['a']), step('c', ['b'])]);
    expect(levels.map((l) => l.map((s) => s.id))).toEqual([['a'], ['b'], ['c']]);
  });

  it('groups a diamond into three levels with the middle pair parallel', () => {
    const levels = toExecutionLevels([
      step('root'),
      step('left', ['root']),
      step('right', ['root']),
      step('join', ['left', 'right']),
    ]);
    expect(levels).toHaveLength(3);
    expect(levels[0].map((s) => s.id)).toEqual(['root']);
    expect(levels[1].map((s) => s.id).sort()).toEqual(['left', 'right']);
    expect(levels[2].map((s) => s.id)).toEqual(['join']);
  });

  it('places a step below its deepest dependency', () => {
    const levels = toExecutionLevels([
      step('a'),
      step('b', ['a']),
      step('c', ['b']),
      step('d', ['a', 'c']),
    ]);
    expect(levels[3].map((s) => s.id)).toEqual(['d']);
  });

  it('is independent of declaration order', () => {
    const levels = toExecutionLevels([step('c', ['b']), step('b', ['a']), step('a')]);
    expect(levels.map((l) => l.map((s) => s.id))).toEqual([['a'], ['b'], ['c']]);
  });
});
