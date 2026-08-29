import { CanvasVoice } from './types';

/**
 * OPERATOR-voice banned vocabulary. Whole-word / phrase match.
 * LABS voice may use these; OPERATOR voice must not.
 */
export const OPERATOR_BANNED: readonly string[] = [
  'agentic',
  'llm',
  'gpt',
  'claude',
  'grok',
  'copilot',
  'chatbot',
  'generative ai',
  'prompt engineering',
  'neural network',
  'transformer model',
  'hallucination',
  'fine-tune',
  'fine tune',
  'rag',
  'embeddings',
  'vector database',
  'foundation model',
  'multi-agent',
  'multi agent',
  'orchestration',
  'inference',
  'artificial intelligence',
];

export class VoiceViolationError extends Error {
  readonly matches: string[];

  constructor(matches: string[]) {
    super(
      `OPERATOR voice rejected: banned vocabulary (${matches.join(', ')}). ` +
        'CIPHER is deferred — CANVAS refuses contaminated drafts at write time.'
    );
    this.name = 'VoiceViolationError';
    this.matches = matches;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Returns banned phrases found in `text`. Empty when clean. */
export function findBannedVocabulary(text: string): string[] {
  const haystack = text.toLowerCase();
  const hits: string[] = [];

  for (const phrase of OPERATOR_BANNED) {
    const pattern = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'i');
    if (pattern.test(haystack)) hits.push(phrase);
  }

  // Standalone "AI" / "A.I." — too short for the phrase list.
  if (/\ba\.?i\.?\b/i.test(haystack)) hits.push('AI');

  return [...new Set(hits)];
}

/**
 * Hard gate: OPERATOR drafts containing banned vocabulary fail loudly.
 * LABS drafts always pass this check.
 */
export function assertVoice(voice: CanvasVoice, body: string): void {
  if (voice !== 'operator') return;
  const matches = findBannedVocabulary(body);
  if (matches.length > 0) {
    throw new VoiceViolationError(matches);
  }
}

export const LABS_VOICE_SUMMARY =
  'LABS voice: technical, architectural, builder audience. AI vocabulary allowed. ' +
  'Show systems, not slogans. Cite structure. Platinum on obsidian.';

export const OPERATOR_VOICE_SUMMARY =
  'OPERATOR voice: plain business language, numbers-first. AI vocabulary banned. ' +
  'Lead with the outcome, the number, and the next action.';
