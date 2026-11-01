import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { isAdminRole } from '@/lib/types';
import { getUserById, type CurrentUser } from './users';

/** The signed-in user, freshly loaded from the database (so role changes apply immediately). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  return getUserById(session?.user?.id);
}

export async function requireUser(callbackUrl = '/'): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/?login=1&callbackUrl=${encodeURIComponent(callbackUrl)}`);
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser('/admin');
  if (!isAdminRole(user.role)) redirect('/');
  return user;
}

export async function requireSuperAdmin(): Promise<CurrentUser> {
  const user = await requireAdmin();
  if (user.role !== 'superadmin') redirect('/admin');
  return user;
}

/** For route handlers / server actions: throws instead of redirecting. */
export async function assertAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) throw new Error('Forbidden');
  return user;
}
