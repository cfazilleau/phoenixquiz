import mongoose from 'mongoose';
import type { Question } from '@/lib/types';
import { connectDb } from './db';
import { Answer } from './models/Answer';
import { Session } from './models/Session';
import { User } from './models/User';

export interface RankedPlayer {
  rank: number;
  userId: string;
  discordId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  score: number;
}

/** Everything about a finished (or running) session, read straight from MongoDB. */
export async function loadResults(sessionId: string) {
  if (!mongoose.isValidObjectId(sessionId)) return null;
  await connectDb();
  const session = await Session.findById(sessionId).lean();
  if (!session) return null;
  const answers = await Answer.find({ sessionId }).lean();
  const questions = JSON.parse(JSON.stringify(session.activitySnapshot ?? [])) as Question[];

  const players = (session.players ?? []).filter((p) => !p.kicked);
  const users = await User.find({ discordId: { $in: players.map((p) => p.discordId) } }, { discordId: 1, username: 1 }).lean();
  const usernames = new Map(users.map((u) => [u.discordId, u.username]));

  const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const ranked: RankedPlayer[] = sorted.map((p) => ({
    rank: 1 + sorted.filter((x) => (x.score ?? 0) > (p.score ?? 0)).length,
    userId: p.userId,
    discordId: p.discordId,
    username: usernames.get(p.discordId) ?? '',
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    score: p.score ?? 0,
  }));

  return { session, questions, answers, ranked, allPlayers: session.players ?? [] };
}
