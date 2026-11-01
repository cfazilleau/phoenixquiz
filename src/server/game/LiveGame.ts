import type {
  AdminAnswerView,
  BuzzerView,
  GameView,
  PlayerView,
  QuestionView,
  RevealView,
  ViewRole,
} from '@/lib/game-types';
import type { AdminAction } from '@/lib/schemas';
import { isAnswerCorrect, isValidAnswerShape, normalizeText, pointsFor } from '@/lib/scoring';
import { isChoiceType, type AnswerValue, type Question, type SessionStatus } from '@/lib/types';

export interface PlayerState {
  userId: string;
  discordId: string;
  displayName: string;
  avatarUrl: string;
  kicked: boolean;
  joinedAt: number;
}

export interface AnswerRecord {
  questionId: string;
  userId: string;
  value: AnswerValue;
  submittedAt: number;
  correct: boolean | null;
  pointsAwarded: number;
  overriddenBy: string | null;
}

export interface Adjustment {
  userId: string;
  delta: number;
  reason: string;
  by: string;
  at: number;
}

export interface BuzzerState {
  locked: boolean;
  winnerId: string | null;
  order: { userId: string; at: number }[];
  lockedOut: string[];
}

export interface GameSnapshot {
  sessionId: string;
  code: string;
  title: string;
  presenterToken: string;
  questions: Question[];
  status: SessionStatus;
  index: number;
  players: PlayerState[];
  adjustments: Adjustment[];
  buzzEvents: { questionId: string; userId: string; at: number }[];
  buzzer: BuzzerState;
  deadline: number | null;
  startedAt: number | null;
  endedAt: number | null;
}

export interface PersistedState extends GameSnapshot {
  scores: Record<string, number>;
}

export interface GameStore {
  saveSession(state: PersistedState): Promise<void>;
  saveAnswer(sessionId: string, answer: AnswerRecord): Promise<void>;
}

export type Result = { ok: true } | { ok: false; error: string };
const ok: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

/** Late answers within this window after the deadline are still accepted (network latency). */
const DEADLINE_GRACE_MS = 750;
const CHANGE_THROTTLE_MS = 50;

const emptyBuzzer = (): BuzzerState => ({ locked: false, winnerId: null, order: [], lockedOut: [] });

/**
 * Authoritative state of one running session. Node runs every handler on a single thread,
 * so each method executes atomically: the first `buzz` call to arrive always wins.
 */
export class LiveGame {
  private s: GameSnapshot;
  /** questionId → userId → answer */
  private answers = new Map<string, Map<string, AnswerRecord>>();
  private presence = new Map<string, number>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private changeTimer: ReturnType<typeof setTimeout> | null = null;
  private saveChain: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();

  constructor(
    snapshot: GameSnapshot,
    answers: AnswerRecord[],
    private store: GameStore,
  ) {
    this.s = structuredClone(snapshot);
    for (const a of answers) this.answersFor(a.questionId).set(a.userId, a);
    if (this.s.status === 'question' && this.s.deadline) this.armTimer();
  }

  // ---------- accessors ----------

