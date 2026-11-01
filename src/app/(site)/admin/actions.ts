'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { activityInputSchema, questionIssueKey, type QuestionIssue } from '@/lib/schemas';
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

export async function saveActivityAction(
  id: string,
  data: unknown,
): Promise<{ ok: true } | { ok: false; question: number | null; issue: QuestionIssue }> {
  await assertAdmin();
  const parsed = activityInputSchema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const inQuestion = issue.path[0] === 'questions';
    return {
      ok: false,
      question: inQuestion ? Number(issue.path[1]) + 1 : null,
      issue: questionIssueKey({ ...issue, path: inQuestion ? issue.path.slice(2) : issue.path }),
    };
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

export async function startLiveSessionAction(formData: FormData) {
  const user = await assertAdmin();
  const t = await getTranslations('admin.sessions');
  const title = String(formData.get('title') ?? '').trim().slice(0, 120) || t('liveDefaultTitle');
  const id = await activities.createLiveSession(title, user.id);
  redirect(`/admin/sessions/${id}`);
}

export async function saveSessionAsActivityAction(sessionId: string): Promise<{ ok: true; activityId: string } | { ok: false }> {
  const user = await assertAdmin();
  const activityId = await activities.saveSessionAsActivity(sessionId, user.id);
  if (!activityId) return { ok: false };
  revalidatePath('/admin/activities');
  return { ok: true, activityId };
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
