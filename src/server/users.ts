import mongoose from 'mongoose';
import type { Role } from '@/lib/types';
import { connectDb } from './db';
import { User } from './models/User';
import { defaultAvatarUrl, fetchGuildMember, resolveProfile, type DiscordUser } from './profiles';

export interface CurrentUser {
  id: string;
  discordId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isGuildMember: boolean;
  role: Role;
}

export const devLoginEnabled = () => process.env.NODE_ENV !== 'production' && process.env.DEV_LOGIN === 'true';

function superAdminIds(): Set<string> {
  return new Set(
    (process.env.SUPERADMIN_DISCORD_ID ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function toCurrentUser(doc: {
  _id: mongoose.Types.ObjectId;
  discordId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isGuildMember?: boolean | null;
  role?: string | null;
}): CurrentUser {
  return {
    id: doc._id.toString(),
    discordId: doc.discordId,
    username: doc.username,
    displayName: doc.displayName,
    avatarUrl: doc.avatarUrl,
    isGuildMember: !!doc.isGuildMember,
    role: superAdminIds().has(doc.discordId) ? 'superadmin' : ((doc.role as Role) ?? 'player'),
  };
}

/** Called at Discord sign-in: refreshes name and avatar (server profile when available). */
export async function upsertDiscordUser(profile: DiscordUser, accessToken: string | undefined): Promise<CurrentUser> {
  await connectDb();
  const guildId = process.env.DISCORD_GUILD_ID;
  const existing = await User.findOne({ discordId: profile.id }).lean();

  let resolved = resolveProfile(profile, null, guildId);
  if (guildId && accessToken) {
    const r = await fetchGuildMember(accessToken, guildId);
    if (r.kind === 'member') resolved = resolveProfile(profile, r.member, guildId);
    else if (r.kind === 'error') {
      console.warn(`[auth] guild member lookup failed for ${profile.id} (HTTP ${r.status}), keeping previous profile`);
      if (existing) {
        resolved = {
          displayName: existing.displayName,
          avatarUrl: existing.avatarUrl,
          isGuildMember: !!existing.isGuildMember,
        };
      }
    }
  }

  const doc = await User.findOneAndUpdate(
    { discordId: profile.id },
    {
      $set: { username: profile.username, ...resolved, lastLoginAt: new Date() },
      $setOnInsert: { role: 'player' },
    },
    { upsert: true, returnDocument: 'after', lean: true },
  );
  return toCurrentUser(doc!);
}

/** Dev-only fake accounts, so several players can be simulated without Discord. */
export async function upsertDevUser(name: string): Promise<CurrentUser> {
  await connectDb();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'player';
  const discordId = `dev-${slug}`;
  const doc = await User.findOneAndUpdate(
    { discordId },
    {
      $set: {
        username: slug,
        displayName: name,
        avatarUrl: defaultAvatarUrl({ id: String(slug.length * 4194304 * 7) }),
        isGuildMember: true,
        lastLoginAt: new Date(),
      },
      // The first dev user created is an admin, to make local testing easy.
      $setOnInsert: { role: (await User.exists({ discordId: /^dev-/ })) ? 'player' : 'admin' },
    },
    { upsert: true, returnDocument: 'after', lean: true },
  );
  return toCurrentUser(doc!);
}

export async function getUserById(id: string | undefined | null): Promise<CurrentUser | null> {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  await connectDb();
  const doc = await User.findById(id).lean();
  return doc ? toCurrentUser(doc) : null;
}

export async function listUsers(): Promise<CurrentUser[]> {
  await connectDb();
  const docs = await User.find().sort({ role: 1, displayName: 1 }).lean();
  return docs.map(toCurrentUser);
}

export async function setUserRole(id: string, role: 'admin' | 'player') {
  await connectDb();
  await User.updateOne({ _id: id, role: { $ne: 'superadmin' } }, { $set: { role } });
}