  get sessionId() {
    return this.s.sessionId;
  }
  get code() {
    return this.s.code;
  }
  get status() {
    return this.s.status;
  }
  get presenterToken() {
    return this.s.presenterToken;
  }
  get currentQuestion(): Question | null {
    if (this.s.status === 'lobby') return null;
    return this.s.questions[this.s.index] ?? null;
  }
  get buzzerState(): BuzzerState {
    return this.s.buzzer;
  }
  player(userId: string) {
    return this.s.players.find((p) => p.userId === userId);
  }
  answerOf(questionId: string, userId: string) {
    return this.answers.get(questionId)?.get(userId) ?? null;
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Waits for pending writes (tests, shutdown). */
  async flushSaves() {
    await this.saveChain;
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    if (this.changeTimer) clearTimeout(this.changeTimer);
    this.listeners.clear();
  }

  // ---------- players ----------

  addPlayer(p: Omit<PlayerState, 'kicked' | 'joinedAt'>): Result {
    const existing = this.player(p.userId);
    if (existing) {
      if (existing.kicked) return fail('kicked');
      existing.displayName = p.displayName;
      existing.avatarUrl = p.avatarUrl;
      return ok;
    }
    if (this.s.status === 'ended') return fail('ended');
    this.s.players.push({ ...p, kicked: false, joinedAt: Date.now() });
    this.persist();
    this.changed();
    return ok;
  }

  connect(userId: string) {
    this.presence.set(userId, (this.presence.get(userId) ?? 0) + 1);
    this.changed();
  }

  disconnect(userId: string) {
    const n = (this.presence.get(userId) ?? 1) - 1;
    if (n <= 0) this.presence.delete(userId);
    else this.presence.set(userId, n);
    this.changed();
  }

  isConnected(userId: string) {
    return (this.presence.get(userId) ?? 0) > 0;
  }

  // ---------- player actions ----------

  answer(userId: string, questionId: string, value: unknown): Result {
    const q = this.currentQuestion;
    const p = this.player(userId);
    if (!p || p.kicked) return fail('not_in_game');
    if (this.s.status !== 'question' || !q || q.id !== questionId) return fail('question_closed');
    if (q.type === 'buzzer') return fail('invalid_answer');
    if (this.s.deadline && Date.now() > this.s.deadline + DEADLINE_GRACE_MS) return fail('question_closed');
    if (this.answerOf(q.id, userId)) return fail('already_answered');
    if (!isValidAnswerShape(q, value)) return fail('invalid_answer');

    const correct = isAnswerCorrect(q, value);
    const record: AnswerRecord = {
      questionId: q.id,
      userId,
      value: typeof value === 'string' ? value.trim() : value,
      submittedAt: Date.now(),
      correct,
      pointsAwarded: pointsFor(q, correct),
      overriddenBy: null,
    };
    this.answersFor(q.id).set(userId, record);
    this.saveAnswer(record);

    if (this.everyoneAnswered()) this.close();
    else this.changed();
    return ok;
  }

  buzz(userId: string): Result {
    const q = this.currentQuestion;
    const p = this.player(userId);
    if (!p || p.kicked) return fail('not_in_game');
    if (this.s.status !== 'question' || q?.type !== 'buzzer') return fail('question_closed');
    const b = this.s.buzzer;
    if (b.lockedOut.includes(userId)) return fail('locked_out');
    if (b.locked && !b.winnerId) return fail('buzzer_locked');
    if (b.order.some((o) => o.userId === userId)) return fail('already_buzzed');

    const at = Date.now();
    b.order.push({ userId, at });
    this.s.buzzEvents.push({ questionId: q.id, userId, at });
    if (!b.winnerId) {
      b.winnerId = userId;
      b.locked = true;
    }
    this.persist();
    this.changed(true);
    return ok;
  }

  // ---------- admin actions ----------

  admin(action: AdminAction, adminId: string): Result {
    switch (action.type) {
      case 'start':
        if (this.s.status !== 'lobby') return fail('invalid_state');
        if (this.s.questions.length === 0) return fail('no_questions');
        this.s.startedAt = Date.now();
        return this.goto(0);
      case 'next':
        if (this.s.status === 'lobby') return this.admin({ type: 'start' }, adminId);
        if (this.s.status === 'ended') return fail('invalid_state');
        if (this.s.index + 1 >= this.s.questions.length) return fail('no_more_questions');
        return this.goto(this.s.index + 1);
      case 'goto':
        if (this.s.status === 'ended') return fail('invalid_state');
        if (action.index >= this.s.questions.length) return fail('invalid_index');
        if (this.s.status === 'lobby') this.s.startedAt = Date.now();
        return this.goto(action.index);
      case 'close':
        if (this.s.status !== 'question') return fail('invalid_state');
        this.close();
        return ok;
      case 'reveal':
        if (this.s.status !== 'question' && this.s.status !== 'closed') return fail('invalid_state');
        this.stopTimer();
        this.s.status = 'reveal';
        this.s.deadline = null;
        this.s.buzzer.locked = true;
        return this.commit();
      case 'leaderboard':
        if (this.s.status === 'lobby' || this.s.status === 'ended') return fail('invalid_state');
        this.stopTimer();
        this.s.status = 'leaderboard';
        this.s.deadline = null;
        return this.commit();
      case 'end':
        if (this.s.status === 'ended') return fail('invalid_state');
        this.stopTimer();
        this.s.status = 'ended';
        this.s.deadline = null;
        this.s.endedAt = Date.now();
        return this.commit();
      case 'kick': {
        const p = this.player(action.userId);
        if (!p) return fail('unknown_player');
        p.kicked = true;
        return this.commit();
      }
      case 'unkick': {
        const p = this.player(action.userId);
        if (!p) return fail('unknown_player');
        p.kicked = false;
        return this.commit();
      }
      case 'adjustScore': {
        if (!this.player(action.userId)) return fail('unknown_player');
        if (action.delta === 0) return ok;
        this.s.adjustments.push({
          userId: action.userId,
          delta: action.delta,
          reason: action.reason,
          by: adminId,
          at: Date.now(),
        });
        return this.commit();
      }
      case 'override': {
        const q = this.s.questions.find((x) => x.id === action.questionId);
        const a = this.answerOf(action.questionId, action.userId);
        if (!q || !a) return fail('unknown_answer');
        a.correct = action.correct;
        a.pointsAwarded = pointsFor(q, action.correct);
        a.overriddenBy = adminId;
        this.saveAnswer(a);
        this.changed();
        return ok;
      }
      case 'buzzerLock':
        if (!this.isBuzzerQuestion()) return fail('invalid_state');
        this.s.buzzer.locked = true;
        return this.commit();
      case 'buzzerUnlock':
        if (!this.isBuzzerQuestion()) return fail('invalid_state');
        if (this.s.buzzer.winnerId) return this.admin({ type: 'buzzerReset', lockOutPrevious: false }, adminId);
        this.s.buzzer.locked = false;
        return this.commit();
      case 'buzzerReset': {
        if (!this.isBuzzerQuestion()) return fail('invalid_state');
        const b = this.s.buzzer;
        const q = this.currentQuestion!;
        // Lock out whoever had the floor, plus anyone already judged wrong on this question.
        const judgedWrong = [...(this.answers.get(q.id)?.values() ?? [])]
          .filter((a) => a.correct === false)
          .map((a) => a.userId);
        const lockedOut = action.lockOutPrevious
          ? [...new Set([...b.lockedOut, ...(b.winnerId ? [b.winnerId] : []), ...judgedWrong])]
          : b.lockedOut;
        this.s.buzzer = { ...emptyBuzzer(), lockedOut };
        return this.commit();
      }
      case 'addQuestion': {
        if (this.s.status === 'ended') return fail('invalid_state');
        const q: Question = { ...action.question, imageUrl: action.question.imageUrl || null };
        if (this.s.questions.some((x) => x.id === q.id)) q.id = `${q.id}-${Date.now().toString(36)}`;
        // In the lobby the question joins the end of the queue; during the game it plays next.
        const at = this.s.status === 'lobby' ? this.s.questions.length : this.s.index + 1;
        this.s.questions.splice(at, 0, q);
        if (!action.launch) return this.commit();
        if (this.s.status === 'lobby') this.s.startedAt = Date.now();
        return this.goto(at);
      }
      case 'buzzerJudge': {
        const q = this.currentQuestion;
        if (!q || q.type !== 'buzzer') return fail('invalid_state');
        if (!this.player(action.userId)) return fail('unknown_player');
        const prev = this.answerOf(q.id, action.userId);
        const record: AnswerRecord = {
          questionId: q.id,
          userId: action.userId,
          value: 'buzz',
          submittedAt: prev?.submittedAt ?? Date.now(),
          correct: action.correct,
          pointsAwarded: pointsFor(q, action.correct),
          overriddenBy: adminId,
        };
        this.answersFor(q.id).set(action.userId, record);
        this.saveAnswer(record);
        this.changed();
        return ok;
      }
    }
  }

  // ---------- scores ----------

  /**
   * Total score; with hideCurrent, points of the question still being played are excluded until
   * the reveal. Buzzer verdicts are public as soon as the admin judges them, so they always count.
   */
  scoreOf(userId: string, hideCurrent = false): number {
    const q = this.currentQuestion;
    const hiddenQ =
      hideCurrent && q?.type !== 'buzzer' && (this.s.status === 'question' || this.s.status === 'closed') ? q?.id : null;
    let total = 0;
    for (const [qid, byUser] of this.answers) {
      if (qid === hiddenQ) continue;
      total += byUser.get(userId)?.pointsAwarded ?? 0;
    }
    for (const adj of this.s.adjustments) if (adj.userId === userId) total += adj.delta;
    return total;
  }

  // ---------- views ----------

  viewFor(role: ViewRole, userId?: string | null): GameView {
    const isAdmin = role === 'admin';
    const hide = !isAdmin;
    const q = this.currentQuestion;
    const currentAnswers = q ? this.answers.get(q.id) : undefined;
    const players: PlayerView[] = this.s.players
      .filter((p) => !p.kicked)
      .map((p) => this.playerView(p, hide, currentAnswers))
      .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));

