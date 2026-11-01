import { nanoid } from 'nanoid';
import { TRUE_FALSE_OPTIONS, type Question, type QuestionType } from '@/lib/types';

export const newId = () => nanoid(10);

export function newQuestion(type: QuestionType): Question {
  const base: Question = {
    id: newId(),
    type,
    prompt: '',
    imageUrl: null,
    timeLimitSec: 20,
    points: 100,
    options: [],
    acceptedAnswers: [],
    numberAnswer: null,
    tolerance: null,
  };
  switch (type) {
    case 'single':
    case 'multiple':
      return {
        ...base,
        options: Array.from({ length: 4 }, (_, i) => ({ id: newId(), text: '', correct: i === 0 })),
      };
    case 'truefalse':
      return { ...base, options: TRUE_FALSE_OPTIONS.map((o) => ({ ...o })) };
    case 'open':
      return { ...base, timeLimitSec: 30 };
    case 'number':
      return { ...base, timeLimitSec: 30, numberAnswer: 0, tolerance: 0 };
    case 'buzzer':
      return { ...base, timeLimitSec: null };
  }
}
