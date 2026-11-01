# PhoenixQuiz — development notes

Live quiz web app. Next.js 16 App Router + custom `server.ts` (Next + Socket.IO on one port), Auth.js v5 (Discord, JWT), Mongoose on the FriendlyFire Atlas cluster (database from `MONGODB_DB`), next-intl (EN/FR, cookie-based, no URL prefix), Tailwind 4.

## Commands
- `npm run dev`: dev server on http://localhost:3000. Pages and components hot-reload. Changes to `server.ts` or `src/server/game/*` (the Socket.IO side) need a **manual restart**. Running sessions resume from MongoDB after it. Don't use `tsx watch`: restarting the whole Next dev server under open tabs puts them into an HMR full-reload loop.
- `npm test`: Vitest unit tests
- `npm run typecheck`
- `npm run build`: `next build` plus an esbuild bundle of `server.ts` to `dist/server.js`

## Git
- Remote: `git@github.com:cfazilleau/phoenixquiz.git`.
- Branches: `feature/<name>`, `fix/<name>` or `issue/<n>-<name>`. PRs target **`unstable`**. Only the owner merges into `main`, after checking on `unstable`.
- Docker images are published on `version/*` tags.

## Architecture
- `src/server/game/LiveGame.ts`: the authoritative in-memory state of one session. It is pure logic, with persistence injected through `GameStore`, so it can be unit-tested without MongoDB. Every player and admin action goes through it.
- `src/server/game/socket.ts`: Socket.IO auth (decodes the Auth.js cookie), joining, and broadcasting a per-role view (`viewFor`) to each socket.
- `src/server/game/GameManager.ts`: lazily loads sessions from Mongo by join code. Running sessions resume after a restart.
- Next route handlers and server actions only touch MongoDB, never the in-memory games. Live control goes exclusively through sockets.
- Correct answers must never reach players or the presenter before `reveal`. `LiveGame.test.ts` checks this.
- `src/server/models/BotEvent.ts` is a **shared contract** with the FriendlyFire bot's `quiz` cog (repo `cfazilleau/FriendlyFire`). Keep the two in sync.

## Conventions
- Every user-facing string goes in **both** `messages/en.json` and `messages/fr.json`.
- Validate all inputs with zod (`src/lib/schemas.ts`).
- Next 16: `params` and `searchParams` are Promises, and `cookies()`/`headers()` are async.
