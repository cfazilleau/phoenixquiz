import { describe, expect, it } from 'vitest';
import { defaultAvatarUrl, resolveProfile } from './profiles';

const user = { id: '80351110224678912', username: 'nelly', global_name: 'Nelly', avatar: 'abc123' };

describe('resolveProfile', () => {
  it('prefers the server nickname and server avatar', () => {
    const p = resolveProfile(user, { nick: 'Nelly 🔥', avatar: 'a_guildhash' }, '42');
    expect(p).toEqual({
      displayName: 'Nelly 🔥',
      avatarUrl: 'https://cdn.discordapp.com/guilds/42/users/80351110224678912/avatars/a_guildhash.gif?size=256',
      isGuildMember: true,
    });
  });

  it('falls back to the global profile for members without server overrides', () => {
    const p = resolveProfile(user, { nick: null, avatar: null }, '42');
    expect(p.displayName).toBe('Nelly');
    expect(p.avatarUrl).toBe('https://cdn.discordapp.com/avatars/80351110224678912/abc123.png?size=256');
    expect(p.isGuildMember).toBe(true);
  });

  it('uses the global profile for non-members', () => {
    const p = resolveProfile({ ...user, global_name: null }, null, '42');
    expect(p.displayName).toBe('nelly');
    expect(p.isGuildMember).toBe(false);
  });

  it('uses the default avatar when the user has none', () => {
    const p = resolveProfile({ ...user, avatar: null }, null);
    expect(p.avatarUrl).toBe(defaultAvatarUrl(user));
    expect(p.avatarUrl).toMatch(/^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/[0-5]\.png$/);
  });

  it('handles legacy discriminators', () => {
    expect(defaultAvatarUrl({ id: '1', discriminator: '0007' })).toBe('https://cdn.discordapp.com/embed/avatars/2.png');
  });
});
