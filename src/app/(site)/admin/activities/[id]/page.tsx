import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getActivity } from '@/server/activities';
import { ActivityEditor } from './ActivityEditor';

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activity = await getActivity(id);
  if (!activity) notFound();
  const t = await getTranslations('editor');
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/activities" className="text-sm text-muted hover:text-white">
        ← {t('back')}
      </Link>
      <ActivityEditor initial={activity} />
    </div>
  );
}
