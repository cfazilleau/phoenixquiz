'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import type { QuestionView } from '@/lib/game-types';
import type { AnswerValue } from '@/lib/types';
import { OPTION_SHAPES, cn } from '@/lib/utils';
import { optionColor, useOptionLabel } from './QuestionDisplay';

/** The player's answer controls for every non-buzzer question type. */
export function AnswerInput({ q, onSubmit }: { q: QuestionView; onSubmit: (value: AnswerValue) => Promise<boolean> }) {
  const t = useTranslations('game');
  const label = useOptionLabel();
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (value: AnswerValue) => {
    if (busy) return;
    setBusy(true);
    const ok = await onSubmit(value);
    if (!ok) setBusy(false);
  };

  if (q.type === 'single' || q.type === 'truefalse') {
    return (
      <div className="grid w-full gap-3 sm:grid-cols-2">
        {q.options.map((o, i) => (
          <button
            key={o.id}
            disabled={busy}
            onClick={() => submit([o.id])}
            className={cn(
              'flex min-h-24 items-center gap-3 rounded-2xl p-5 text-left text-xl font-bold shadow-lg transition active:scale-95 disabled:opacity-60',
              optionColor(q, i),
            )}
          >
            <span className="text-2xl">{q.type === 'truefalse' ? '' : OPTION_SHAPES[i]}</span>
            {label(q, o)}
          </button>
        ))}
      </div>
    );
  }

  if (q.type === 'multiple') {
    return (
      <div className="flex w-full flex-col gap-4">
        <p className="text-center text-sm text-muted">{t('pickAll')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {q.options.map((o, i) => {
            const on = selected.includes(o.id);
            return (
              <button
                key={o.id}
                disabled={busy}
                onClick={() => setSelected(on ? selected.filter((x) => x !== o.id) : [...selected, o.id])}
                className={cn(
                  'flex min-h-20 items-center gap-3 rounded-2xl p-5 text-left text-xl font-bold shadow-lg transition',
                  optionColor(q, i),
                  !on && 'opacity-60',
                  on && 'ring-4 ring-white',
                )}
              >
                <span className="text-2xl">{OPTION_SHAPES[i]}</span>
                <span className="flex-1">{o.text}</span>
                {on && <Check />}
              </button>
            );
          })}
        </div>
        <Button size="lg" disabled={busy || selected.length === 0} onClick={() => submit(selected)}>
          {t('submit')}
        </Button>
      </div>
    );
  }

  const isNumber = q.type === 'number';
  const value = isNumber ? Number(text.replace(',', '.')) : text.trim();
  const valid = isNumber ? text.trim() !== '' && Number.isFinite(value) : text.trim().length > 0;
  return (
    <form
      className="flex w-full max-w-md flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) submit(value);
      }}
    >
      <Input
        autoFocus
        inputMode={isNumber ? 'decimal' : 'text'}
        value={text}
        maxLength={200}
        onChange={(e) => setText(e.target.value)}
        placeholder={isNumber ? t('numberPlaceholder') : t('textPlaceholder')}
        className="py-4 text-center text-2xl"
      />
      <Button size="lg" disabled={busy || !valid}>
        {t('submit')}
      </Button>
    </form>
  );
}
