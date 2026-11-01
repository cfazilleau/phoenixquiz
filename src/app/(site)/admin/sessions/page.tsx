import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Badge, Button, Card } from '@/components/ui';
import { listSessions } from '@/server/activities';
import { deleteSessionAction } from '../actions';

export default async function SessionsPage() {
  const t = await getTranslations('admin.sessions');
  const ts = await getTranslations('status');
  const format = await getFormatter();
  const sessions = await listSessions();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-black">{t('title')}</h1>
      {sessions.length === 0 && <p className="text-muted">{t('empty')}</p>}
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="p-3">{t('activity')}</th>
              <th className="p-3">{t('code')}</th>
              <th className="p-3">{t('status')}</th>
              <th className="p-3">{t('players')}</th>
              <th className="p-3">{t('created')}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-line/50 last:border-0">
                <td className="p-3 font-semibold">{s.title}</td>
                <td className="p-3 font-mono">{s.joinCode}</td>
                <td className="p-3">
                  <Badge className={s.status === 'ended' ? '' : 'bg-emerald-700'}>{ts(s.status)}</Badge>
                </td>
                <td className="p-3">{s.playerCount}</td>
                <td className="p-3 text-muted">
                  {format.dateTime(new Date(s.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
                </td>
                <td className="flex justify-end gap-2 p-3">
                  <Link href={`/admin/sessions/${s.id}`}>
                    <Button size="sm" variant="secondary">
                      {s.status === 'ended' ? t('results') : t('control')}
                    </Button>
                  </Link>
                  <a href={`/api/sessions/${s.id}/export`}>
                    <Button size="sm" variant="ghost">
                      .xlsx
                    </Button>
                  </a>
                  {s.status === 'ended' && (
                    <form action={deleteSessionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <Button size="sm" variant="ghost" className="text-red-300">
                        {t('delete')}
                      </Button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
