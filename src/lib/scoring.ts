import type { AnswerValue, Question } from './types';

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Returns whether an answer is correct, or null when the question can only be judged
 * by the admin (buzzer).
 */
export function isAnswerCorrect(q: Question, value: AnswerValue): boolean | null {
  switch (q.type) {
    case 'single':
    case 'truefalse': {
      const ids = Array.isArray(value) ? value : [String(value)];
      if (ids.length !== 1) return false;
      return q.options.some((o) => o.id === ids[0] && o.correct);
    }
    case 'multiple': {
      if (!Array.isArray(value)) return false;
      const picked = new Set(value);
      const correct = new Set(q.options.filter((o) => o.correct).map((o) => o.id));
      if (picked.size !== correct.size) return false;
      for (const id of picked) if (!correct.has(id)) return false;
      return true;
    }
    case 'open': {
      if (typeof value !== 'string') return false;
      const given = normalizeText(value);
      if (!given) return false;
      return q.acceptedAnswers.some((a) => normalizeText(a) === given);
    }
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n) || q.numberAnswer == null) return false;
      return Math.abs(n - q.numberAnswer) <= Math.abs(q.tolerance ?? 0);
    }
    case 'buzzer':
      return null;
  }
}

export function pointsFor(q: Question, correct: boolean | null): number {
  return correct ? q.points : 0;
}

/** Validates the shape of an answer for a question type (not correctness). */
export function isValidAnswerShape(q: Question, value: unknown): value is AnswerValue {
  switch (q.type) {
    case 'single':
    case 'truefalse':
      return Array.isArray(value) && value.length === 1 && q.options.some((o) => o.id === value[0]);
    case 'multiple':
      return (
        Array.isArray(value) &&
        value.length > 0 &&
        new Set(value).size === value.length &&
        value.every((v) => q.options.some((o) => o.id === v))
      );
    case 'open':
      return typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'buzzer':
      return false;
  }
}
