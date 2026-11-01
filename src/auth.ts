import NextAuth from 'next-auth';
import type { Provider } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
import Discord from 'next-auth/providers/discord';
import type { DiscordUser } from '@/server/profiles';
import { devLoginEnabled, upsertDevUser, upsertDiscordUser } from '@/server/users';

const providers: Provider[] = [
  Discord({
    // Discord now sends `iss=https://discord.com` on the callback (RFC 9207). Without a declared
    // issuer, Auth.js compares it to its placeholder (https://authjs.dev) and rejects the login.
    issuer: 'https://discord.com',
    // FriendlyFire's application. guilds.members.read gives us the server nickname and avatar
    // without adding anything to the guild. prompt=none skips the consent screen after the first time.
    authorization: { params: { scope: 'identify guilds.members.read', prompt: 'none' } },
  }),
];

if (devLoginEnabled()) {
  providers.push(
    Credentials({
      id: 'dev',
      name: 'Dev login',
      credentials: { name: { label: 'Name', type: 'text' } },
      async authorize(credentials) {
        const name = String(credentials?.name ?? '').trim().slice(0, 32);
        if (!name) return null;
        const user = await upsertDevUser(name);
        return { id: user.id, name: user.displayName, image: user.avatarUrl };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: '/', error: '/' },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (account?.provider === 'discord' && profile) {
        // The access token is only used here, never stored.
        const u = await upsertDiscordUser(profile as unknown as DiscordUser, account.access_token);
        token.uid = u.id;
      } else if (account?.provider === 'dev' && user?.id) {
        token.uid = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});
