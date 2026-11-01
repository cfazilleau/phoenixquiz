import { connectDb } from '../db';
import { Answer } from '../models/Answer';
import { Session } from '../models/Session';
import type { AnswerRecord, GameSnapshot, GameStore, PersistedState } from './LiveGame';
import type { Question, SessionStatus } from '@/lib/types';

const toDate = (ms: number | null) => (ms == null ? null : new Date(ms));
const toMs = (d: Date | null | undefined) => (d ? new Date(d).getTime() : null);

export const mongoStore: GameStore = {
  async saveSession(s: PersistedState) {
    await connectDb();
    await Session.updateOne(
      { _id: s.sessionId },
      {
        $set: {
          // Questions can be added live, so the snapshot is saved along with the state.
          activitySnapshot: s.questions,
          status: s.status,
          currentIndex: s.index,
          deadline: toDate(s.deadline),
          players: s.players.map((p) => ({
            userId: p.userId,
            discordId: p.discordId,
            displayName: p.displayName,
            avatarUrl: p.avatarUrl,
            kicked: p.kicked,
            joinedAt: new Date(p.joinedAt),
            score: s.scores[p.userId] ?? 0,
          })),
          scoreAdjustments: s.adjustments.map((a) => ({ ...a, at: new Date(a.at) })),
          buzzEvents: s.buzzEvents.map((e) => ({ ...e, at: new Date(e.at) })),
          buzzer: {
            locked: s.buzzer.locked,
            winnerId: s.buzzer.winnerId,
            order: s.buzzer.order.map((o) => ({ userId: o.userId, at: new Date(o.at) })),
            lockedOut: s.buzzer.lockedOut,
          },
          startedAt: toDate(s.startedAt),
          endedAt: toDate(s.endedAt),
        },
      },
    );
  },

  async saveAnswer(sessionId: string, a: AnswerRecord) {
    await connectDb();
    await Answer.updateOne(
      { sessionId, questionId: a.questionId, userId: a.userId },
      {
        $set: {
          value: a.value,
          submittedAt: new Date(a.submittedAt),
          correct: a.correct,
          pointsAwarded: a.pointsAwarded,
          overriddenBy: a.overriddenBy,
        },
      },
      { upsert: true },
    );
  },
};

/** Loads a session and its answers from MongoDB into the in-memory shape. */
export async function loadSnapshot(
  query: { joinCode: string } | { _id: string },
): Promise<{ snapshot: GameSnapshot; answers: AnswerRecord[] } | null> {
  await connectDb();
  const doc = await Session.findOne(query).lean();
  if (!doc) return null;
  const sessionId = doc._id.toString();
  const answers = await Answer.find({ sessionId }).lean();
  const snapshot: GameSnapshot = {
    sessionId,
    code: doc.joinCode,
    title: doc.title,
    presenterToken: doc.presenterToken,
    questions: (doc.activitySnapshot ?? []) as unknown as Question[],
    status: doc.status as SessionStatus,
    index: doc.currentIndex,
    players: (doc.players ?? []).map((p) => ({
      userId: p.userId,
      discordId: p.discordId,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      kicked: !!p.kicked,
      joinedAt: toMs(p.joinedAt) ?? Date.now(),
    })),
    adjustments: (doc.scoreAdjustments ?? []).map((a) => ({
      userId: a.userId ?? '',
      delta: a.delta ?? 0,
      reason: a.reason ?? '',
      by: a.by ?? '',
      at: toMs(a.at) ?? 0,
    })),
    buzzEvents: (doc.buzzEvents ?? []).map((e) => ({
      questionId: e.questionId ?? '',
      userId: e.userId ?? '',
      at: toMs(e.at) ?? 0,
    })),
    buzzer: {
      locked: !!doc.buzzer?.locked,
      winnerId: doc.buzzer?.winnerId ?? null,
      order: (doc.buzzer?.order ?? []).map((o) => ({ userId: o.userId ?? '', at: toMs(o.at) ?? 0 })),
      lockedOut: doc.buzzer?.lockedOut ?? [],
    },
    deadline: toMs(doc.deadline),
    startedAt: toMs(doc.startedAt),
    endedAt: toMs(doc.endedAt),
  };
  return {
    snapshot,
    answers: answers.map((a) => ({
      questionId: a.questionId,
      userId: a.userId,
      value: a.value,
      submittedAt: toMs(a.submittedAt) ?? 0,
      correct: a.correct ?? null,
      pointsAwarded: a.pointsAwarded ?? 0,
      overriddenBy: a.overriddenBy ?? null,
    })),
  };
}
