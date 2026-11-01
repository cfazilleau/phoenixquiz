'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui';
import type { QuestionView, RevealView } from '@/lib/game-types';
import { OPTION_COLORS, OPTION_SHAPES, cn } from '@/lib/utils';

export function useOptionLabel() {
  const tq = useTranslations('question');
  return (q: QuestionView, o: { id: string; text: string }) =>
    q.type === 'truefalse' ? tq(o.id === 'true' ? 'true' : 'false') : o.text;
}

/** For true/false, "True" is blue and "False" red, like the editor. */
export const optionColor = (q: QuestionView, i: number) => OPTION_COLORS[q.type === 'truefalse' ? (i === 0 ? 1 : 0) : i];

export function QuestionHeader({ q, index, total, large }: { q: QuestionView; index: number; total: number; large?: boolean }) {
  const tt = useTranslations('questionTypes');
  const t = useTranslations('game');
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span>{t('questionOf', { index: index + 1, total })}</span>
        <Badge>{tt(q.type)}</Badge>
        <Badge>{t('points', { points: q.points })}</Badge>
      </div>
      <h2 className={cn('font-black leading-tight', large ? 'text-4xl md:text-5xl' : 'text-2xl md:text-3xl')}>{q.prompt}</h2>
      {q.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={q.imageUrl} alt="" className={cn('rounded-xl object-contain', large ? 'max-h-[40vh]' : 'max-h-56')} />
      )}
    </div>
  );
}

/** Options as colored tiles; after reveal, correct ones are marked and counts are shown. */
export function OptionsBoard({ q, reveal, large }: { q: QuestionView; reveal: RevealView | null; large?: boolean }) {
  const label = useOptionLabel();
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      {q.options.map((o, i) => {
        const correct = reveal?.correctOptionIds.includes(o.id);
        return (
          <div
            key={o.id}
            className={cn(
              'flex items-center gap-3 rounded-xl p-4 font-bold shadow-lg transition',
              optionColor(q, i),
              large ? 'text-2xl md:text-3xl' : 'text-lg',
              reveal && !correct && 'opacity-30',
            )}
          >
            <span>{q.type === 'truefalse' ? '' : OPTION_SHAPES[i]}</span>
            <span className="flex-1">{label(q, o)}</span>
            {reveal && <span className="rounded-lg bg-black/25 px-3 py-1 tabular-nums">{reveal.distribution[o.id] ?? 0}</span>}
            {correct && <Check className="shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

/** The correct answer for non-choice questions (open, number, buzzer). */
export function AnswerReveal({ q, reveal, large }: { q: QuestionView; reveal: RevealView; large?: boolean }) {
  const t = useTranslations('game');
  return (
    <div className={cn('flex flex-col items-center gap-4 text-center', large && 'text-2xl')}>
      {q.type === 'number' && reveal.numberAnswer !== null && (
        <p>
          {t('correctAnswer')}{' '}
          <strong className="text-emerald-300">
            {reveal.numberAnswer}
            {reveal.tolerance ? ` ± ${reveal.tolerance}` : ''}
          </strong>
        </p>
      )}
      {(q.type === 'open' || q.type === 'buzzer') && reveal.acceptedAnswers.length > 0 && (
        <p>
          {t('correctAnswer')} <strong className="text-emerald-300">{reveal.acceptedAnswers.join(' / ')}</strong>
        </p>
      )}
      {q.type === 'open' && reveal.topAnswers.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {reveal.topAnswers.map((a) => (
            <span
              key={a.text}
              className={cn('rounded-full px-3 py-1 text-base', a.correct ? 'bg-emerald-700' : 'bg-panel-2')}
            >
              {a.text} × {a.count}
            </span>
          ))}
        </div>
      )}
      {q.type !== 'buzzer' && (
        <p className="text-muted">{t('correctCount', { correct: reveal.correctCount, total: reveal.answerCount })}</p>
      )}
    </div>
  );
}