    const view: GameView = {
      role,
      sessionId: this.s.sessionId,
      code: this.s.code,
      title: this.s.title,
      status: this.s.status,
      index: this.s.index,
      total: this.s.questions.length,
      question: q ? toQuestionView(q) : null,
      deadline: this.s.status === 'question' ? this.s.deadline : null,
      serverNow: Date.now(),
      players,
      answeredCount: players.filter((p) => p.answered).length,
      reveal: q && this.s.status === 'reveal' ? this.revealView(q) : null,
      buzzer: q?.type === 'buzzer' ? this.buzzerView() : null,
    };

    if (role === 'player' && userId) {
      const score = this.scoreOf(userId, true);
      const a = q ? this.answerOf(q.id, userId) : null;
      const revealed =
        this.s.status === 'reveal' || this.s.status === 'leaderboard' || this.s.status === 'ended' || q?.type === 'buzzer';
      view.me = {
        userId,
        score,
        rank: 1 + players.filter((p) => p.score > score).length,
        answer: a?.value ?? null,
        result: a && revealed && a.correct !== null ? { correct: a.correct, points: a.pointsAwarded } : null,
        lockedOut: this.s.buzzer.lockedOut.includes(userId),
      };
    }

    if (isAdmin) {
      view.admin = {
        question: q,
        answers: currentAnswers ? [...currentAnswers.values()].map((a) => this.adminAnswerView(a)) : [],
        kicked: this.s.players.filter((p) => p.kicked).map((p) => this.playerView(p, false, currentAnswers)),
        presenterToken: this.s.presenterToken,
        adjustments: this.s.adjustments.map((a) => ({
          userId: a.userId,
          displayName: this.player(a.userId)?.displayName ?? '?',
          delta: a.delta,
          reason: a.reason,
          at: a.at,
        })),
      };
    }
    return view;
  }

  // ---------- internals ----------

  private goto(index: number): Result {
    const q = this.s.questions[index];
    this.stopTimer();
    this.s.index = index;
    this.s.status = 'question';
    this.s.buzzer = emptyBuzzer();
    this.s.deadline = q.timeLimitSec ? Date.now() + q.timeLimitSec * 1000 : null;
    this.armTimer();
    return this.commit();
  }

  private close() {
    this.stopTimer();
    if (this.s.status !== 'question') return;
    this.s.status = 'closed';
    this.s.deadline = null;
    this.s.buzzer.locked = true;
    this.commit();
  }

  private armTimer() {
    this.stopTimer();
    if (!this.s.deadline) return;
    const delay = Math.max(0, this.s.deadline - Date.now());
    this.timer = setTimeout(() => this.close(), delay);
  }

  private stopTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private everyoneAnswered(): boolean {
    const q = this.currentQuestion;
    if (!q || q.type === 'buzzer') return false;
    const active = this.s.players.filter((p) => !p.kicked && this.isConnected(p.userId));
    if (active.length === 0) return false;
    const byUser = this.answers.get(q.id);
    return active.every((p) => byUser?.has(p.userId));
  }

  private isBuzzerQuestion() {
    return this.s.status === 'question' && this.currentQuestion?.type === 'buzzer';
  }

  private answersFor(questionId: string) {
    let m = this.answers.get(questionId);
    if (!m) this.answers.set(questionId, (m = new Map()));
    return m;
  }

  private playerView(p: PlayerState, hideCurrent: boolean, currentAnswers?: Map<string, AnswerRecord>): PlayerView {
    return {
      userId: p.userId,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      score: this.scoreOf(p.userId, hideCurrent),
      connected: this.isConnected(p.userId),
      answered: currentAnswers?.has(p.userId) ?? false,
    };
  }

  private adminAnswerView(a: AnswerRecord): AdminAnswerView {
    return {
      userId: a.userId,
      displayName: this.player(a.userId)?.displayName ?? '?',
      value: a.value,
      correct: a.correct,
      points: a.pointsAwarded,
      overridden: a.overriddenBy !== null,
      submittedAt: a.submittedAt,
    };
  }

  private buzzerView(): BuzzerView {
    const b = this.s.buzzer;
    const winner = b.winnerId ? this.player(b.winnerId) : null;
    return {
      locked: b.locked,
      winner: winner ? { userId: winner.userId, displayName: winner.displayName, avatarUrl: winner.avatarUrl } : null,
      order: b.order.map((o) => ({ userId: o.userId, displayName: this.player(o.userId)?.displayName ?? '?', at: o.at })),
      lockedOut: b.lockedOut,
    };
  }

  private revealView(q: Question): RevealView {
    const list = [...(this.answers.get(q.id)?.values() ?? [])].filter((a) => !this.player(a.userId)?.kicked);
    const distribution: Record<string, number> = {};
    if (isChoiceType(q.type)) {
      for (const o of q.options) distribution[o.id] = 0;
      for (const a of list) if (Array.isArray(a.value)) for (const id of a.value) distribution[id] = (distribution[id] ?? 0) + 1;
    }
    let topAnswers: RevealView['topAnswers'] = [];
    if (q.type === 'open') {
      const groups = new Map<string, { text: string; count: number; correct: boolean }>();
      for (const a of list) {
        const key = normalizeText(String(a.value));
        const g = groups.get(key) ?? { text: String(a.value), count: 0, correct: false };
        g.count++;
        g.correct ||= a.correct === true;
        groups.set(key, g);
      }
      topAnswers = [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 8);
    }
    return {
      correctOptionIds: q.options.filter((o) => o.correct).map((o) => o.id),
      acceptedAnswers: q.type === 'open' || q.type === 'buzzer' ? q.acceptedAnswers : [],
      numberAnswer: q.type === 'number' ? (q.numberAnswer ?? null) : null,
      tolerance: q.type === 'number' ? (q.tolerance ?? 0) : null,
      distribution,
      topAnswers,
      correctCount: list.filter((a) => a.correct).length,
      answerCount: list.length,
    };
  }

  private commit(): Result {
    this.persist();
    this.changed();
    return ok;
  }

  private persist() {
    const scores: Record<string, number> = {};
    for (const p of this.s.players) scores[p.userId] = this.scoreOf(p.userId);
    const state: PersistedState = { ...structuredClone(this.s), scores };
    this.saveChain = this.saveChain
      .then(() => this.store.saveSession(state))
      .catch((err) => console.error(`[game ${this.s.code}] failed to save session`, err));
  }

  private saveAnswer(a: AnswerRecord) {
    const copy = { ...a };
    this.saveChain = this.saveChain
      .then(() => this.store.saveAnswer(this.s.sessionId, copy))
      .catch((err) => console.error(`[game ${this.s.code}] failed to save answer`, err));
    // Scores changed: keep the denormalized player scores in sync.
    this.persist();
  }

  /** Notifies listeners, coalescing bursts (e.g. many answers) unless immediate. */
  private changed(immediate = false) {
    if (immediate) {
      if (this.changeTimer) clearTimeout(this.changeTimer);
      this.changeTimer = null;
      this.emit();
      return;
    }
    if (this.changeTimer) return;
    this.changeTimer = setTimeout(() => {
      this.changeTimer = null;
      this.emit();
    }, CHANGE_THROTTLE_MS);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }
}

export function toQuestionView(q: Question): QuestionView {
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    imageUrl: q.imageUrl,
    timeLimitSec: q.timeLimitSec,
    points: q.points,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
  };
}
