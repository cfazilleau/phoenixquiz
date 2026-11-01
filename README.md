# 🔥 PhoenixQuiz

Kahoot-style live quizzes for the community, at **https://app.phxlgc.com**.

- Players sign in with **Discord**. Their **server nickname and server avatar** are used when they are in the guild.
- Admins build **activities** with six question types: single choice, multiple choice, true/false, open answer, number guess and **buzzer**.
- A live **control panel** runs the game: start, next, close, reveal, leaderboard, scores, kick, answer overrides and buzzer lock/unlock/reset.
- A **presenter screen** (projector or OBS browser source) shows the join code and QR, questions, timer, stats and podium.
- **Excel export** (`.xlsx`, which imports into Google Sheets) and a **"Post results to Discord"** button handled by the FriendlyFire bot.
- UI in English and French.

## Stack

Next.js 16 (App Router) + a custom Node server that also hosts Socket.IO, Auth.js v5 (Discord), Mongoose (MongoDB Atlas), Tailwind CSS 4, next-intl, exceljs and Vitest.

Live game state lives in memory in the single Node process (`src/server/game/LiveGame.ts`), so the buzzer is race-free. Every change is persisted to MongoDB, and running sessions resume after a restart.

## Setup

### 1. Discord (reuse FriendlyFire's application)

No new app is added to the guild: the website uses FriendlyFire's application for OAuth2 only.

1. Open the [Discord Developer Portal](https://discord.com/developers/applications), then FriendlyFire, then **OAuth2**.
2. Copy the **Client ID** into `AUTH_DISCORD_ID` and the **Client Secret** into `AUTH_DISCORD_SECRET`. This is the OAuth2 secret, not the bot token.
3. Add these redirect URIs:
   - `https://app.phxlgc.com/api/auth/callback/discord`
   - `http://localhost:3000/api/auth/callback/discord` (development)

The app requests the `identify` and `guilds.members.read` scopes. The second one reads the user's nickname and avatar on the `DISCORD_GUILD_ID` server at sign-in. Players outside the server get their global profile instead.

### 2. Environment

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `MONGODB_URI` | The FriendlyFire Atlas cluster |
| `MONGODB_DB` | `phoenixquiz` in production, `phoenixquiz_dev` locally |
| `AUTH_SECRET` | `npx auth secret` |
| `AUTH_URL` | `https://app.phxlgc.com` (or `http://localhost:3000` locally) |
| `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` | FriendlyFire's OAuth2 credentials |
| `DISCORD_GUILD_ID` | Server whose nicknames/avatars are shown |
| `SUPERADMIN_DISCORD_ID` | Comma-separated Discord IDs that are always super-admin |
| `DEV_LOGIN` | `true` enables fake logins (never in production) |

The Atlas user needs read/write access to the `phoenixquiz` database.

Admins: the super-admin(s) promote other users from **Admin → Users**.

### 3. Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

With `DEV_LOGIN=true` the home page shows a **Dev login** form. Each name creates a fake player, and the first one created is an admin. To test a multiplayer game alone, open several browser profiles or private windows.

```bash
npm test           # unit tests (scoring, game engine, buzzer, profiles)
npm run typecheck
npm run build && npm start
```

### 4. Deploy (Docker)

```bash
docker compose up -d --build
```

The app listens on port **3000** of the host. Whatever serves `https://app.phxlgc.com` in front of it (e.g. a reverse proxy) must:

- forward requests to port 3000,
- pass **WebSocket upgrades** through on `/socket.io/` (the `Upgrade` and `Connection` headers). Without them, players fall back to slower HTTP long-polling,
- send `X-Forwarded-Proto: https`, so sign-in cookies are marked secure. `AUTH_URL` must be the public `https://` URL.

Images are published to `ghcr.io/cfazilleau/phoenixquiz` when a `version/*` tag is pushed (`.github/workflows/docker.yml`).

## Discord results (FriendlyFire `quiz` cog)

When a session has ended, **Post results to Discord** in the control panel inserts a document in `phoenixquiz.bot_events`. The FriendlyFire `quiz` cog watches that collection with a change stream, posts the podium to its configured channel, and writes the outcome back. The control panel shows *Posted ✓* (with a link), *Failed* or *Expired*. The app and the bot never call each other: MongoDB is the only link between them.

```ts
// bot_events document (see src/server/models/BotEvent.ts)
{
  type: 'post_results', sessionId, requestedBy: { discordId, displayName }, createdAt,
  status: 'pending' | 'posted' | 'failed' | 'expired',
  payload: { activityTitle, endedAt, playerCount, top: [{ rank, displayName, avatarUrl, score }] },
  error?, messageUrl?, processedAt?
}
```

## Using it

1. **Admin → Activities**: create an activity, add questions, drag to reorder, then **Save**.
2. **▶ Start**: this creates a session with a 6-character join code and opens the control panel.
3. Open the **presenter screen** (or copy its link into OBS). Players join at `app.phxlgc.com/join` or by scanning the QR code.
4. Run the game: **Start**, then **Reveal**, **Leaderboard** and **Next**. Questions with a time limit close themselves. Others close with **Close answers**.
5. **Buzzer questions**: the first press locks the buzzer. Mark the answer ✓/✗ to award points, then **Reset** or **Reset & lock out** to let others try.
6. At the end: **Export .xlsx** and/or **Post results to Discord**.

### Writing questions live

You don't have to prepare everything in advance:

- **Admin → Sessions → ⚡ New live session** starts a session with no questions. An activity with no questions yet can also be started.
- In the control panel, the **Live question** panel opens the question editor for any type:
  - **▶ Launch now** plays the question immediately (from the lobby, this also starts the game).
  - **Play it next** queues it right after the current question. In the lobby, it's added to the list instead.
- Live questions behave like prepared ones: timer, reveal, scores, buzzer and export.
- **Save as activity** copies every question of the session, prepared or live, into a new activity you can reuse.
