import { customAlphabet, nanoid } from 'nanoid';
import mongoose from 'mongoose';
import type { ActivityInput } from '@/lib/schemas';
import type { Question } from '@/lib/types';
import { connectDb } from './db';
import { Activity } from './models/Activity';
import { Answer } from './models/Answer';
import { Session } from './models/Session';

// No 0/O/1/I to keep codes easy to read aloud.
const joinCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

export interface ActivitySummary {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  updatedAt: string;
}

export interface ActivityData extends ActivityInput {
  id: string;
}

const toQuestions = (qs: unknown) => JSON.parse(JSON.stringify(qs ?? [])) as Question[];

export async function listActivities(): Promise<ActivitySummary[]> {
  await connectDb();
  const docs = await Activity.find().sort({ updatedAt: -1 }).lean();
  return docs.map((d) => ({
    id: d._id.toString(),
    title: d.title,
    description: d.description ?? '',
    questionCount: d.questions?.length ?? 0,
    updatedAt: new Date(d.updatedAt).toISOString(),
  }));
}

export async function getActivity(id: string): Promise<ActivityData | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDb();
  const d = await Activity.findById(id).lean();
  if (!d) return null;
  return { id: d._id.toString(), title: d.title, description: d.description ?? '', questions: toQuestions(d.questions) };
}

export async function createActivity(title: string, createdBy: string): Promise<string> {
  await connectDb();
  const doc = await Activity.create({ title, description: '', createdBy, questions: [] });
  return doc._id.toString();
}

export async function updateActivity(id: string, input: ActivityInput) {
  await connectDb();
  await Activity.updateOne({ _id: id }, { $set: input });
}

export async function duplicateActivity(id: string, createdBy: string, suffix: string): Promise<string | null> {
  const a = await getActivity(id);
  if (!a) return null;
  const doc = await Activity.create({
    title: `${a.title} ${suffix}`,
    description: a.description,
    createdBy,
    questions: a.questions.map((q) => ({ ...q, id: nanoid(10) })),
  });
  return doc._id.toString();
}

export async function deleteActivity(id: string) {
  await connectDb();
  await Activity.deleteOne({ _id: id });
}

export async function createSession(activityId: string, createdBy: string): Promise<string | null> {
  const a = await getActivity(activityId);
  if (!a) return null;
  return insertSession({ activityId, title: a.title, questions: a.questions, createdBy });
}

/** A session with no prepared questions: the admin writes them during the game. */
export function createLiveSession(title: string, createdBy: string): Promise<string> {
  return insertSession({ activityId: null, title, questions: [], createdBy });
}

/** Copies a session's questions (including the ones written live) into a new activity. */
export async function saveSessionAsActivity(sessionId: string, createdBy: string): Promise<string | null> {
  if (!mongoose.isValidObjectId(sessionId)) return null;
  await connectDb();
  const s = await Session.findById(sessionId, { title: 1, activitySnapshot: 1 }).lean();
  if (!s) return null;
  const doc = await Activity.create({
    title: s.title,
    description: '',
    createdBy,
    questions: toQuestions(s.activitySnapshot).map((q) => ({ ...q, id: nanoid(10) })),
  });
  return doc._id.toString();
}

async function insertSession(input: {
  activityId: string | null;
  title: string;
  questions: Question[];
  createdBy: string;
}): Promise<string> {
  await connectDb();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const doc = await Session.create({
        activityId: input.activityId,
        title: input.title,
        activitySnapshot: input.questions,
        joinCode: joinCode(),
        presenterToken: nanoid(24),
        createdBy: input.createdBy,
      });
      return doc._id.toString();
    } catch (err) {
      // Retry on the (unlikely) duplicate join code.
      if ((err as { code?: number }).code !== 11000) throw err;
    }
  }
  throw new Error('Could not allocate a join code');
}

export interface SessionSummary {
  id: string;
  title: string;
  joinCode: string;
  status: string;
  playerCount: number;
  createdAt: string;
}

export async function listSessions(): Promise<SessionSummary[]> {
  await connectDb();
  const docs = await Session.find({}, { activitySnapshot: 0, buzzEvents: 0 }).sort({ createdAt: -1 }).limit(200).lean();
  return docs.map((d) => ({
    id: d._id.toString(),
    title: d.title,
    joinCode: d.joinCode,
    status: d.status,
    playerCount: (d.players ?? []).filter((p) => !p.kicked).length,
    createdAt: new Date(d.createdAt).toISOString(),
  }));
}

export async function getSessionMeta(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDb();
  const d = await Session.findById(id, { joinCode: 1, title: 1, status: 1, presenterToken: 1 }).lean();
  return d ? { id: d._id.toString(), joinCode: d.joinCode, title: d.title, status: d.status } : null;
}

/** Only ended sessions can be deleted (live state lives in memory). */
export async function deleteSession(id: string) {
  await connectDb();
  const res = await Session.deleteOne({ _id: id, status: 'ended' });
  if (res.deletedCount) await Answer.deleteMany({ sessionId: id });
}
