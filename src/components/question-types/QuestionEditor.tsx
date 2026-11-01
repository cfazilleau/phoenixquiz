'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Input, Label, Textarea } from '@/components/ui';
import type { Question } from '@/lib/types';
import { OPTION_COLORS, OPTION_SHAPES, cn } from '@/lib/utils';
import { newId } from './defaults';

interface Props {
  question: Question;
  onChange: (q: Question) => void;
}

const numOrNull = (v: string) => (v.trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function QuestionEditor({ question: q, onChange }: Props) {
  const t = useTranslations('editor');
  const set = (patch: Partial<Question>) => onChange({ ...q, ...patch });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>{t('prompt')}</Label>
        <Textarea rows={2} value={q.prompt} onChange={(e) => set({ prompt: e.target.value })} maxLength={500} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label>{t('points')}</Label>
          <Input
            type="number"
            min={0}
            value={q.points}
            onChange={(e) => set({ points: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
          />
        </div>
        <div>
          <Label>{t('timeLimit')}</Label>
          <Input
            type="number"
            min={5}
            max={600}
            placeholder={t('manual')}
            value={q.timeLimitSec ?? ''}
            onChange={(e) => set({ timeLimitSec: numOrNull(e.target.value) })}
          />
        </div>
        <div>
          <Label>{t('imageUrl')}</Label>
          <Input
            type="url"
            placeholder="https://…"
            value={q.imageUrl ?? ''}
            onChange={(e) => set({ imageUrl: e.target.value || null })}
          />
        </div>
      </div>

      {(q.type === 'single' || q.type === 'multiple') && <ChoiceEditor q={q} set={set} />}
      {q.type === 'truefalse' && <TrueFalseEditor q={q} set={set} />}
      {q.type === 'open' && (
        <AnswerListEditor
          label={t('acceptedAnswers')}
          hint={t('acceptedHint')}
          values={q.acceptedAnswers}
          onChange={(acceptedAnswers) => set({ acceptedAnswers })}
        />
      )}
      {q.type === 'number' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>{t('numberAnswer')}</Label>
            <Input
              type="number"
              step="any"
              value={q.numberAnswer ?? ''}
              onChange={(e) => set({ numberAnswer: numOrNull(e.target.value) })}
            />
          </div>
          <div>
            <Label>{t('tolerance')}</Label>
            <Input
              type="number"
              step="any"
              min={0}
              value={q.tolerance ?? ''}
              onChange={(e) => set({ tolerance: numOrNull(e.target.value) })}
            />
          </div>
        </div>
      )}
      {q.type === 'buzzer' && (
        <div>
          <Label>{t('expectedAnswer')}</Label>
          <Input
            value={q.acceptedAnswers[0] ?? ''}
            onChange={(e) => set({ acceptedAnswers: e.target.value ? [e.target.value] : [] })}
            placeholder={t('optional')}
          />
          <p className="mt-1 text-xs text-muted">{t('buzzerHint')}</p>
        </div>
      )}
    </div>
  );
}

function ChoiceEditor({ q, set }: { q: Question; set: (p: Partial<Question>) => void }) {
  const t = useTranslations('editor');
  const multi = q.type === 'multiple';

  const toggleCorrect = (id: string) =>
    set({
      options: q.options.map((o) =>
        multi ? (o.id === id ? { ...o, correct: !o.correct } : o) : { ...o, correct: o.id === id },
      ),
    });

  return (
    <div>
      <Label>{multi ? t('optionsMulti') : t('optionsSingle')}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((o, i) => (
          <div key={o.id} className={cn('flex items-center gap-2 rounded-lg p-2', OPTION_COLORS[i])}>
            <span className="w-5 text-center text-lg">{OPTION_SHAPES[i]}</span>
            <Input
              value={o.text}
              maxLength={200}
              onChange={(e) => set({ options: q.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })}
              className="border-transparent bg-black/25"
            />
            <input
              type={multi ? 'checkbox' : 'radio'}
              checked={o.correct}
              onChange={() => toggleCorrect(o.id)}
              title={t('correct')}
              className="h-5 w-5 accent-emerald-400"
            />
            <button
              type="button"
              disabled={q.options.length <= 2}
              onClick={() => {
                const options = q.options.filter((x) => x.id !== o.id);
                if (!multi && !options.some((x) => x.correct)) options[0] = { ...options[0], correct: true };
                set({ options });
              }}
              className="text-white/70 hover:text-white disabled:opacity-30"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2"
        disabled={q.options.length >= 8}
        onClick={() => set({ options: [...q.options, { id: newId(), text: '', correct: false }] })}
      >
        <Plus size={14} /> {t('addOption')}
      </Button>
    </div>
  );
}

function TrueFalseEditor({ q, set }: { q: Question; set: (p: Partial<Question>) => void }) {
  const t = useTranslations('editor');
  const tq = useTranslations('question');
  return (
    <div>
      <Label>{t('correctAnswer')}</Label>
      <div className="flex gap-3">
        {q.options.map((o, i) => (
          <label
            key={o.id}
            className={cn(
              'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg p-3 text-lg font-bold',
              OPTION_COLORS[i === 0 ? 1 : 0],
              !o.correct && 'opacity-50',
            )}
          >
            <input
              type="radio"
              className="h-5 w-5 accent-emerald-400"
              checked={o.correct}
              onChange={() => set({ options: q.options.map((x) => ({ ...x, correct: x.id === o.id })) })}
            />
            {tq(o.id === 'true' ? 'true' : 'false')}
          </label>
        ))}
      </div>
    </div>
  );
}

function AnswerListEditor({
  label,
  hint,
  values,
  onChange,
}: {
  label: string;
  hint: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const t = useTranslations('editor');
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft('');
  };
  return (
    <div>
      <Label>{label}</Label>
      <div className="mb-2 flex flex-wrap gap-2">
        {values.map((v) => (
          <span key={v} className="flex items-center gap-1 rounded-full bg-emerald-700/60 px-3 py-1 text-sm">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="opacity-70 hover:opacity-100">
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          maxLength={200}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={t('addAnswerPlaceholder')}
        />
        <Button type="button" variant="secondary" onClick={add}>
          <Plus size={14} />
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}
