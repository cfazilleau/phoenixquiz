'use server';

import { signIn, signOut } from '@/auth';
import { devLoginEnabled } from '@/server/users';

const safeCallback = (url: unknown) => (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : '/');

export async function signInWithDiscord(formData: FormData) {
  await signIn('discord', { redirectTo: safeCallback(formData.get('callbackUrl')) });
}

export async function signInDev(formData: FormData) {
  if (!devLoginEnabled()) return;
  await signIn('dev', { name: String(formData.get('name') ?? ''), redirectTo: safeCallback(formData.get('callbackUrl')) });
}

export async function signOutAction() {
  await signOut({ redirectTo: '/' });
}
