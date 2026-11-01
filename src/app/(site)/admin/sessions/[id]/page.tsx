import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSessionMeta } from '@/server/activities';
import { ControlPanel } from './ControlPanel';

export default async function SessionControlPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionMeta(id);
  if (!session) notFound();
  const t = await getTranslations('admin.sessions');
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/sessions" className="text-sm text-muted hover:text-white">
        ← {t('back')}
      </Link>
      <ControlPanel sessionId={session.id} code={session.joinCode} />
    </div>
  );
}
