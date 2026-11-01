'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui';
import { saveSessionAsActivityAction } from '../../actions';

/** Keeps the questions of this session (including the ones written live) as a reusable activity. */
export function SaveAsActivityButton({ sessionId }: { sessionId: string }) {
  const t = useTranslations('control.live');
  const [saved, setSaved] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (saved)
    return (
      <Link href={`/admin/activities/${saved}`} className="text-sm text-emerald-300 hover:underline">
        ✓ {t('savedAsActivity')}
      </Link>
    );

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await saveSessionAsActivityAction(sessionId);
          if (res.ok) setSaved(res.activityId);
          else setFailed(true);
        })
      }
    >
      {failed ? t('saveFailed') : t('saveAsActivity')}
    </Button>
  );
}
