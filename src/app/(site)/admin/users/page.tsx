import { getTranslations } from 'next-intl/server';
import { Avatar, Badge, Button, Card } from '@/components/ui';
import { requireSuperAdmin } from '@/server/auth-guards';
import { listUsers } from '@/server/users';
import { setRoleAction } from '../actions';

export default async function UsersPage() {
  const me = await requireSuperAdmin();
  const t = await getTranslations('admin.users');
  const users = await listUsers();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-black">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('help')}</p>
      </div>
      <Card className="p-0">
        <ul className="divide-y divide-line/50">
          {users.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar src={u.avatarUrl} alt={u.displayName} size={36} />
              <div className="flex-1">
                <p className="font-semibold">{u.displayName}</p>
                <p className="text-xs text-muted">
                  @{u.username} · {u.discordId}
                  {!u.isGuildMember && ` · ${t('notMember')}`}
                </p>
              </div>
              <Badge className={u.role === 'player' ? '' : 'bg-phoenix text-ink'}>{t(`roles.${u.role}`)}</Badge>
              {u.role !== 'superadmin' && u.id !== me.id && (
                <form action={setRoleAction}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="role" value={u.role === 'admin' ? 'player' : 'admin'} />
                  <Button size="sm" variant="secondary">
                    {u.role === 'admin' ? t('demote') : t('promote')}
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
