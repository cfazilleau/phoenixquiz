'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { LOCALES } from '@/i18n/config';
import { setLocale } from '@/i18n/actions';
import { cn } from '@/lib/utils';

export function LocaleSwitcher() {
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex overflow-hidden rounded-lg border border-line text-xs font-bold">
      {LOCALES.map((l) => (
        <button
          key={l}
          disabled={pending || l === locale}
          onClick={() =>
            startTransition(async () => {
              await setLocale(l);
              // A full reload also re-renders client components and live game screens in the new language.
              window.location.reload();
            })
          }
          className={cn('px-2 py-1 uppercase', l === locale ? 'bg-phoenix text-ink' : 'text-muted hover:text-white')}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
