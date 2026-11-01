import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '@/lib/types';
import { LiveGame, type AnswerRecord, type GameSnapshot, type GameStore, type PersistedState } from './LiveGame';

const questions: Question[] = [
  {
    id: 'q1',
    type: 'single',
    prompt: 'Capital of France?',
    points: 100,
    timeLimitSec: 20,
    options: [
      { id: 'a', text: 'Lyon', correct: false },
      { id: 'b', text: 'Paris', correct: true },
    ],
    acceptedAnswers: [],
  },
  { id: 'q2', type: 'buzzer', prompt: 'Buzz!', points: 50, options: [], acceptedAnswers: ['Answer'] },
  { id: 'q3', type: 'open', prompt: 'Open', points: 10, options: [], acceptedAnswers: ['yes'] },
];

function makeStore() {
  const sessions: PersistedState[] = [];
  const answers: AnswerRecord[] = [];
  const store: GameStore = {
    saveSession: async (s) => void sessions.push(s),
    saveAnswer: async (_id, a) => void answers.push(a),
  };
  return { store, sessions, answers };
}

function makeGame(overrides: Partial<GameSnapshot> = {}, answers: AnswerRecord[] = []) {
  const { store, sessions } = makeStore();
  const snapshot: GameSnapshot = {
    sessionId: 's1',
    code: 'ABCDEF',
    title: 'Test',
    presenterToken: 'tok',
    questions,
    status: 'lobby',
    index: 0,
    players: [],
    adjustments: [],
    buzzEvents: [],
    buzzer: { locked: false, winnerId: null, order: [], lockedOut: [] },
    deadline: null,
    startedAt: null,
    endedAt: null,
    ...overrides,
  };
  const game = new LiveGame(snapshot, answers, store);
  for (const id of ['u1', 'u2', 'u3']) {
    game.addPlayer({ userId: id, discordId: id, displayName: id.toUpperCase(), avatarUrl: '' });
    game.connect(id);
  }
  return { game, sessions };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('LiveGame flow', () => {
  it('runs start → answer → close → reveal → leaderboard → end', () => {
    const { game } = makeGame();
    expect(game.admin({ type: 'start' }, 'admin').ok).toBe(true);
    expect(game.status).toBe('question');

    expect(game.answer('u1', 'q1', ['b']).ok).toBe(true);
    expect(game.answer('u1', 'q1', ['a'])).toEqual({ ok: false, error: 'already_answered' });
    expect(game.answer('u2', 'q1', ['a']).ok).toBe(true);

    // Points of the running question are hidden from players until reveal.
    expect(game.viewFor('player', 'u1').me?.score).toBe(0);
    expect(game.viewFor('admin').players.find((p) => p.userId === 'u1')?.score).toBe(100);

    // Last connected player answers → auto close.
    game.answer('u3', 'q1', ['b']);
    expect(game.status).toBe('closed');

    game.admin({ type: 'reveal' }, 'admin');
    const view = game.viewFor('player', 'u2');
    expect(view.reveal?.correctOptionIds).toEqual(['b']);
    expect(view.reveal?.distribution).toEqual({ a: 1, b: 2 });
    expect(view.me?.result).toEqual({ correct: false, points: 0 });
    expect(game.viewFor('player', 'u1').me).toMatchObject({ score: 100, rank: 1 });

    game.admin({ type: 'leaderboard' }, 'admin');
    expect(game.status).toBe('leaderboard');
    game.admin({ type: 'end' }, 'admin');
    expect(game.status).toBe('ended');
  });

  it('never leaks correct answers to players before reveal', () => {
    const { game } = makeGame();
    game.admin({ type: 'start' }, 'admin');
    const json = JSON.stringify(game.viewFor('player', 'u1'));
    expect(json).not.toContain('"correct"');
    expect(game.viewFor('presenter').reveal).toBeNull();
  });

  it('closes the question when the timer runs out', () => {
    const { game } = makeGame();
    game.admin({ type: 'start' }, 'admin');
    vi.advanceTimersByTime(19_000);
    expect(game.status).toBe('question');
    vi.advanceTimersByTime(1_500);
    expect(game.status).toBe('closed');
    expect(game.answer('u1', 'q1', ['b']).ok).toBe(false);
  });

  it('rehydrates an expired timer by closing the question', () => {
    const { game } = makeGame({ status: 'question', index: 0, deadline: Date.now() - 1000 });
    vi.advanceTimersByTime(1);
    expect(game.status).toBe('closed');
  });

  it('lets admins override answers and adjust scores', () => {
    const { game } = makeGame();
    game.admin({ type: 'goto', index: 2 }, 'admin');
    game.answer('u1', 'q3', 'nope');
    expect(game.scoreOf('u1')).toBe(0);
    game.admin({ type: 'override', questionId: 'q3', userId: 'u1', correct: true }, 'admin');
    expect(game.scoreOf('u1')).toBe(10);
    game.admin({ type: 'adjustScore', userId: 'u1', delta: -3, reason: 'penalty' }, 'admin');
    expect(game.scoreOf('u1')).toBe(7);
  });

  it('excludes kicked players and blocks them from rejoining', () => {
    const { game } = makeGame();
    game.admin({ type: 'kick', userId: 'u2' }, 'admin');
    expect(game.viewFor('presenter').players.map((p) => p.userId)).not.toContain('u2');
    expect(game.addPlayer({ userId: 'u2', discordId: 'u2', displayName: 'U2', avatarUrl: '' })).toEqual({
      ok: false,
      error: 'kicked',
    });
    game.admin({ type: 'unkick', userId: 'u2' }, 'admin');
    expect(game.addPlayer({ userId: 'u2', discordId: 'u2', displayName: 'U2', avatarUrl: '' }).ok).toBe(true);
  });

  it('persists state through the store', async () => {
    const { game, sessions } = makeGame();
    game.admin({ type: 'start' }, 'admin');
    await game.flushSaves();
    expect(sessions.at(-1)?.status).toBe('question');
  });
});

describe('buzzer', () => {
  function buzzerGame() {
    const g = makeGame();
    g.game.admin({ type: 'goto', index: 1 }, 'admin');
    return g;
  }

  it('only the first buzz wins, even when many arrive at once', () => {
    const { game } = buzzerGame();
    const results = ['u3', 'u1', 'u2'].map((u) => game.buzz(u));
    expect(results.every((r) => r.ok)).toBe(true);
    const b = game.viewFor('presenter').buzzer!;
    expect(b.winner?.userId).toBe('u3');
    expect(b.locked).toBe(true);
    expect(b.order.map((o) => o.userId)).toEqual(['u3', 'u1', 'u2']);
    expect(game.buzz('u3')).toEqual({ ok: false, error: 'already_buzzed' });
  });

  it('respects lock, unlock and reset with lock-out', () => {
    const { game } = buzzerGame();
    game.admin({ type: 'buzzerLock' }, 'admin');
    expect(game.buzz('u1')).toEqual({ ok: false, error: 'buzzer_locked' });
    game.admin({ type: 'buzzerUnlock' }, 'admin');
    expect(game.buzz('u1').ok).toBe(true);

    expect(game.buzz('u3').ok).toBe(true); // late press, recorded in the order only

    game.admin({ type: 'buzzerJudge', userId: 'u1', correct: false }, 'admin');
    game.admin({ type: 'buzzerReset', lockOutPrevious: true }, 'admin');
    // Only the winner who answered wrong is locked out; late pressers can buzz again.
    expect(game.buzz('u1')).toEqual({ ok: false, error: 'locked_out' });
    expect(game.viewFor('player', 'u1').me?.lockedOut).toBe(true);
    expect(game.viewFor('player', 'u3').me?.lockedOut).toBe(false);
    expect(game.buzz('u2').ok).toBe(true);
    expect(game.viewFor('presenter').buzzer?.winner?.userId).toBe('u2');

    game.admin({ type: 'buzzerJudge', userId: 'u2', correct: true }, 'admin');
    expect(game.scoreOf('u2')).toBe(50);
    // Buzzer verdicts are public immediately, so the player's own score includes them.
    expect(game.viewFor('player', 'u2').me).toMatchObject({ result: { correct: true, points: 50 }, score: 50, rank: 1 });
  });

  it('rejects normal answers on buzzer questions and buzzes on other questions', () => {
    const { game } = buzzerGame();
    expect(game.answer('u1', 'q2', 'x').ok).toBe(false);
    game.admin({ type: 'goto', index: 0 }, 'admin');
    expect(game.buzz('u1')).toEqual({ ok: false, error: 'question_closed' });
  });
});
