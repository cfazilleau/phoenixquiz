'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function useRemaining(deadline: number | null, clockOffset: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline - (now + clockOffset)) / 1000));
}

export function Countdown({
  deadline,
  clockOffset,
  total,
  className,
}: {
  deadline: number | null;
  clockOffset: number;
  total?: number | null;
  className?: string;
}) {
  const remaining = useRemaining(deadline, clockOffset);
  if (remaining === null) return null;
  const pct = total ? Math.min(100, (remaining / total) * 100) : 100;
  return (
    <div className={cn('relative grid h-16 w-16 place-items-center', className)}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={`${pct} 100`}
          pathLength={100}
          className={cn('transition-all duration-200', remaining <= 5 ? 'text-red-400' : 'text-phoenix-2')}
        />
      </svg>
      <span className={cn('text-2xl font-black tabular-nums', remaining <= 5 && 'text-red-300')}>{remaining}</span>
    </div>
  );
}
