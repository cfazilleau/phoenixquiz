const CDN = 'https://cdn.discordapp.com';

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  discriminator?: string | null;
}

/** Subset of GET /users/@me/guilds/{guild.id}/member */
export interface DiscordGuildMember {
  nick?: string | null;
  avatar?: string | null;
}

export interface ResolvedProfile {
  displayName: string;
  avatarUrl: string;
  isGuildMember: boolean;
}

const ext = (hash: string) => (hash.startsWith('a_') ? 'gif' : 'png');

export function defaultAvatarUrl(user: Pick<DiscordUser, 'id' | 'discriminator'>): string {
  let index: number;
  if (user.discriminator && user.discriminator !== '0') index = Number(user.discriminator) % 5;
  else {
    try {
      index = Number((BigInt(user.id) >> 22n) % 6n);
    } catch {
      index = 0;
    }
  }
  return `${CDN}/embed/avatars/${index}.png`;
}

export function userAvatarUrl(user: DiscordUser): string {
  return user.avatar ? `${CDN}/avatars/${user.id}/${user.avatar}.${ext(user.avatar)}?size=256` : defaultAvatarUrl(user);
}

/** Server nickname / server avatar first, then the global profile, then Discord's default avatar. */
export function resolveProfile(user: DiscordUser, member: DiscordGuildMember | null, guildId?: string): ResolvedProfile {
  const displayName = member?.nick || user.global_name || user.username;
  const avatarUrl =
    member?.avatar && guildId
      ? `${CDN}/guilds/${guildId}/users/${user.id}/avatars/${member.avatar}.${ext(member.avatar)}?size=256`
      : userAvatarUrl(user);
  return { displayName, avatarUrl, isGuildMember: member !== null };
}

export type MemberFetchResult =
  | { kind: 'member'; member: DiscordGuildMember }
  | { kind: 'not_member' }
  | { kind: 'error'; status: number };

/** Uses the user's OAuth token (scope guilds.members.read): no bot involved. */
export async function fetchGuildMember(accessToken: string, guildId: string): Promise<MemberFetchResult> {
  try {
    const res = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (res.ok) return { kind: 'member', member: (await res.json()) as DiscordGuildMember };
    if (res.status === 404) return { kind: 'not_member' };
    return { kind: 'error', status: res.status };
  } catch {
    return { kind: 'error', status: 0 };
  }
}
