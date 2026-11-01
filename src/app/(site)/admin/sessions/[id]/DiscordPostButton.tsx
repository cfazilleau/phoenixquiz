'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';

type Status = 'idle' | 'pending' | 'posted' | 'failed' | 'expired' | 'timeout';

/** Queues a `post_results` bot event; FriendlyFire's quiz cog picks it up and posts to Discord. */
export function DiscordPostButton({ sessionId }: { sessionId: string }) {
  const t = useTranslations('discord');
  const [status, setStatus] = useState<Status>('idle');
  const [detail, setDetail] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (poll.current) clearInterval(poll.current);
  }, []);

  const post = async () => {
    setStatus('pending');
    setDetail(null);
    const res = await fetch(`/api/sessions/${sessionId}/discord`, { method: 'POST' });
    if (!res.ok) {
      setStatus('failed');
      setDetail(`HTTP ${res.status}`);
      return;
    }
    const { eventId } = (await res.json()) as { eventId: string };
    const started = Date.now();
    poll.current = setInterval(async () => {
      if (Date.now() - started > 30_000) {
        clearInterval(poll.current!);
        setStatus('timeout');
        return;
      }
      const r = await fetch(`/api/sessions/${sessionId}/discord?eventId=${eventId}`, { cache: 'no-store' });
      if (!r.ok) return;
      const ev = (await r.json()) as { status: Status; error?: string | null; messageUrl?: string | null };
      if (ev.status === 'pending') return;
      clearInterval(poll.current!);
      setStatus(ev.status);
      setDetail(ev.status === 'posted' ? (ev.messageUrl ?? null) : (ev.error ?? null));
    }, 2000);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        onClick={post}
        disabled={status === 'pending'}
        className="bg-[#5865F2] bg-none text-white hover:bg-[#4752c4]"
      >
        {status === 'pending' ? t('posting') : t('post')}
      </Button>
      {status === 'posted' && (
        <span className="text-sm text-emerald-300">
          ✓ {t('posted')}{' '}
          {detail && (
            <a href={detail} target="_blank" rel="noreferrer" className="underline">
              {t('open')}
            </a>
          )}
        </span>
      )}
      {(status === 'failed' || status === 'expired') && (
        <span className="text-sm text-red-300">
          {t(status)}
          {detail ? `: ${detail}` : ''}
        </span>
      )}
      {status === 'timeout' && <span className="text-sm text-phoenix-2">{t('timeout')}</span>}
    </div>
  );
}
