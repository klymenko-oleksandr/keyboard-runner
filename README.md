# ⌨ Keyboard Runner

A real-time multiplayer typing race. Players join rooms, press **READY**, and race to type the same text. The first to finish wins. If time runs out, the player with the most correctly typed characters wins.

Built for the Binary Studio Academy **HTTP, REST, WebSockets** homework with **Express + Socket.io + TypeScript** on the server and **vanilla JS (ES modules)** in the browser.

## Features

- **Login** with a unique username (rejected during the socket handshake if that username is already online)
- **Rooms**: create a room or join one, with a live users counter. Room names are unique, empty rooms are deleted automatically, and rooms that are full or mid-race are hidden from the list
- **Ready check**: when every player is ready, the server starts a countdown, picks a random text, and sends only its id. The client then loads the text over HTTP (`GET /game/texts/:id`)
- **Race**: correctly typed characters are highlighted, the next character is underlined, and every player's progress bar updates live
- **Results**: players who finished are ranked by finish time, then everyone else by typed characters. Players who left are not listed
- Every edge case caused by leaving is handled. If the last not-ready player leaves, the countdown starts. If the last player still typing leaves, the race ends

### Extras

- TypeScript server with **typed socket.io events** (`ClientToServerEvents` / `ServerToClientEvents`)
- **Acknowledgements** for create/join/leave, so errors go back to the caller only
- A **lobby channel**, so only users on the rooms page receive rooms-list updates
- Live **chars/min** speed, red flash on a wrong key, results show finish time or progress, 🏆 for the winner
- "Signed in as …" header with a **Change user** button
- Final progress bars stay visible while the results modal is open
- One-click deploy to Render (`render.yaml`)

## Run locally

Requires Node.js 22.

```bash
npm install
npm start          # dev mode with auto-restart (tsx watch)
```

Open http://localhost:3002. To play against yourself, open a second **tab**: `sessionStorage` is per tab, so each tab can log in as a different user.

Production build:

```bash
npm run build      # -> ./dist (dist/server.js, dist/socket/config.js, dist/data.js)
npm run start:prod
```

Game settings live in [`src/socket/config.ts`](src/socket/config.ts) and the race texts in [`src/data.ts`](src/data.ts).

## How it works

```
src/
├── server.ts                 Express + HTTP server + socket.io, exports { app, httpServer }
├── routes/                   /login, /game, GET /game/texts/:id
├── helpers/validation.ts     username / room name rules
└── socket/
    ├── index.ts              wiring: middleware, handlers, disconnect
    ├── events.ts             event names (mirrored in public/javascript/constants/events.mjs)
    ├── types.ts              domain types, DTOs, typed socket.io events
    ├── middleware/           handshake: reject invalid or duplicate usernames
    ├── handlers/             what each client event does (rooms, ready, progress)
    ├── game/gameFlow.ts      room state machine + broadcasts
    ├── game/roomMembership.ts join / leave (shared by "Back to rooms" and disconnect)
    ├── helpers/              pure functions over a room (results, progress, visibility)
    └── services/             in-memory stores: online users, rooms

public/javascript/
├── game.mjs                  entry: socket connection, page switching
├── pages/                    rooms list page, room + race page
├── game/typingRace.mjs       key handling and text highlighting (knows nothing about sockets)
├── views/                    DOM rendering: rooms, users, modals
└── helpers/                  DOM utils, countdown, HTTP API
```

### Room lifecycle

```
waiting ──(all ready)──▶ countdown ──(SECONDS_TIMER_BEFORE_START_GAME)──▶ playing ──(all finished | SECONDS_FOR_GAME)──▶ waiting
```

The server owns every timer. Clients get one event per transition with the number of seconds and draw the countdown locally, so the server never sends an event every second.

### Events

| Direction | Event | Payload |
|---|---|---|
| C → S | `room:create` | `name`, ack → `{ ok, data: room }` / `{ ok: false, error }` |
| C → S | `room:join` | `name`, ack |
| C → S | `room:leave` | ack |
| C → S | `player:set-ready` | `boolean` |
| C → S | `game:update-progress` | number of correctly typed chars |
| S → C | `rooms:updated` | `[{ name, numberOfUsers }]` (lobby only) |
| S → C | `room:users-updated` | `[{ username, ready, progress, finished }]` |
| S → C | `game:countdown-started` | `{ textId, seconds }` |
| S → C | `game:started` | `{ seconds }` |
| S → C | `game:progress-updated` | `{ username, progress, finished }` |
| S → C | `game:finished` | `{ results: [{ place, username, finished, progress, finishTimeMs }] }` |

State is kept **in memory** in a single Node.js process, so the app is meant to run as one instance.

## Deploy (Render)

1. Push the repo to GitHub.
2. On [render.com](https://render.com), choose **New → Blueprint** and select the repo. `render.yaml` sets up a free web service (`npm ci && npm run build`, then `npm run start:prod`).
3. Render passes `PORT` through env. Locally the app falls back to `3002`.

The free instance sleeps after about 15 minutes without traffic, so the first request after that takes up to a minute.
