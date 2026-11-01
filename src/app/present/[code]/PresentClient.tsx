'use client';

import { useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Countdown } from '@/components/game/Countdown';
import { Leaderboard, Podium } from '@/components/game/Leaderboard';
import { AnswerReveal, OptionsBoard, QuestionHeader } from '@/components/game/QuestionDisplay';
import { Avatar } from '@/components/ui';
import type { GameView } from '@/lib/game-types';
import { useGame } from '@/lib/useGame';
import { cn } from '@/lib/utils';

export function PresentClient({ code, token }: { code: string; token: string }) {
  const t = useTranslations('game');
  const te = useTranslations('errors');
  const { view, error, clockOffset } = useGame(code, 'presenter', token);

  if (error && !view) return <Center>{te.has(error) ? te(error) : te('server_error')}</Center>;
  if (!view) return <Center>{t('connecting')}</Center>;

  const q = view.question;
  return (
    <div className="flex min-h-screen flex-col gap-8 p-8">
      <header className="flex items-center justify-between text-xl text-muted">
        <span className="font-black text-white">🔥 {view.title}</span>
        {view.status !== 'lobby' && (
          <span>
            {t('joinAt')} <strong className="font-mono text-white">{view.code}</strong>
          </span>
        )}
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        {view.status === 'lobby' && <PresenterLobby view={view} />}

        {q && (view.status === 'question' || view.status === 'closed' || view.status === 'reveal') && (
          <>
            <div className="flex w-full max-w-6xl items-start gap-6">
              <div className="flex-1">
                <QuestionHeader q={q} index={view.index} total={view.total} large />
              </div>
              <div className="flex flex-col items-center gap-2">
                <Countdown deadline={view.deadline} clockOffset={clockOffset} total={q.timeLimitSec} className="h-28 w-28 [&_span]:text-5xl" />
                {q.type !== 'buzzer' && (
                  <span className="text-lg text-muted">
                    {t('answeredOf', { answered: view.answeredCount, total: view.players.length })}
                  </span>
                )}
              </div>
            </div>

            {q.options.length > 0 && <OptionsBoard q={q} reveal={view.reveal} large />}
            {q.type === 'buzzer' && view.buzzer && <PresenterBuzzer view={view} />}
            {view.reveal && q.options.length === 0 && <AnswerReveal q={q} reveal={view.reveal} large />}
            {view.status === 'closed' && <p className="text-3xl font-bold text-muted">{t('answersClosed')}</p>}
            {view.status === 'question' && (q.type === 'open' || q.type === 'number') && (
              <p className="text-2xl text-muted">{t('answerOnDevice')}</p>
            )}
          </>
        )}

        {view.status === 'leaderboard' && (
          <div className="w-full max-w-3xl">
            <h2 className="mb-6 text-center text-5xl font-black">{t('leaderboard')}</h2>
            <Leaderboard players={view.players} limit={8} large />
          </div>
        )}

        {view.status === 'ended' && (
          <div className="flex w-full max-w-4xl flex-col gap-10">
            <h2 className="text-center text-6xl font-black">{t('finalResults')}</h2>
            <Podium players={view.players} />
            {view.players.length > 3 && <Leaderboard players={view.players.slice(3)} limit={7} />}
          </div>
        )}
      </div>
    </div>
  );
}

function PresenterLobby({ view }: { view: GameView }) {
  const t = useTranslations('game');
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState('');

  useEffect(() => {
    const joinUrl = `${window.location.origin}/join/${view.code}`;
    setUrl(joinUrl);
    QRCode.toDataURL(joinUrl, { margin: 1, width: 320, color: { dark: '#0f0b1e', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [view.code]);

  return (
    <div className="flex w-full max-w-6xl flex-col items-center gap-10">
      <div className="flex flex-wrap items-center justify-center gap-10">
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR" className="h-64 w-64 rounded-2xl" />
        )}
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-2xl text-muted">{t('joinAt')}</p>
          <p className="text-3xl font-semibold">{url.replace(/^https?:\/\//, '').replace(/\/join\/.*/, '/join')}</p>
          <p className="rounded-2xl bg-white px-8 py-4 font-mono text-7xl font-black tracking-[0.2em] text-ink">{view.code}</p>
        </div>
      </div>
      <p className="text-2xl font-bold">{t('playersCount', { count: view.players.length })}</p>
      <div className="flex flex-wrap justify-center gap-4">
        {view.players.map((p) => (
          <div key={p.userId} className="animate-pop flex items-center gap-3 rounded-full bg-panel-2 py-2 pl-2 pr-5 text-xl">
            <Avatar src={p.avatarUrl} alt={p.displayName} size={44} />
            <span className="font-semibold">{p.displayName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PresenterBuzzer({ view }: { view: GameView }) {
  const t = useTranslations('game');
  const b = view.buzzer!;
  return (
    <div className="flex flex-col items-center gap-6">
      {b.winner ? (
        <div className="animate-pop flex flex-col items-center gap-4">
          <Avatar src={b.winner.avatarUrl} alt={b.winner.displayName} size={160} className="ring-8 ring-emerald-400" />
          <p className="text-5xl font-black">{b.winner.displayName}</p>
          <p className="text-2xl text-emerald-300">{t('buzzer.buzzedFirst')}</p>
        </div>
      ) : (
        <div
          className={cn(
            'grid h-48 w-48 place-items-center rounded-full border-8 text-3xl font-black uppercase',
            b.locked || view.status !== 'question' ? 'border-line bg-panel-2 text-muted' : 'animate-pulse border-red-300 bg-red-600',
          )}
        >
          {b.locked || view.status !== 'question' ? t('buzzer.lockedShort') : t('buzzer.buzz')}
        </div>
      )}
      {b.order.length > 1 && (
        <p className="text-lg text-muted">
          {t('buzzer.then')} {b.order.slice(1, 6).map((o) => o.displayName).join(', ')}
        </p>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center text-3xl font-bold">{children}</div>;
}
