# ABCDEF — Battle Card Game

A real-time online 2-player battle card game for the ABCDEF universe. React + Vite client, Node/Express + Socket.IO server, phone-optimized UI.

- Rules: `docs/GAME_RULES.md` · Card schema: `docs/CARD_SCHEMA.md` · Card data: `data/cards.json`
- Full-resolution card art: `assets/cards/` · Web-optimized versions used by the app: `assets/*/web/`

## Requirements

[Node.js](https://nodejs.org) 20+ (which includes `npm`).

## Quick start (development)

```bash
npm install
npm run dev
```

This starts the game server on **http://localhost:3001** and the hot-reloading client on **http://localhost:5173**. Open the client URL in two browser windows to play locally.

## Playing on your phone (same Wi-Fi)

The dev server already listens on your local network (`host: true`), so:

1. Make sure your phone and computer are on the **same Wi-Fi network**.
2. Run `npm run dev`. Vite prints a **Network** URL, e.g. `http://192.168.1.23:5173`.
3. Open that URL in Safari on your phone.
4. Optional, for an app-like feel: tap the **Share** button → **Add to Home Screen**. It launches fullscreen with the card-back icon.

Two phones on the same Wi-Fi can play against each other this way — one creates a game, the other joins with the 4-letter room code.

> If the page won't load, your computer's firewall is probably blocking ports 5173/3001 — allow Node.js through, or check that the Wi-Fi network doesn't isolate devices (some guest networks do).

## Production (single process)

```bash
npm run build   # builds the client into client/dist
npm start       # serves the whole game on http://localhost:3001
```

The Express server serves the built client, card assets, API, and WebSockets from one port — which is exactly what cloud hosts want.

## Deploying online (play from anywhere)

The repo includes a `render.yaml` blueprint for [Render](https://render.com)'s free tier (free Node hosting with WebSocket support):

1. Sign up at **render.com** — choose "Sign in with GitHub."
2. Click **New → Blueprint**, and select the **ABCDEF** repository (grant Render access to it when prompted).
3. Pick the branch containing the game (`render.yaml` currently points at `claude/abcdef-card-game-kay002` — update the `branch:` line if the game moves to `main`).
4. Click **Apply**. Render builds and deploys automatically (~2-3 minutes).
5. You get a public URL like `https://abcdef-card-game.onrender.com` — send it to a friend, both open it on your phones, one creates a game, the other joins with the room code. Works from anywhere, no shared Wi-Fi needed.

Every push to the deployed branch auto-redeploys.

> **Free-tier note:** Render spins the server down after ~15 minutes idle. The first visit after that takes ~30-60 seconds to wake up — just wait, it's not broken. Also, an active game lives in server memory, so a spin-down between sessions clears old rooms (fine for casual play).

Any other Node host with WebSocket support (Railway, Fly.io, a VPS) also works: build with `npm install --include=dev && npm run build`, start with `npm start`, port comes from the `PORT` env var.

## Project layout

```
assets/        Card art + wallpapers (originals and /web optimized variants)
data/          cards.json — the card database
docs/          Game rules and schema docs
server/        Express + Socket.IO game server (rooms, turns, dice, damage)
client/        React + Vite front end (splash, lobby, card select, battle)
```
