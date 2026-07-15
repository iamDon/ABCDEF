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

Any Node host with WebSocket support works (Render, Railway, Fly.io, a VPS). The app is a standard single-port Node server:

- **Build command:** `npm install && npm run build`
- **Start command:** `npm start`
- **Port:** set by the `PORT` env var automatically (defaults to 3001)

Once deployed, both players just open the public URL on their phones — no same-Wi-Fi requirement.

## Project layout

```
assets/        Card art + wallpapers (originals and /web optimized variants)
data/          cards.json — the card database
docs/          Game rules and schema docs
server/        Express + Socket.IO game server (rooms, turns, dice, damage)
client/        React + Vite front end (splash, lobby, card select, battle)
```
