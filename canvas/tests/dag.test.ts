import {
  ConditionSyntaxError,
  toExecutionLevels,
  validateSteps,
  WorkflowValidationError,
} from '../src';
import { DagStep } from '../src/types';

function step(id: string, dependencies?: string[], condition?: string): DagStep {
  return { id, dependencies, condition };
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
});
