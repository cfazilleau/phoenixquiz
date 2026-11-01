import { LiveGame } from './LiveGame';
import { loadSnapshot, mongoStore } from './store';

/**
 * Keeps one LiveGame per running session in memory. Games are loaded lazily from MongoDB the
 * first time someone connects, which also resumes sessions after a server restart.
 */
class GameManager {
  private games = new Map<string, LiveGame>();
  private loading = new Map<string, Promise<LiveGame | null>>();
  private created = new Set<(game: LiveGame) => void>();

  /** Called once per game when it's first loaded (the socket layer subscribes to it). */
  onGameLoaded(fn: (game: LiveGame) => void) {
    this.created.add(fn);
  }

  async getByCode(code: string): Promise<LiveGame | null> {
    const key = code.toUpperCase();
    const cached = this.games.get(key);
    if (cached) return cached;

    let pending = this.loading.get(key);
    if (!pending) {
      pending = (async () => {
        const data = await loadSnapshot({ joinCode: key });
        if (!data) return null;
        const game = new LiveGame(data.snapshot, data.answers, mongoStore);
        this.games.set(key, game);
        for (const fn of this.created) fn(game);
        return game;
      })().finally(() => this.loading.delete(key));
      this.loading.set(key, pending);
    }
    return pending;
  }

  /** Drops a game from memory (e.g. once ended and nobody is connected). */
  unload(code: string) {
    const game = this.games.get(code);
    if (!game) return;
    game.dispose();
    this.games.delete(code);
  }
}

const globalForGames = globalThis as unknown as { __gameManager?: GameManager };
export const gameManager = (globalForGames.__gameManager ??= new GameManager());
