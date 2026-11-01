import type { AdminAction, AnswerPayload, JoinPayload } from './schemas';
import type { AnswerValue, Question, QuestionType, SessionStatus } from './types';

export type ViewRole = 'player' | 'admin' | 'presenter';

export interface PlayerView {
  userId: string;
  displayName: string;
  avatarUrl: string;
  score: number;
  connected: boolean;
  answered: boolean;
}

/** A question as players and the presenter see it: no correct answers. */
export interface QuestionView {
  id: string;
  type: QuestionType;
  prompt: string;
  imageUrl?: string | null;
  timeLimitSec?: number | null;
  points: number;
  options: { id: string; text: string }[];
}

export interface RevealView {
  correctOptionIds: string[];
  acceptedAnswers: string[];
  numberAnswer: number | null;
  tolerance: number | null;
  /** Choice types: option id → number of players who picked it. */
  distribution: Record<string, number>;
  /** Open answers: most frequent normalized answers. */
  topAnswers: { text: string; count: number; correct: boolean }[];
  correctCount: number;
  answerCount: number;
}

export interface BuzzerView {
  locked: boolean;
  winner: { userId: string; displayName: string; avatarUrl: string } | null;
  order: { userId: string; displayName: string; at: number }[];
  lockedOut: string[];
}

export interface AdminAnswerView {
  userId: string;
  displayName: string;
  value: AnswerValue;
  correct: boolean | null;
  points: number;
  overridden: boolean;
  submittedAt: number;
}

export interface GameView {
  role: ViewRole;
  sessionId: string;
  code: string;
  title: string;
  status: SessionStatus;
  index: number;
  total: number;
  question: QuestionView | null;
  deadline: number | null;
  serverNow: number;
  /** Non-kicked players, sorted by score (desc). */
  players: PlayerView[];
  answeredCount: number;
  reveal: RevealView | null;
  buzzer: BuzzerView | null;
  me?: {
    userId: string;
    score: number;
    rank: number;
    answer: AnswerValue | null;
    /** Only filled once the answer is revealed (or judged, for buzzer). */
    result: { correct: boolean; points: number } | null;
    lockedOut: boolean;
  };
  admin?: {
    question: Question | null;
    answers: AdminAnswerView[];
    kicked: PlayerView[];
    presenterToken: string;
    adjustments: { userId: string; displayName: string; delta: number; reason: string; at: number }[];
  };
}

export type Ack = (res: { ok: true } | { ok: false; error: string }) => void;

export interface ClientToServerEvents {
  'session:join': (payload: JoinPayload, ack: Ack) => void;
  'player:answer': (payload: AnswerPayload, ack: Ack) => void;
  'player:buzz': (ack: Ack) => void;
  'admin:action': (action: AdminAction, ack: Ack) => void;
}

export interface ServerToClientEvents {
  state: (view: GameView) => void;
  kicked: () => void;
}
