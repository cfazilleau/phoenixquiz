import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { signInWithDiscord, signOutAction } from '@/app/auth-actions';
import { isAdminRole } from '@/lib/types';
import type { CurrentUser } from '@/server/users';
import { LocaleSwitcher } from './LocaleSwitcher';
import { Avatar, Button } from './ui';

export async function Header({ user }: { user: CurrentUser | null }) {
  const t = await getTranslations('nav');
  return (
    <header className="sticky top-0 z-20 border-b border-line/60 bg-ink/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-3 sm:gap-4 sm:px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-black tracking-tight">
          <span className="text-2xl">🔥</span>
          <span className="hidden bg-gradient-to-r from-phoenix to-phoenix-2 bg-clip-text text-transparent sm:inline">
            PhoenixQuiz
          </span>
        </Link>
        <nav className="flex min-w-0 items-center gap-1 text-sm">
          <Link href="/join" className="rounded-lg px-3 py-1.5 text-muted hover:bg-panel-2 hover:text-white">
            {t('join')}
          </Link>
          {isAdminRole(user?.role) && (
            <Link href="/admin" className="rounded-lg px-3 py-1.5 text-muted hover:bg-panel-2 hover:text-white">
              {t('admin')}
            </Link>
          )}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <LocaleSwitcher />
          {user ? (
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1 hover:bg-panel-2">
                <Avatar src={user.avatarUrl} alt={user.displayName} size={32} />
                <span className="hidden text-sm font-semibold sm:inline">{user.displayName}</span>
              </summary>
              <div className="absolute right-0 mt-2 w-60 rounded-xl border border-line bg-panel p-2 shadow-2xl">
                <form action={signInWithDiscord}>
                  <input type="hidden" name="callbackUrl" value="/" />
                  <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-panel-2">
                    {t('refreshProfile')}
                  </button>
                </form>
                <form action={signOutAction}>
                  <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-panel-2">
                    {t('signOut')}
                  </button>
                </form>
              </div>
            </details>
          ) : (
            <form action={signInWithDiscord}>
              <input type="hidden" name="callbackUrl" value="/" />
              <Button size="sm">{t('signIn')}</Button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
