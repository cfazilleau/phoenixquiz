'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Input } from './ui';

export function JoinForm({ initialCode = '' }: { initialCode?: string }) {
  const t = useTranslations('join');
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const clean = code.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6);

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (clean.length === 6) router.push(`/play/${clean}`);
      }}
    >
      <Input
        value={clean}
        onChange={(e) => setCode(e.target.value)}
        placeholder={t('codePlaceholder')}
        autoFocus
        autoComplete="off"
        className="text-center font-mono text-3xl tracking-[0.4em] uppercase"
      />
      <Button size="lg" disabled={clean.length !== 6}>
        {t('submit')}
      </Button>
    </form>
  );
}
