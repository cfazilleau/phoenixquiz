'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AnswerInput } from '@/components/game/AnswerInput';
import { BuzzerButton } from '@/components/game/BuzzerButton';
import { Countdown } from '@/components/game/Countdown';
import { Leaderboard } from '@/components/game/Leaderboard';
import { AnswerReveal, OptionsBoard, QuestionHeader } from '@/components/game/QuestionDisplay';
import { Avatar, Card } from '@/components/ui';
import type { GameView } from '@/lib/game-types';
import { useGame } from '@/lib/useGame';
import { cn } from '@/lib/utils';

export function PlayClient({ code, userId }: { code: string; userId: string }) {
  const t = useTranslations('game');
  const te = useTranslations('errors');
  const { view, error, connected, kicked, clockOffset, answer, buzz } = useGame(code, 'player');
  const [answerError, setAnswerError] = useState<string | null>(null);

  if (kicked || error === 'kicked') return <Message title={t('kicked')} />;
  if (error && !view) return <Message title={te.has(error) ? te(error) : te('server_error')} back />;
  if (!view) return <Message title={t('connecting')} />;

  const q = view.question;
  const me = view.me;

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
      <div className="flex w-full items-center justify-between text-sm text-muted">
        <span className="font-mono">{view.code}</span>
        <span className="truncate px-2 font-semibold text-white">{view.title}</span>
        <span className={cn('flex items-center gap-1', !connected && 'text-red-300')}>
          <span className={cn('h-2 w-2 rounded-full', connected ? 'bg-emerald-400' : 'bg-red-400')} />
          {me ? t('scoreShort', { score: me.score }) : ''}
        </span>
      </div>

      {view.status === 'lobby' && <Lobby view={view} />}

      {q && (view.status === 'question' || view.status === 'closed' || view.status === 'reveal') && (
        <>
          <div className="flex w-full items-start gap-4">
            <div className="flex-1">
              <QuestionHeader q={q} index={view.index} total={view.total} />
            </div>
            <Countdown deadline={view.deadline} clockOffset={clockOffset} total={q.timeLimitSec} />
          </div>

          {q.type === 'buzzer' && view.buzzer && me ? (
            <>
              <BuzzerButton
                buzzer={view.buzzer}
                me={userId}
                lockedOut={me.lockedOut}
                open={view.status === 'question'}
                onBuzz={async () => (await buzz()).ok}
              />
              {me.result && <ResultBanner result={me.result} />}
              {view.reveal && <AnswerReveal q={q} reveal={view.reveal} />}
            </>
          ) : view.status === 'question' && me && me.answer === null ? (
            <>
              <AnswerInput
                key={q.id}
                q={q}
                onSubmit={async (value) => {
                  const res = await answer({ questionId: q.id, value });
                  setAnswerError(res.ok ? null : res.error);
                  return res.ok;
                }}
              />
              {answerError && <p className="text-red-300">{te.has(answerError) ? te(answerError) : answerError}</p>}
            </>
          ) : view.status === 'reveal' && view.reveal ? (
            <>
              {me?.result ? <ResultBanner result={me.result} /> : <p className="text-xl text-muted">{t('noAnswer')}</p>}
              {q.options.length > 0 ? <OptionsBoard q={q} reveal={view.reveal} /> : <AnswerReveal q={q} reveal={view.reveal} />}
            </>
          ) : (
            <Card className="animate-pop text-center">
              <p className="text-2xl font-bold">{me?.answer != null ? t('answerLocked') : t('answersClosed')}</p>
              <p className="mt-2 text-muted">{t('waitingReveal', { answered: view.answeredCount, total: view.players.length })}</p>
            </Card>
          )}
        </>
      )}

      {(view.status === 'leaderboard' || view.status === 'ended') && (
        <div className="flex w-full flex-col gap-6">
          <h2 className="text-center text-3xl font-black">{view.status === 'ended' ? t('finalResults') : t('leaderboard')}</h2>
          {me && (
            <Card className="text-center">
              <p className="text-5xl font-black text-phoenix-2">#{me.rank}</p>
              <p className="mt-1 text-muted">{t('yourScore', { score: me.score })}</p>
            </Card>
          )}
          <Leaderboard players={view.players} highlight={userId} />
          {view.status === 'ended' && (
            <Link href="/" className="text-center text-sm text-muted hover:text-white">
              ← {t('backHome')}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function Lobby({ view }: { view: GameView }) {
  const t = useTranslations('game');
  return (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      <Card className="animate-pop w-full">
        <p className="text-3xl font-black">{t('youreIn')}</p>
        <p className="mt-2 text-muted">{t('waitingStart')}</p>
      </Card>
      <p className="text-sm text-muted">{t('playersCount', { count: view.players.length })}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {view.players.map((p) => (
          <div key={p.userId} className="animate-pop flex items-center gap-2 rounded-full bg-panel-2 py-1 pl-1 pr-3">
            <Avatar src={p.avatarUrl} alt={p.displayName} size={28} />
            <span className="text-sm font-semibold">{p.displayName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultBanner({ result }: { result: { correct: boolean; points: number } }) {
  const t = useTranslations('game');
  return (
    <div
      className={cn(
        'animate-pop w-full rounded-2xl p-6 text-center text-3xl font-black shadow-xl',
        result.correct ? 'bg-emerald-600' : 'bg-red-600',
      )}
    >
      {result.correct ? t('correct', { points: result.points }) : t('incorrect')}
    </div>
  );
}

function Message({ title, back }: { title: string; back?: boolean }) {
  const t = useTranslations('game');
  return (
    <div className="flex flex-col items-center gap-4 pt-20 text-center">
      <p className="text-2xl font-bold">{title}</p>
      {back && (
        <Link href="/join" className="text-phoenix-2 hover:underline">
          {t('tryAnotherCode')}
        </Link>
      )}
    </div>
  );
}
