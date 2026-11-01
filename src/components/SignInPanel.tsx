import { getTranslations } from 'next-intl/server';
import { signInDev, signInWithDiscord } from '@/app/auth-actions';
import { devLoginEnabled } from '@/server/users';
import { Button, Input } from './ui';

export async function SignInPanel({ callbackUrl = '/' }: { callbackUrl?: string }) {
  const t = await getTranslations('auth');
  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <form action={signInWithDiscord}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <Button size="lg" className="w-full bg-[#5865F2] bg-none text-white hover:bg-[#4752c4]">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
            <path d="M20.317 4.369A19.791 19.791 0 0 0 15.432 2.85a.074.074 0 0 0-.079.037c-.211.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.029 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.955 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.946 2.418-2.157 2.418Z" />
          </svg>
          {t('discord')}
        </Button>
      </form>
      {devLoginEnabled() && (
        <form action={signInDev} className="flex gap-2 rounded-xl border border-dashed border-line p-3">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <Input name="name" placeholder={t('devName')} required maxLength={32} />
          <Button variant="secondary">{t('devLogin')}</Button>
        </form>
      )}
    </div>
  );
}
