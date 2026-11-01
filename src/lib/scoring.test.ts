import { describe, expect, it } from 'vitest';
import { isAnswerCorrect, isValidAnswerShape, normalizeText, pointsFor } from './scoring';
import type { Question } from './types';

const base: Omit<Question, 'type'> = {
  id: 'q',
  prompt: 'p',
  points: 100,
  options: [],
  acceptedAnswers: [],
};

const single: Question = {
  ...base,
  type: 'single',
  options: [
    { id: 'a', text: 'A', correct: false },
    { id: 'b', text: 'B', correct: true },
  ],
};
const multiple: Question = {
  ...base,
  type: 'multiple',
  options: [
    { id: 'a', text: 'A', correct: true },
    { id: 'b', text: 'B', correct: false },
    { id: 'c', text: 'C', correct: true },
  ],
};

describe('normalizeText', () => {
  it('ignores case, accents, punctuation and extra spaces', () => {
    expect(normalizeText('  Saint-Étienne!! ')).toBe('saint etienne');
    expect(normalizeText('ÇA   va')).toBe('ca va');
  });
});

describe('isAnswerCorrect', () => {
  it('single choice', () => {
    expect(isAnswerCorrect(single, ['b'])).toBe(true);
    expect(isAnswerCorrect(single, ['a'])).toBe(false);
    expect(isAnswerCorrect(single, ['a', 'b'])).toBe(false);
  });

  it('true/false', () => {
    const tf: Question = {
      ...base,
      type: 'truefalse',
      options: [
        { id: 'true', text: 'True', correct: false },
        { id: 'false', text: 'False', correct: true },
      ],
    };
    expect(isAnswerCorrect(tf, ['false'])).toBe(true);
    expect(isAnswerCorrect(tf, ['true'])).toBe(false);
  });

  it('multiple choice is all-or-nothing', () => {
    expect(isAnswerCorrect(multiple, ['c', 'a'])).toBe(true);
    expect(isAnswerCorrect(multiple, ['a'])).toBe(false);
    expect(isAnswerCorrect(multiple, ['a', 'b', 'c'])).toBe(false);
    expect(isAnswerCorrect(multiple, [])).toBe(false);
  });

  it('open answers match normalized text', () => {
    const open: Question = { ...base, type: 'open', acceptedAnswers: ['Paris', 'Lutèce'] };
    expect(isAnswerCorrect(open, ' paris ')).toBe(true);
    expect(isAnswerCorrect(open, 'LUTECE')).toBe(true);
    expect(isAnswerCorrect(open, 'Lyon')).toBe(false);
    expect(isAnswerCorrect(open, '   ')).toBe(false);
  });

  it('number answers use the tolerance', () => {
    const num: Question = { ...base, type: 'number', numberAnswer: 1789, tolerance: 2 };
    expect(isAnswerCorrect(num, 1789)).toBe(true);
    expect(isAnswerCorrect(num, 1791)).toBe(true);
    expect(isAnswerCorrect(num, 1792)).toBe(false);
    expect(isAnswerCorrect({ ...num, tolerance: null }, 1789)).toBe(true);
    expect(isAnswerCorrect({ ...num, tolerance: null }, 1790)).toBe(false);
  });

  it('buzzer questions are judged by the admin', () => {
    expect(isAnswerCorrect({ ...base, type: 'buzzer' }, 'buzz')).toBeNull();
  });
});

describe('pointsFor', () => {
  it('awards flat points only when correct', () => {
    expect(pointsFor(single, true)).toBe(100);
    expect(pointsFor(single, false)).toBe(0);
    expect(pointsFor(single, null)).toBe(0);
  });
});

describe('isValidAnswerShape', () => {
  it('rejects unknown options and wrong types', () => {
    expect(isValidAnswerShape(single, ['z'])).toBe(false);
    expect(isValidAnswerShape(single, 'b')).toBe(false);
    expect(isValidAnswerShape(multiple, ['a', 'a'])).toBe(false);
    expect(isValidAnswerShape(multiple, ['a', 'c'])).toBe(true);
    expect(isValidAnswerShape({ ...base, type: 'number' }, '12')).toBe(false);
    expect(isValidAnswerShape({ ...base, type: 'open' }, 'x'.repeat(201))).toBe(false);
  });
});
