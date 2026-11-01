'use client';

import { Check, Copy, ExternalLink, Minus, Plus, UserX, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Countdown } from '@/components/game/Countdown';
import { optionColor, useOptionLabel } from '@/components/game/QuestionDisplay';
import { Avatar, Badge, Button, Card, Input, Select } from '@/components/ui';
import type { AdminAnswerView, GameView } from '@/lib/game-types';
import type { AdminAction } from '@/lib/schemas';
import type { Question } from '@/lib/types';
import { useGame, type ActionResult } from '@/lib/useGame';
import { cn } from '@/lib/utils';
import { DiscordPostButton } from './DiscordPostButton';

export function ControlPanel({ sessionId, code }: { sessionId: string; code: string }) {
  const t = useTranslations('control');
  const te = useTranslations('errors');
  const ts = useTranslations('status');
  const { view, error, connected, clockOffset, admin } = useGame(code, 'admin');
  const [lastError, setLastError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const act = async (action: AdminAction): Promise<ActionResult> => {
    const res = await admin(action);
    setLastError(res.ok ? null : te.has(res.error) ? te(res.error) : res.error);
    return res;
  };

  if (error && !view) return <p className="text-red-300">{te.has(error) ? te(error) : error}</p>;
  if (!view?.admin) return <p className="text-muted">{t('connecting')}</p>;

  const q = view.admin.question;
  const s = view.status;
  const presenterUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/present/${view.code}?t=${view.admin.presenterToken}` : '';
  const isLast = view.index + 1 >= view.total;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <Card className="flex flex-wrap items-center gap-4">
        <div className="mr-auto">
          <h1 className="text-2xl font-black">{view.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>
              {t('code')} <strong className="font-mono text-lg text-white">{view.code}</strong>
            </span>
            <Badge className={s === 'ended' ? '' : 'bg-emerald-700'}>{ts(s)}</Badge>
            <span className={cn('flex items-center gap-1', !connected && 'text-red-300')}>
              <span className={cn('h-2 w-2 rounded-full', connected ? 'bg-emerald-400' : 'bg-red-400')} />
              {connected ? t('connected') : t('disconnected')}
            </span>
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(presenterUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          <Copy size={14} /> {copied ? t('copied') : t('copyPresenter')}
        </Button>
        <a href={presenterUrl} target="_blank" rel="noreferrer">
          <Button size="sm" variant="secondary">
            <ExternalLink size={14} /> {t('openPresenter')}
          </Button>
        </a>
        <a href={`/api/sessions/${sessionId}/export`}>
          <Button size="sm" variant="secondary">
            {t('export')}
          </Button>
        </a>
        {s === 'ended' && <DiscordPostButton sessionId={sessionId} />}
      </Card>

      {/* Flow controls */}
      {s !== 'ended' && (
      <Card className="flex flex-wrap items-center gap-2">
        {s === 'lobby' && (
          <Button size="lg" onClick={() => act({ type: 'start' })} disabled={view.total === 0}>
            ▶ {t('start')}
          </Button>
        )}
        {s === 'question' && (
          <Button variant="secondary" onClick={() => act({ type: 'close' })}>
            {t('close')}
          </Button>
        )}
        {(s === 'question' || s === 'closed') && <Button onClick={() => act({ type: 'reveal' })}>{t('reveal')}</Button>}
        {(s === 'question' || s === 'closed' || s === 'reveal') && (
          <Button variant="secondary" onClick={() => act({ type: 'leaderboard' })}>
            {t('leaderboard')}
          </Button>
        )}
        {s !== 'lobby' && (
          <Button onClick={() => act({ type: 'next' })} disabled={isLast}>
            {t('next')} →
          </Button>
        )}
        {view.total > 0 && (
          <Select
            className="w-auto"
            value=""
            onChange={(e) => e.target.value !== '' && act({ type: 'goto', index: Number(e.target.value) })}
          >
            <option value="">{t('jumpTo')}</option>
            {Array.from({ length: view.total }, (_, i) => (
              <option key={i} value={i}>
                #{i + 1}
              </option>
            ))}
          </Select>
        )}
        <div className="ml-auto flex items-center gap-3">
          {s !== 'lobby' && (
            <span className="text-sm text-muted">{t('questionOf', { index: view.index + 1, total: view.total })}</span>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (confirm(t('confirmEnd'))) void act({ type: 'end' });
            }}
          >
            {t('end')}
          </Button>
        </div>
        {lastError && <p className="w-full text-sm text-red-300">{lastError}</p>}
      </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {q && s !== 'lobby' && (
            <Card className="flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <p className="text-sm text-muted">
                    #{view.index + 1} · {t('pointsShort', { points: q.points })}
                  </p>
                  <h2 className="text-2xl font-bold">{q.prompt}</h2>
                </div>
                <Countdown deadline={view.deadline} clockOffset={clockOffset} total={q.timeLimitSec} />
              </div>
              <AdminAnswerKey q={q} view={view} />
              {q.type !== 'buzzer' && (
                <p className="text-sm text-muted">
                  {t('answeredOf', { answered: view.answeredCount, total: view.players.length })}
                </p>
              )}
            </Card>
          )}

          {q?.type === 'buzzer' && s !== 'lobby' && <BuzzerControls view={view} act={act} />}

          {q && s !== 'lobby' && q.type !== 'buzzer' && <AnswersTable q={q} answers={view.admin.answers} act={act} />}

          {s === 'lobby' && (
            <Card>
              <p className="text-lg">{t('lobbyHelp')}</p>
            </Card>
          )}
        </div>

        <PlayersPanel view={view} act={act} />
      </div>
    </div>
  );
}

function AdminAnswerKey({ q, view }: { q: Question; view: GameView }) {
  const t = useTranslations('control');
  const label = useOptionLabel();
  if (q.options.length > 0) {
    const counts: Record<string, number> = {};
    for (const a of view.admin!.answers) if (Array.isArray(a.value)) for (const id of a.value) counts[id] = (counts[id] ?? 0) + 1;
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((o, i) => (
          <div
            key={o.id}
            className={cn('flex items-center gap-2 rounded-lg px-3 py-2 font-semibold', optionColor(q, i), !o.correct && 'opacity-40')}
          >
            <span className="flex-1">{label(q, o)}</span>
            <span className="rounded bg-black/25 px-2 tabular-nums">{counts[o.id] ?? 0}</span>
            {o.correct && <Check size={18} />}
          </div>
        ))}
      </div>
    );
  }
  if (q.type === 'number')
    return (
      <p>
        {t('expected')}{' '}
        <strong className="text-emerald-300">
          {q.numberAnswer}
          {q.tolerance ? ` ± ${q.tolerance}` : ''}
        </strong>
      </p>
    );
  if (q.acceptedAnswers.length > 0)
    return (
      <p>
        {t('expected')} <strong className="text-emerald-300">{q.acceptedAnswers.join(' / ')}</strong>
      </p>
    );
  return null;
}

function formatAnswer(q: Question, a: AdminAnswerView, label: (q: Question, o: { id: string; text: string }) => string) {
  if (Array.isArray(a.value))
    return a.value.map((id) => {
      const o = q.options.find((x) => x.id === id);
      return o ? label(q, o) : id;
    }).join(', ');
  return String(a.value);
}

function AnswersTable({
  q,
  answers,
  act,
}: {
  q: Question;
  answers: AdminAnswerView[];
  act: (a: AdminAction) => Promise<ActionResult>;
}) {
  const t = useTranslations('control');
  const label = useOptionLabel();
  const sorted = [...answers].sort((a, b) => a.submittedAt - b.submittedAt);
  return (
    <Card className="p-0">
      <h3 className="border-b border-line p-4 font-bold">{t('answers', { count: answers.length })}</h3>
      {sorted.length === 0 ? (
        <p className="p-4 text-sm text-muted">{t('noAnswers')}</p>
      ) : (
        <ul className="divide-y divide-line/50">
          {sorted.map((a) => (
            <li key={a.userId} className="flex items-center gap-3 px-4 py-2">
              <span className="w-40 truncate font-semibold">{a.displayName}</span>
              <span className="flex-1 truncate">{formatAnswer(q, a, label as never)}</span>
              {a.overridden && <Badge>{t('overridden')}</Badge>}
              <span className="w-14 text-right tabular-nums text-muted">{a.points}</span>
              <button
                title={t('markCorrect')}
                onClick={() => act({ type: 'override', questionId: q.id, userId: a.userId, correct: true })}
                className={cn('rounded p-1', a.correct ? 'bg-emerald-600 text-white' : 'text-muted hover:text-emerald-300')}
              >
                <Check size={16} />
              </button>
              <button
                title={t('markWrong')}
                onClick={() => act({ type: 'override', questionId: q.id, userId: a.userId, correct: false })}
                className={cn('rounded p-1', a.correct === false ? 'bg-red-600 text-white' : 'text-muted hover:text-red-300')}
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function BuzzerControls({ view, act }: { view: GameView; act: (a: AdminAction) => Promise<ActionResult> }) {
  const t = useTranslations('control');
  const b = view.buzzer!;
  const q = view.admin!.question!;
  const judged = new Map(view.admin!.answers.map((a) => [a.userId, a]));
  const running = view.status === 'question';

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-lg font-bold">{t('buzzer.title')}</h3>
        <Badge className={b.locked ? 'bg-red-800' : 'bg-emerald-700'}>{b.locked ? t('buzzer.locked') : t('buzzer.open')}</Badge>
        <Button size="sm" variant="secondary" disabled={!running || b.locked} onClick={() => act({ type: 'buzzerLock' })}>
          {t('buzzer.lock')}
        </Button>
        <Button size="sm" variant="secondary" disabled={!running || !b.locked} onClick={() => act({ type: 'buzzerUnlock' })}>
          {t('buzzer.unlock')}
        </Button>
        <Button size="sm" variant="secondary" disabled={!running} onClick={() => act({ type: 'buzzerReset', lockOutPrevious: false })}>
          {t('buzzer.reset')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!running || b.order.length === 0}
          onClick={() => act({ type: 'buzzerReset', lockOutPrevious: true })}
        >
          {t('buzzer.resetLockout')}
        </Button>
      </div>

      {b.winner ? (
        <div className="flex items-center gap-4 rounded-xl bg-emerald-900/40 p-4">
          <Avatar src={b.winner.avatarUrl} alt={b.winner.displayName} size={56} />
          <div className="flex-1">
            <p className="text-sm text-emerald-300">{t('buzzer.first')}</p>
            <p className="text-2xl font-black">{b.winner.displayName}</p>
          </div>
        </div>
      ) : (
        <p className="text-muted">{t('buzzer.waiting')}</p>
      )}

      {b.order.length > 0 && (
        <ol className="flex flex-col gap-1">
          {b.order.map((o, i) => {
            const j = judged.get(o.userId);
            return (
              <li key={o.userId} className="flex items-center gap-3 rounded-lg bg-panel-2 px-3 py-2">
                <span className="w-6 font-mono text-muted">{i + 1}.</span>
                <span className="flex-1 font-semibold">{o.displayName}</span>
                <span className="text-xs text-muted tabular-nums">+{((o.at - b.order[0].at) / 1000).toFixed(2)}s</span>
                <Button
                  size="sm"
                  variant={j?.correct ? 'success' : 'secondary'}
                  onClick={() => act({ type: 'buzzerJudge', userId: o.userId, correct: true })}
                >
                  <Check size={14} /> +{q.points}
                </Button>
                <Button
                  size="sm"
                  variant={j?.correct === false ? 'danger' : 'secondary'}
                  onClick={() => act({ type: 'buzzerJudge', userId: o.userId, correct: false })}
                >
                  <X size={14} />
                </Button>
              </li>
            );
          })}
        </ol>
      )}
      {b.lockedOut.length > 0 && (
        <p className="text-xs text-muted">
          {t('buzzer.lockedOutList', {
            names: b.lockedOut.map((id) => view.players.find((p) => p.userId === id)?.displayName ?? '?').join(', '),
          })}
        </p>
      )}
    </Card>
  );
}

function PlayersPanel({ view, act }: { view: GameView; act: (a: AdminAction) => Promise<ActionResult> }) {
  const t = useTranslations('control');
  const [editing, setEditing] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const kicked = view.admin!.kicked;

  const submitAdjust = async (userId: string, sign: 1 | -1) => {
    const n = Math.round(Number(amount));
    if (!Number.isFinite(n) || n === 0) return;
    const res = await act({ type: 'adjustScore', userId, delta: sign * Math.abs(n), reason });
    if (res.ok) {
      setEditing(null);
      setAmount('');
      setReason('');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-0">
        <h3 className="border-b border-line p-4 font-bold">{t('players', { count: view.players.length })}</h3>
        {view.players.length === 0 && <p className="p-4 text-sm text-muted">{t('noPlayers')}</p>}
        <ul className="divide-y divide-line/50">
          {view.players.map((p, i) => (
            <li key={p.userId} className="px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="w-5 text-xs text-muted">{i + 1}</span>
                <div className="relative">
                  <Avatar src={p.avatarUrl} alt={p.displayName} size={28} />
                  <span
                    className={cn(
                      'absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-panel',
                      p.connected ? 'bg-emerald-400' : 'bg-gray-500',
                    )}
                  />
                </div>
                <span className="flex-1 truncate text-sm font-semibold">{p.displayName}</span>
                {p.answered && <Check size={14} className="text-emerald-400" />}
                <button
                  onClick={() => setEditing(editing === p.userId ? null : p.userId)}
                  className="rounded px-2 font-black tabular-nums text-phoenix-2 hover:bg-panel-2"
                  title={t('editScore')}
                >
                  {p.score}
                </button>
                <button
                  onClick={() => confirm(t('confirmKick', { name: p.displayName })) && act({ type: 'kick', userId: p.userId })}
                  className="p-1 text-muted hover:text-red-300"
                  title={t('kick')}
                >
                  <UserX size={14} />
                </button>
              </div>
              {editing === p.userId && (
                <div className="mt-2 flex flex-col gap-2 rounded-lg bg-panel-2 p-2">
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      autoFocus
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={t('amount')}
                      className="py-1"
                    />
                    <Button size="sm" variant="success" onClick={() => submitAdjust(p.userId, 1)}>
                      <Plus size={14} />
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => submitAdjust(p.userId, -1)}>
                      <Minus size={14} />
                    </Button>
                  </div>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('reason')} className="py-1" maxLength={200} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {kicked.length > 0 && (
        <Card className="p-0">
          <h3 className="border-b border-line p-4 font-bold">{t('kicked')}</h3>
          <ul className="divide-y divide-line/50">
            {kicked.map((p) => (
              <li key={p.userId} className="flex items-center gap-2 px-4 py-2 text-sm">
                <span className="flex-1 truncate">{p.displayName}</span>
                <Button size="sm" variant="ghost" onClick={() => act({ type: 'unkick', userId: p.userId })}>
                  {t('unkick')}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {view.admin!.adjustments.length > 0 && (
        <Card className="p-0">
          <h3 className="border-b border-line p-4 font-bold">{t('adjustments')}</h3>
          <ul className="max-h-64 divide-y divide-line/50 overflow-y-auto text-sm">
            {[...view.admin!.adjustments].reverse().map((a, i) => (
              <li key={i} className="flex gap-2 px-4 py-2">
                <span className={cn('w-14 font-bold tabular-nums', a.delta > 0 ? 'text-emerald-300' : 'text-red-300')}>
                  {a.delta > 0 ? '+' : ''}
                  {a.delta}
                </span>
                <span className="flex-1 truncate">{a.displayName}</span>
                <span className="truncate text-muted">{a.reason}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
