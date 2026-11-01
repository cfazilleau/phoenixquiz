import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Button, Card, Input } from '@/components/ui';
import { listActivities } from '@/server/activities';
import { createActivityAction, deleteActivityAction, duplicateActivityAction, startSessionAction } from '../actions';

export default async function ActivitiesPage() {
  const t = await getTranslations('admin.activities');
  const format = await getFormatter();
  const items = await listActivities();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-black">{t('title')}</h1>
        <form action={createActivityAction} className="flex gap-2">
          <Input name="title" placeholder={t('newPlaceholder')} className="w-64" />
          <Button>{t('create')}</Button>
        </form>
      </div>

      {items.length === 0 && <p className="text-muted">{t('empty')}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((a) => (
          <Card key={a.id} className="flex flex-col gap-3">
            <div>
              <Link href={`/admin/activities/${a.id}`} className="text-xl font-bold hover:text-phoenix-2">
                {a.title}
              </Link>
              {a.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{a.description}</p>}
              <p className="mt-2 text-xs text-muted">
                {t('questionCount', { count: a.questionCount })} ·{' '}
                {format.dateTime(new Date(a.updatedAt), { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              <form action={startSessionAction}>
                <input type="hidden" name="activityId" value={a.id} />
                <Button size="sm">▶ {t('start')}</Button>
              </form>
              <Link href={`/admin/activities/${a.id}`}>
                <Button size="sm" variant="secondary">
                  {t('edit')}
                </Button>
              </Link>
              <form action={duplicateActivityAction}>
                <input type="hidden" name="id" value={a.id} />
                <Button size="sm" variant="secondary">
                  {t('duplicate')}
                </Button>
              </form>
              <form action={deleteActivityAction}>
                <input type="hidden" name="id" value={a.id} />
                <Button size="sm" variant="ghost" className="text-red-300">
                  {t('delete')}
                </Button>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
