import { StepResult } from './types';

/**
 * Thrown when a condition string cannot be parsed. Deliberately fatal: a guard
 * we cannot understand must not be silently treated as "skip this step".
 */
export class ConditionSyntaxError extends Error {
  constructor(condition: string, detail: string) {
    super(`Invalid step condition "${condition}": ${detail}`);
    this.name = 'ConditionSyntaxError';
  }
}

type Token = string;

const TOKEN_PATTERN = /\s*(&&|\|\||==|!=|\(|\)|'[^']*'|"[^"]*"|[A-Za-z0-9_.:-]+)/y;

function tokenize(condition: string): Token[] {
  const tokens: Token[] = [];
  TOKEN_PATTERN.lastIndex = 0;
  let position = 0;

  while (position < condition.length) {
    TOKEN_PATTERN.lastIndex = position;
    const match = TOKEN_PATTERN.exec(condition);
    if (!match) {
      if (!condition.slice(position).trim()) break;
      throw new ConditionSyntaxError(
        condition,
        `unexpected character at index ${position}`
      );
    }
    tokens.push(match[1]);
    position = TOKEN_PATTERN.lastIndex;
  }

  return tokens;
}

function unquote(token: string): string {
  const quoted =
    (token.startsWith("'") && token.endsWith("'")) ||
    (token.startsWith('"') && token.endsWith('"'));
  return quoted ? token.slice(1, -1) : token;
}

function resolvePath(
  path: string,
  stepResults: Record<string, StepResult>,
  condition: string
): string | undefined {
  const parts = path.split('.');
  if (parts[0] !== 'steps' || parts.length !== 3) {
    throw new ConditionSyntaxError(
      condition,
      `unsupported reference "${path}" (expected steps.<stepId>.status or steps.<stepId>.output)`
    );
  }

  const [, stepId, field] = parts;
  const result = stepResults[stepId];
  if (!result) return undefined;

  switch (field) {
    case 'status':
      return result.status;
    case 'output':
      return result.output;
    default:
      throw new ConditionSyntaxError(
        condition,
        `unknown field "${field}" (expected 'status' or 'output')`
      );
  }
}

/**
 * Evaluates a step guard.
 *
 *   always | never
 *   steps.<stepId>.(status|output) (== | !=) <literal>
 *   any of the above joined by && / || and grouped with parentheses
 *
 * Anything else throws rather than defaulting to false.
 */
export function evaluateCondition(
  condition: string,
  stepResults: Record<string, StepResult>
): boolean {
  const trimmed = condition.trim();
  if (trimmed === '') return true;

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return true;

  let cursor = 0;
  const peek = (): Token | undefined => tokens[cursor];
  const next = (): Token | undefined => tokens[cursor++];

  function parseOr(): boolean {
    let value = parseAnd();
    while (peek() === '||') {
      next();
      const right = parseAnd();
      value = value || right;
    }
    return value;
  }

  function parseAnd(): boolean {
    let value = parseTerm();
    while (peek() === '&&') {
      next();
      const right = parseTerm();
      value = value && right;
    }
    return value;
  }

  function parseTerm(): boolean {
    const token = next();
    if (token === undefined) {
      throw new ConditionSyntaxError(trimmed, 'unexpected end of expression');
    }

    if (token === '(') {
      const value = parseOr();
      if (next() !== ')') {
        throw new ConditionSyntaxError(trimmed, 'missing closing parenthesis');
      }
      return value;
    }

    if (token === 'always') return true;
    if (token === 'never') return false;

    const operator = peek();
    if (operator !== '==' && operator !== '!=') {
      throw new ConditionSyntaxError(
        trimmed,
        `expected '==' or '!=' after "${token}", got ${operator ?? 'end of expression'}`
      );
    }
    next();

    const rhs = next();
    if (rhs === undefined) {
      throw new ConditionSyntaxError(trimmed, `missing right-hand side after '${operator}'`);
    }

    const actual = resolvePath(token, stepResults, trimmed);
    const expected = unquote(rhs);
    return operator === '==' ? actual === expected : actual !== expected;
  }

  const result = parseOr();
  if (cursor !== tokens.length) {
    throw new ConditionSyntaxError(
      trimmed,
      `unexpected trailing input "${tokens.slice(cursor).join(' ')}"`
    );
  }
  return result;
}

/** Step IDs referenced by a condition, used to validate guards at registration time. */
export function referencedStepIds(condition: string): string[] {
  const ids: string[] = [];
  for (const token of tokenize(condition.trim())) {
    const parts = token.split('.');
    if (parts[0] === 'steps' && parts.length === 3) ids.push(parts[1]);
  }
  return ids;
}
