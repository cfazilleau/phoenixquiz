'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, GameView, ServerToClientEvents, ViewRole } from './game-types';
import type { AdminAction, AnswerPayload } from './schemas';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Connects to a session as a player, admin or presenter and keeps the latest view.
 * Rejoins automatically after reconnects (server restarts, flaky networks).
 */
export function useGame(code: string, role: ViewRole, token?: string) {
  const [view, setView] = useState<GameView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [kicked, setKicked] = useState(false);
  /** Server clock minus local clock, so countdowns agree with the server. */
  const [clockOffset, setClockOffset] = useState(0);
  const socketRef = useRef<GameSocket | null>(null);

  useEffect(() => {
    // Default transports: HTTP long-polling first, then upgrade to WebSocket. Players still connect
    // when WebSockets are blocked (proxies, flaky networks) instead of hanging on "Connecting…".
    const socket: GameSocket = io({ path: '/socket.io' });
    socketRef.current = socket;

    const join = () =>
      socket.emit('session:join', { code, role, token }, (res) => {
        if (!res.ok) setError(res.error);
        else setError(null);
      });

    socket.on('connect', () => {
      setConnected(true);
      join();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('state', (v) => {
      setClockOffset(v.serverNow - Date.now());
      setView(v);
    });
    socket.on('kicked', () => setKicked(true));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code, role, token]);

  const call = useCallback(
    <E extends 'player:answer' | 'admin:action'>(event: E, payload: E extends 'player:answer' ? AnswerPayload : AdminAction) =>
      new Promise<ActionResult>((resolve) => {
        const s = socketRef.current;
        if (!s?.connected) return resolve({ ok: false, error: 'disconnected' });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s.emit as any)(event, payload, resolve);
      }),
    [],
  );

  const answer = useCallback((payload: AnswerPayload) => call('player:answer', payload), [call]);
  const admin = useCallback((action: AdminAction) => call('admin:action', action), [call]);
  const buzz = useCallback(
    () =>
      new Promise<ActionResult>((resolve) => {
        const s = socketRef.current;
        if (!s?.connected) return resolve({ ok: false, error: 'disconnected' });
        s.emit('player:buzz', resolve);
      }),
    [],
  );

  return { view, error, connected, kicked, clockOffset, answer, admin, buzz };
}
