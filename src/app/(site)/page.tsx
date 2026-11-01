import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { JoinForm } from '@/components/JoinForm';
import { SignInPanel } from '@/components/SignInPanel';
import { Card } from '@/components/ui';
import { isAdminRole } from '@/lib/types';
import { getCurrentUser } from '@/server/auth-guards';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
  const user = await getCurrentUser();
  const t = await getTranslations('home');

  return (
    <div className="flex flex-col items-center gap-10 pt-10 text-center">
      <div>
        <div className="mb-4 text-7xl">🔥</div>
        <h1 className="bg-gradient-to-r from-phoenix to-phoenix-2 bg-clip-text text-5xl font-black text-transparent sm:text-6xl">
          PhoenixQuiz
        </h1>
        <p className="mt-3 text-lg text-muted">{t('tagline')}</p>
      </div>

      {error && <p className="rounded-lg bg-red-900/50 px-4 py-2 text-red-200">{t('authError')}</p>}

      <Card className="flex w-full max-w-md flex-col items-center gap-5 p-8">
        {user ? (
          <>
            <p className="text-lg">{t('welcome', { name: user.displayName })}</p>
            <JoinForm />
            {isAdminRole(user.role) && (
              <Link href="/admin" className="text-sm text-phoenix-2 hover:underline">
                {t('goAdmin')}
              </Link>
            )}
          </>
        ) : (
          <>
            <p className="text-muted">{t('signInPrompt')}</p>
            <SignInPanel callbackUrl={callbackUrl ?? '/'} />
          </>
        )}
      </Card>
    </div>
  );
}
