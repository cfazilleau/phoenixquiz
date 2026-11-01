export const QUESTION_TYPES = ['single', 'multiple', 'truefalse', 'open', 'number', 'buzzer'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const CHOICE_TYPES: readonly QuestionType[] = ['single', 'multiple', 'truefalse'];
export const isChoiceType = (t: QuestionType) => CHOICE_TYPES.includes(t);

export type Role = 'superadmin' | 'admin' | 'player';
export const isAdminRole = (r: Role | undefined | null) => r === 'admin' || r === 'superadmin';

export interface ChoiceOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  imageUrl?: string | null;
  /** Seconds; null/undefined means the admin closes the question manually. */
  timeLimitSec?: number | null;
  points: number;
  /** single / multiple / truefalse */
  options: ChoiceOption[];
  /** open: accepted answers. buzzer: expected answer shown to the admin and revealed. */
  acceptedAnswers: string[];
  /** number */
  numberAnswer?: number | null;
  tolerance?: number | null;
}

/** Choice types: selected option ids. Open: text. Number: number. Buzzer: 'buzz'. */
export type AnswerValue = string[] | string | number;

export type SessionStatus = 'lobby' | 'question' | 'closed' | 'reveal' | 'leaderboard' | 'ended';

export const TRUE_FALSE_OPTIONS: ChoiceOption[] = [
  { id: 'true', text: 'True', correct: true },
  { id: 'false', text: 'False', correct: false },
];
