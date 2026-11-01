'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { activityInputSchema } from '@/lib/schemas';
import * as activities from '@/server/activities';
import { assertAdmin, getCurrentUser } from '@/server/auth-guards';
import { setUserRole } from '@/server/users';

export async function createActivityAction(formData: FormData) {
  const user = await assertAdmin();
  const t = await getTranslations('admin.activities');
  const title = String(formData.get('title') ?? '').trim().slice(0, 120) || t('untitled');
  const id = await activities.createActivity(title, user.id);
  redirect(`/admin/activities/${id}`);
}

export async function saveActivityAction(id: string, data: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertAdmin();
  const parsed = activityInputSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const index = issue.path[0] === 'questions' ? Number(issue.path[1]) + 1 : null;
    return { ok: false, error: index ? `#${index}: ${issue.message}` : issue.message };
  }
  await activities.updateActivity(id, parsed.data);
  revalidatePath('/admin/activities');
  return { ok: true };
}

export async function duplicateActivityAction(formData: FormData) {
  const user = await assertAdmin();
  const t = await getTranslations('admin.activities');
  await activities.duplicateActivity(String(formData.get('id')), user.id, t('copySuffix'));
  revalidatePath('/admin/activities');
}

export async function deleteActivityAction(formData: FormData) {
  await assertAdmin();
  await activities.deleteActivity(String(formData.get('id')));
  revalidatePath('/admin/activities');
}

export async function startSessionAction(formData: FormData) {
  const user = await assertAdmin();
  const id = await activities.createSession(String(formData.get('activityId')), user.id);
  if (!id) throw new Error('Activity not found');
  redirect(`/admin/sessions/${id}`);
}

export async function deleteSessionAction(formData: FormData) {
  await assertAdmin();
  await activities.deleteSession(String(formData.get('id')));
  revalidatePath('/admin/sessions');
}

export async function setRoleAction(formData: FormData) {
  const me = await getCurrentUser();
  if (me?.role !== 'superadmin') throw new Error('Forbidden');
  const role = formData.get('role') === 'admin' ? 'admin' : 'player';
  await setUserRole(String(formData.get('id')), role);
  revalidatePath('/admin/users');
}
