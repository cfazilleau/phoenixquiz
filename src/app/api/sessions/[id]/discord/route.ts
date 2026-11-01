import mongoose from 'mongoose';
import { isAdminRole } from '@/lib/types';
import { getCurrentUser } from '@/server/auth-guards';
import { connectDb } from '@/server/db';
import { BotEvent } from '@/server/models/BotEvent';
import { loadResults } from '@/server/results';

export const dynamic = 'force-dynamic';

/** Queues a results post for the FriendlyFire quiz cog (see BotEvent for the contract). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) return Response.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await params;
  const data = await loadResults(id);
  if (!data) return Response.json({ error: 'not_found' }, { status: 404 });
  if (data.session.status !== 'ended') return Response.json({ error: 'not_ended' }, { status: 409 });

  const event = await BotEvent.create({
    type: 'post_results',
    sessionId: id,
    requestedBy: { discordId: user.discordId, displayName: user.displayName },
    status: 'pending',
    payload: {
      activityTitle: data.session.title,
      endedAt: data.session.endedAt ?? new Date(),
      playerCount: data.ranked.length,
      top: data.ranked.slice(0, 10).map((p) => ({
        rank: p.rank,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        score: p.score,
      })),
    },
  });
  return Response.json({ eventId: event._id.toString() });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) return Response.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await params;
  const eventId = new URL(req.url).searchParams.get('eventId');
  if (!eventId || !mongoose.isValidObjectId(eventId)) return Response.json({ error: 'bad_request' }, { status: 400 });

  await connectDb();
  const ev = await BotEvent.findOne({ _id: eventId, sessionId: id }, { status: 1, error: 1, messageUrl: 1 }).lean();
  if (!ev) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json({ status: ev.status, error: ev.error, messageUrl: ev.messageUrl });
}
