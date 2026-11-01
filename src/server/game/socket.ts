import type { Server as HttpServer } from 'node:http';
import { getToken } from 'next-auth/jwt';
import { Server, type Socket } from 'socket.io';
import type { Ack, ClientToServerEvents, ServerToClientEvents, ViewRole } from '@/lib/game-types';
import { adminActionSchema, answerPayloadSchema, joinPayloadSchema } from '@/lib/schemas';
import { isAdminRole } from '@/lib/types';
import { getUserById, type CurrentUser } from '../users';
import { gameManager } from './GameManager';
import type { LiveGame } from './LiveGame';

interface SocketData {
  user: CurrentUser | null;
  code: string | null;
  role: ViewRole | null;
  /** Whether this socket counts towards the player's presence in its game. */
  present: boolean;
}

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const roomOf = (code: string) => `game:${code}`;
const UNLOAD_DELAY_MS = 10 * 60 * 1000;

/** Reads the Auth.js session cookie from the handshake (secure name behind HTTPS, plain locally). */
async function userFromCookie(cookie: string | undefined): Promise<CurrentUser | null> {
  if (!cookie) return null;
  const secret = process.env.AUTH_SECRET;
  for (const secureCookie of [true, false]) {
    const token = await getToken({ req: { headers: { cookie } }, secret, secureCookie }).catch(() => null);
    if (token?.uid) return getUserById(token.uid);
  }
  return null;
}

function reply(ack: unknown, res: Parameters<Ack>[0]) {
  if (typeof ack === 'function') (ack as Ack)(res);
}

export function attachGameSockets(httpServer: HttpServer): IO {
  const io: IO = new Server(httpServer, {
    path: '/socket.io',
    // Leave other upgrade requests (Next's dev HMR socket) alone.
    destroyUpgrade: false,
    pingInterval: 20_000,
    pingTimeout: 20_000,
  });
  const unloadTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const socketsIn = (code: string): GameSocket[] => {
    const ids = io.sockets.adapter.rooms.get(roomOf(code));
    if (!ids) return [];
    return [...ids].map((id) => io.sockets.sockets.get(id)).filter((s): s is GameSocket => !!s);
  };

  const sendState = (game: LiveGame, socket: GameSocket) => {
    if (!socket.data.role) return;
    socket.emit('state', game.viewFor(socket.data.role, socket.data.user?.id));
  };

  gameManager.onGameLoaded((game) => {
    game.onChange(() => {
      for (const s of socketsIn(game.code)) sendState(game, s);
    });
  });

  /** Ended games are dropped from memory once nobody has been watching them for a while. */
  const scheduleUnload = (game: LiveGame) => {
    clearTimeout(unloadTimers.get(game.code));
    if (game.status !== 'ended' || socketsIn(game.code).length > 0) return;
    unloadTimers.set(
      game.code,
      setTimeout(() => {
        unloadTimers.delete(game.code);
        if (socketsIn(game.code).length === 0) gameManager.unload(game.code);
      }, UNLOAD_DELAY_MS),
    );
  };

  const leaveCurrent = async (socket: GameSocket) => {
    const { code, present, user } = socket.data;
    if (!code) return;
    await socket.leave(roomOf(code));
    const game = await gameManager.getByCode(code);
    if (game && present && user) game.disconnect(user.id);
    socket.data.code = null;
    socket.data.role = null;
    socket.data.present = false;
    if (game) scheduleUnload(game);
  };

  io.use(async (socket, next) => {
    try {
      socket.data.user = await userFromCookie(socket.request.headers.cookie);
      socket.data.code = null;
      socket.data.role = null;
      socket.data.present = false;
      next();
    } catch (err) {
      next(err as Error);
    }
  });

  io.on('connection', (socket: GameSocket) => {
    socket.on('session:join', async (payload, ack) => {
      try {
        const parsed = joinPayloadSchema.safeParse(payload);
        if (!parsed.success) return reply(ack, { ok: false, error: 'invalid_payload' });
        const { code, role, token } = parsed.data;
        const user = socket.data.user;

        const game = await gameManager.getByCode(code);
        if (!game) return reply(ack, { ok: false, error: 'not_found' });

        if (role === 'player') {
          if (!user) return reply(ack, { ok: false, error: 'unauthenticated' });
          const res = game.addPlayer({
            userId: user.id,
            discordId: user.discordId,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
          });
          if (!res.ok && !(res.error === 'ended' && game.status === 'ended')) return reply(ack, res);
        } else if (role === 'admin') {
          if (!isAdminRole(user?.role)) return reply(ack, { ok: false, error: 'forbidden' });
        } else if (token !== game.presenterToken && !isAdminRole(user?.role)) {
          return reply(ack, { ok: false, error: 'forbidden' });
        }

        await leaveCurrent(socket);
        await socket.join(roomOf(game.code));
        clearTimeout(unloadTimers.get(game.code));
        socket.data.code = game.code;
        socket.data.role = role;
        if (role === 'player' && user && game.player(user.id)) {
          socket.data.present = true;
          game.connect(user.id);
        }
        reply(ack, { ok: true });
        sendState(game, socket);
      } catch (err) {
        console.error('[socket] join failed', err);
        reply(ack, { ok: false, error: 'server_error' });
      }
    });

    socket.on('player:answer', async (payload, ack) => {
      const { code, role, user } = socket.data;
      if (!code || role !== 'player' || !user) return reply(ack, { ok: false, error: 'not_in_game' });
      const parsed = answerPayloadSchema.safeParse(payload);
      if (!parsed.success) return reply(ack, { ok: false, error: 'invalid_answer' });
      const game = await gameManager.getByCode(code);
      if (!game) return reply(ack, { ok: false, error: 'not_found' });
      reply(ack, game.answer(user.id, parsed.data.questionId, parsed.data.value));
    });

    socket.on('player:buzz', async (ack) => {
      const { code, role, user } = socket.data;
      if (!code || role !== 'player' || !user) return reply(ack, { ok: false, error: 'not_in_game' });
      const game = await gameManager.getByCode(code);
      if (!game) return reply(ack, { ok: false, error: 'not_found' });
      reply(ack, game.buzz(user.id));
    });

    socket.on('admin:action', async (payload, ack) => {
      const { code, role, user } = socket.data;
      if (!code || role !== 'admin' || !user || !isAdminRole(user.role)) {
        return reply(ack, { ok: false, error: 'forbidden' });
      }
      const parsed = adminActionSchema.safeParse(payload);
      if (!parsed.success) return reply(ack, { ok: false, error: 'invalid_payload' });
      const game = await gameManager.getByCode(code);
      if (!game) return reply(ack, { ok: false, error: 'not_found' });

      const action = parsed.data;
      const res = game.admin(action, user.id);
      if (res.ok && action.type === 'kick') {
        for (const s of socketsIn(code)) {
          if (s.data.role === 'player' && s.data.user?.id === action.userId) {
            s.emit('kicked');
            await leaveCurrent(s);
          }
        }
      }
      reply(ack, res);
    });

    socket.on('disconnect', () => {
      void leaveCurrent(socket);
    });
  });

  return io;
}
