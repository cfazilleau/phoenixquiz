'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { BuzzerView } from '@/lib/game-types';
import { cn } from '@/lib/utils';

export function BuzzerButton({
  buzzer,
  me,
  lockedOut,
  open,
  onBuzz,
}: {
  buzzer: BuzzerView;
  me: string;
  lockedOut: boolean;
  /** The question is still running. */
  open: boolean;
  onBuzz: () => Promise<boolean>;
}) {
  const t = useTranslations('game');
  const [pressed, setPressed] = useState(false);
  const iWon = buzzer.winner?.userId === me;
  const myPress = buzzer.order.findIndex((o) => o.userId === me);
  const canBuzz = open && !buzzer.locked && !lockedOut && myPress === -1;

  useEffect(() => {
    if (myPress !== -1 || buzzer.order.length === 0) setPressed(false);
  }, [myPress, buzzer.order.length]);

  useEffect(() => {
    if (!canBuzz) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        setPressed(true);
        void onBuzz().then((ok) => !ok && setPressed(false));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canBuzz, onBuzz]);

  let status: string;
  if (iWon) status = t('buzzer.youWon');
  else if (lockedOut) status = t('buzzer.lockedOut');
  else if (buzzer.winner) status = t('buzzer.someoneWon', { name: buzzer.winner.displayName });
  else if (!open || buzzer.locked) status = t('buzzer.locked');
  else status = t('buzzer.ready');

  return (
    <div className="flex flex-col items-center gap-6">
      <button
        disabled={!canBuzz || pressed}
        onPointerDown={() => {
          if (!canBuzz || pressed) return;
          setPressed(true);
          void onBuzz().then((ok) => !ok && setPressed(false));
        }}
        className={cn(
          'grid h-64 w-64 select-none place-items-center rounded-full border-8 text-4xl font-black uppercase shadow-2xl transition active:scale-95',
          iWon && 'animate-pop border-emerald-300 bg-emerald-500 shadow-emerald-500/50',
          !iWon && canBuzz && 'border-red-300 bg-red-600 shadow-red-600/50 hover:brightness-110',
          !iWon && !canBuzz && 'border-line bg-panel-2 text-muted',
        )}
      >
        {iWon ? '🎉' : t('buzzer.buzz')}
      </button>
      <p className={cn('text-center text-xl font-bold', iWon && 'text-emerald-300')}>{status}</p>
      {myPress > 0 && <p className="text-sm text-muted">{t('buzzer.position', { position: myPress + 1 })}</p>}
    </div>
  );
}
