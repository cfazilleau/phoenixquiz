'use client';

import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/ui';
import type { PlayerView } from '@/lib/game-types';
import { cn } from '@/lib/utils';

const MEDALS = ['🥇', '🥈', '🥉'];

export function Leaderboard({
  players,
  limit = 10,
  highlight,
  large,
}: {
  players: PlayerView[];
  limit?: number;
  highlight?: string;
  large?: boolean;
}) {
  const t = useTranslations('game');
  const rows = players.slice(0, limit);
  if (rows.length === 0) return <p className="text-center text-muted">{t('noPlayers')}</p>;
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((p, i) => {
        const rank = 1 + players.filter((x) => x.score > p.score).length;
        return (
          <li
            key={p.userId}
            className={cn(
              'animate-pop flex items-center gap-3 rounded-xl bg-panel-2 px-4 py-2',
              large && 'py-3 text-2xl',
              p.userId === highlight && 'ring-2 ring-phoenix',
            )}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="w-10 text-center font-black text-muted">{MEDALS[rank - 1] ?? rank}</span>
            <Avatar src={p.avatarUrl} alt={p.displayName} size={large ? 48 : 32} />
            <span className="flex-1 truncate font-semibold">{p.displayName}</span>
            <span className="font-black tabular-nums text-phoenix-2">{p.score}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Podium({ players }: { players: PlayerView[] }) {
  const top = players.slice(0, 3);
  const order = [top[1], top[0], top[2]];
  const heights = ['h-32', 'h-44', 'h-24'];
  return (
    <div className="flex items-end justify-center gap-4">
      {order.map((p, i) =>
        p ? (
          <div key={p.userId} className="animate-pop flex w-40 flex-col items-center gap-2" style={{ animationDelay: `${(2 - i) * 400}ms` }}>
            <Avatar src={p.avatarUrl} alt={p.displayName} size={i === 1 ? 96 : 72} className="ring-4 ring-phoenix-2" />
            <span className="max-w-full truncate text-xl font-bold">{p.displayName}</span>
            <span className="font-black text-phoenix-2">{p.score}</span>
            <div
              className={cn(
                'grid w-full place-items-center rounded-t-xl bg-gradient-to-b from-phoenix to-phoenix-2/60 text-5xl',
                heights[i],
              )}
            >
              {MEDALS[i === 1 ? 0 : i === 0 ? 1 : 2]}
            </div>
          </div>
        ) : (
          <div key={i} className="w-40" />
        ),
      )}
    </div>
  );
}
