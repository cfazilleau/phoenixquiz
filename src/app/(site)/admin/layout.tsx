import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { requireAdmin } from '@/server/auth-guards';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  const t = await getTranslations('admin.nav');
  const link = 'rounded-lg px-3 py-1.5 text-sm font-semibold text-muted hover:bg-panel-2 hover:text-white';
  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap gap-2 border-b border-line pb-3">
        <Link className={link} href="/admin/activities">
          {t('activities')}
        </Link>
        <Link className={link} href="/admin/sessions">
          {t('sessions')}
        </Link>
        {user.role === 'superadmin' && (
          <Link className={link} href="/admin/users">
            {t('users')}
          </Link>
        )}
      </nav>
      {children}
    </div>
  );
}
