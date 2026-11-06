# ⌨ Keyboard Runner

A real-time multiplayer typing race. Players join rooms, press **READY**, and race to type the same text. The first to finish wins. If time runs out, the player with the most correctly typed characters wins.

Built for the Binary Studio Academy **HTTP, REST, WebSockets** homework with **Express + Socket.io + TypeScript** on the server and **vanilla JS (ES modules)** in the browser. The **Patterns, Practices and Principles** homework added a live race commentator (see [Commentator](#commentator)).

## Features

- **Login** with a unique username (rejected during the socket handshake if that username is already online). A page reload is recognised as the same player (per-tab `sessionId`), so it doesn't trigger "username taken"
- **Race briefing** on the login page and in the lobby explains the rules in four steps (numbers come from the server config via `GET /game/config`)
- **Rooms**: create a room or join one, with a live users counter. Room names are unique, empty rooms are deleted automatically, and rooms that are full or mid-race are hidden from the list
- **Ready check**: when every player is ready, the server starts a countdown, picks a random text, and sends only its id. The client then loads the text over HTTP (`GET /game/texts/:id`)
- **F1-style start**: the 5 red start lights come on one per second during the last 5 seconds, stay on for a random 0.3–2 s that only the server knows, then go out. Lights out = go, so nobody can jump the start
- **Race**: correctly typed characters are highlighted, the next character is underlined, and every player's progress bar updates live
- **Results**: players who finished are ranked by finish time, then everyone else by typed characters. Players who left are not listed. Each row shows the time (or the gap to the winner), WPM and chars/min
- **Commentator** Таб Шифтович covers every race live in Ukrainian, from the greeting to the podium, in a booth next to the race text. He reacts to what actually happens: overtakes, photo finishes, personal bests, rivalries, win streaks, comebacks
- **Race texts from books**: most races use a random passage from one of six public-domain classics, so there are thousands of different texts
- Every edge case caused by leaving is handled. If the last not-ready player leaves, the countdown starts. If the last player still typing leaves, the race ends

### Extras

- TypeScript server with **typed socket.io events** (`ClientToServerEvents` / `ServerToClientEvents`)
- **Acknowledgements** for create/join/leave, so errors go back to the caller only
- A **lobby channel**, so only users on the rooms page receive rooms-list updates
- "Race track" UI: lanes with cars, start lights, checkered finish line, timing-tower results
- Live **WPM** and **chars/min** while typing, red flash on a wrong key
- "Desktop only" notice on touch devices (the game needs a physical keyboard)
- A small design system (tokens + components) and a live **styleguide** at `/styleguide` with every component
- "Signed in as …" header with a **Change user** button
- Final progress bars stay visible while the results modal is open
- One-click deploy to Render (`render.yaml`)

## Run locally

Requires Node.js 22.

```bash
npm install
npm start          # dev mode with auto-restart (tsx watch)
npm test           # unit tests (node:test)
npm run books:prepare   # re-download and clean the books in data/books (already in the repo)
```

Open http://localhost:3002. To play against yourself, open a second **tab**: `sessionStorage` is per tab, so each tab can log in as a different user.

Production build:

```bash
npm run build      # -> ./dist (dist/server.js, dist/socket/config.js, dist/data.js)
npm run start:prod
```

Game settings live in [`src/socket/config.ts`](src/socket/config.ts), the classic race texts in [`src/data.ts`](src/data.ts) and the books in [`data/books`](data/books) (see [Race texts](#race-texts)).

## How it works

```
src/
├── server.ts                 Express + HTTP server + socket.io, exports { app, httpServer }
├── routes/                   /login, /game, GET /game/texts/:id
├── helpers/validation.ts     username / room name rules
├── commentator/              the race commentator (see below)
├── texts/                    race texts: book passages + the classic texts (see below)
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

public/styles/                  generated from the "Keyboard Runner" design system
├── tokens.css                  colours, fonts, spacing, radii, shadows, sizes (CSS variables)
├── components.css              buttons, grid slots, lanes, start lights, modals... (only tokens, no raw values)
└── layout.css                  page layouts and breakpoints

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
| S → C | `game:finished` | `{ results: [{ place, username, finished, progress, finishTimeMs, wpm, charsPerMinute }] }` |
| S → C | `commentator:comment` | `{ id, type, text, createdAt }` |

HTTP: `GET /game/texts/:id` → `{ id, text }`, `GET /game/config` → `{ maxUsers, countdownSeconds, gameSeconds, commentatorName }`.

State is kept **in memory** in a single Node.js process, so the app is meant to run as one instance.

## Commentator

Таб Шифтович comments on every race, following the rules of the Ukrainian typing-race federation. All the logic runs on the server. The browser only shows what arrives in `commentator:comment`.

| When | What he says |
|---|---|
| Countdown starts | Greeting with the venue and the weather, then one comment per driver on the grid: name, car (colour, brand, number) and record (races, wins, best WPM, win streak, or "debut race") |
| Two drivers on the grid have met before | The rivalry: number of meetings, score, who won last time |
| Today's text is from a book | Title, author and a fact about the book |
| Lights out | Start, time on the clock |
| Every 30 s | Standings: who is where, progress, gap to the leader in characters, time left |
| Someone overtakes | "Зміна лідера!" or "X обходить Y і піднімається на третю позицію". Quiet for the first 5 s, then rate-limited, and the same two drivers swapping places is announced once in 15 s |
| 30 characters before the finish | Who reaches the finish straight. The first one also gets a prediction for second place |
| A driver finishes | Place and time. Less than 1 s after the previous finisher: photo finish. A new personal best or a debut speed is mentioned. The last finisher gets their own line |
| A driver leaves | Pit lane, retired |
| Race over | Top 3 with times (or distance covered if the flag came first), the comeback of the day (2+ places up from the worst position in the race), the winner's streak, a goodbye |
| Silence for 10 s | A joke or a fact about keyboards and racing, never the same one twice in a race |

Event comments are what keeps him from sounding scripted: the words come from templates, but what he talks about is different every race.

No bad words, ever: that's a disqualification. His own phrases are checked by a test, and usernames (the only text from players) go through the censorship proxy before they reach anyone.

### Structure

```
src/commentator/
├── index.ts                  composition root: getCommentator(io) wires the real dependencies
├── commentator.ts            FACADE: raceAnnounced / raceStarted / progressUpdated / driverLeft / raceFinished / roomClosed
├── config.ts                 name, venue, intervals (30 s status, 30 chars, 10 s of silence)
├── types.ts                  comment types, payload of each type, driver profile
├── comments/
│   ├── commentFactory.ts     FACTORY: createComment(type, payload) -> { id, type, text, createdAt }
│   ├── templates.ts          one pure function per comment type
│   └── phrases.ts            jokes, facts, weather, car colours and brands (data only)
├── drivers/
│   ├── carFactory.ts         FACTORY: a car for every new driver
│   └── driverRepository.ts   in-memory profiles (car, races, wins, best WPM, win streak) and head-to-head records
├── censorship/
│   ├── censorshipProxy.ts    PROXY around the broadcaster: masks bad words
│   └── profanity.ts          the filter itself
└── helpers/
    ├── standings.ts          ranking (ties keep the previous order), overtakes, approach / finish lines
    ├── raceMoments.ts        rivalry, overtake rate limits, photo finish, personal best, comeback
    └── …                     Ukrainian plurals and cases, random picks, text pipeline
```

The game talks to the commentator in exactly one line per event, e.g. `getCommentator(io).raceStarted(room)` in `gameFlow.ts`.

### Patterns

- **Facade** (`commentator.ts`): the game sees six methods. Behind them are the comment factory, driver profiles, timers for status reports and jokes, race-moment detection and the broadcaster.
- **Factory** (`commentFactory.ts`, `carFactory.ts`): `createComment('finish', { … })` hides how a comment is built. Type and payload are checked together at compile time (`CommentPayloads`). The car factory gives every new driver a random car.
- **Proxy** (`censorshipProxy.ts`): a real ES `Proxy` with the same interface as the broadcaster. It intercepts `say` and masks bad words before the comment goes out.

### Functional programming

- **Pure functions**: templates, standings, race moments (`findOvertaken`, `findComeback`, `getSpeedNews`, `isFinishMoment`...), `applyResult` / `applyMeeting` (return new records, no mutation), passage cutting
- **Currying / partial application**: `pluralize(['секунда', 'секунди', 'секунд'])` returns `seconds(n)` (lodash `curry`), `joinWith('чи')`, `pickWith(random)(items)`, `partial(say, room)` in the facade
- **Higher-order functions**: `createCommentFactory(deps)` and `createCarFactory(random)` return functions, `memoize(createCommentator)` in `index.ts`, `describeChaser(leader, textLength)` returns the mapper for `map`
- **Composition**: every comment passes through `polish = flow(collapseSpaces, removeSpaceBeforePunctuation, trim)`
- **Injected side effects**: randomness and the clock are parameters, so tests get the same text every time

### Data

Driver profiles and head-to-head records are read from memory (the commentator needs them instantly). With `MONGODB_URI` set they are loaded from MongoDB Atlas once at startup and every change is written back after the race, so they survive Render putting the instance to sleep. Without it they live in memory only, like rooms.

A win needs someone to beat: a solo race adds to `races` and `bestWpm`, but not to `wins` or the win streak (and does not reset the streak either).

### AI lines (optional)

With `AI_COMMENTATOR_ENABLED=true` and `ANTHROPIC_API_KEY`, some comments are written by Claude Haiku 5.5 instead of templates (ADR-001, spec Revision 3). The model gets the same facts as the template; a validator checks every line (driver names, numbers from the data, gender-neutral Ukrainian, length); a rejected line gets one retry with the reasons; a slow, failed or rejected line falls back to the template. Fast moments (overtakes, finishes) are always templates.

- Slots: `AI_COMMENTATOR_SLOTS` (default `prerace,results`; add `status` to test it). Results and status are live; pre-race is the next step.
- Deadlines: results and status 3.5 s. Every slot is logged as one JSON line `{"type":"ai-line", "outcome": "ai" | "fallback:…", …}` with timings, retries, rejected lines and cost.
- `AI_COMMENTATOR_MODEL` overrides the model.

```
src/commentator/ai/
├── config.ts          slots, deadlines, limits, env -> config
├── payloads.ts        template payloads -> model data
├── prompts.ts         system prompt v4, slot tasks
├── validator.ts       checks a line against the data
├── preraceParts.ts    the pre-race block: parts, parsing, AI-or-template plan
├── lineWriter.ts      the model port; anthropicWriter.ts (real), fakeWriter.ts (tests)
├── sayWithin.ts       deadline + validation + one retry
└── aiCommentator.ts   what the facade uses: has(slot), line() -> text or null, ai-line log
```

## Race traces

Every finished race leaves one **trace** per player: the text, `[ms, typedChars]` samples from lights out, the finish time, WPM, players in the race and which attempt on this text it was. Traces are the data the ghost race (and the commentator research) is built on.

- Recorded by the server from the progress updates it already receives; the client did not change.
- Saved to the `raceTraces` collection (with `MONGODB_URI`) after `game:finished` is sent, and written to the log as one JSON line `{"type":"race-trace", …}`. A failed save is logged, never shown to players.

```
src/storage/index.ts          MongoDB connection at startup, in-memory fallback; socket connections wait until it is ready
src/traces/
├── types.ts                  RaceTrace, ProgressSample
├── traceRecorder.ts          one live recording per room: start, sample, finish, drop
├── traceRepository.ts        in-memory and MongoDB versions (attempt number per player and text)
└── index.ts                  the recorder the game uses + keepTraces (save + log)
```

## Race texts

80% of races use a passage from a book, 20% one of the classic texts from `src/data.ts` (the homework requires them there).

- Six public-domain books from [Project Gutenberg](https://www.gutenberg.org): *The Adventures of Sherlock Holmes*, *Three Men in a Boat*, *The Adventures of Tom Sawyer*, *Alice's Adventures in Wonderland*, *Around the World in Eighty Days*, *The Call of the Wild*.
- `scripts/prepare-books.ts` downloads them (from the GITenberg mirror on GitHub), keeps only the book itself (no Gutenberg header and license, no tables of contents or headings), turns `--` into a dash and removes `_italics_` and `[Illustration]` marks. The result is `data/books/<id>.txt`, one paragraph per line, committed to the repo.
- On every race the server takes a random sentence in a random book and adds the following sentences until the passage is 160–260 characters long. A passage is rejected if a sentence has characters you can't type on a plain keyboard, or if it starts or ends in the middle of a quote. That leaves almost 9,000 good passages.
- Every text gets an id (the classic ones keep 0..N-1), and the client still loads it with `GET /game/texts/:id`.

```
src/texts/
├── books.ts                  the book list: Gutenberg id, title, author, Ukrainian title and a fact for the commentator
├── passages.ts               pure: cleaning, sentence splitting, passage cutting, quote balance
├── bookLibrary.ts            reads data/books at startup
├── raceTextService.ts        pick(previousId) / get(id): book passage or classic text
└── index.ts                  the instance the game uses
```

## Checks

Every PR and every push to `main` runs [CI](.github/workflows/ci.yml): lint, format, typecheck, tests, build, and `npm audit` of the production dependencies (fails on high or critical). [CodeQL](.github/workflows/codeql.yml) scans the code for security issues, and [Dependabot](.github/dependabot.yml) opens weekly update PRs.

```bash
npm run lint          # ESLint (typescript-eslint, browser globals for public/)
npm run format        # Prettier: tabs, single quotes, 120 columns
npm run format:check  # what CI runs
npm run typecheck && npm test && npm run build
```

The one-time formatting commit is listed in `.git-blame-ignore-revs`, so `git blame` skips it (GitHub does this automatically).

## Deploy (Render)

1. Push the repo to GitHub.
2. On [render.com](https://render.com), choose **New → Blueprint** and select the repo. `render.yaml` sets up a free web service (`npm ci && npm run build`, then `npm run start:prod`).
3. Render passes `PORT` through env. Locally the app falls back to `3002`.
4. Optional: `MONGODB_URI` (a MongoDB Atlas connection string with the database name in the path) keeps driver profiles and race traces between restarts. Atlas must allow the service's outbound IP ranges (Render: service → Connect → Outbound). Locally, put it in `.env` (ignored by git) or leave it out to keep everything in memory.
5. Optional: `ANTHROPIC_API_KEY` + `AI_COMMENTATOR_ENABLED=true` turn on the AI lines (see "AI lines"). Without them the commentator is all templates.

The free instance sleeps after about 15 minutes without traffic, so the first request after that takes up to a minute.
