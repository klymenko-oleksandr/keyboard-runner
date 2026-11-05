# AI commentator: research kit

Raw material and scripts for the AI commentator decision (see the spec doc). Not part of the app build.

## What is here

- `races/*.jsonl`: 7 bot races recorded against the local server on 2026-11-03 (every server event the room saw, `t` in ms).
- `transcript.md`: everything Таб Шифтович said in those races, with timestamps from lights out.
- `summary.json`: per race: length, comments, bursts, lead changes vs announced overtakes.
- `recorder.mjs`: runs a bot race (`pack`, `spread`, `duel`, `slow`, `solo`) and writes JSONL.
- `analyze.mjs`: builds `summary.json` and `transcript.md`.
- `validity.mjs`: how long each overtake claim stays true (the latency budget for an LLM line).
- `moments.mjs`: builds the 61 benchmark moments (snapshot at the instant the template spoke) from `races/`.
- `validator.mjs` (+ `validator.test.mjs`): checks one LLM line before broadcast: past tense and gendered forms, exact nicknames, Latin words, numbers, length. Port target: `src/commentator/ai/validator.ts`.
- `llm-bench.mjs`: replays every moment through the model with the v2 prompt, validates each line, retries once if rejected and there is time before the 3.5 s deadline; reports what players would see (`ai` / `fallback:invalid` / `fallback:timeout`), latency, cost, overtake still true on delivery. Writes `bench-<model>-<prompt>.json` and a blind A/B sheet `ab-<model>-<prompt>.md`.
- `races-v3/*.jsonl`: 7 more bot races recorded with the template payload in every comment (the facts of the event). Used by prompt v3.
- `judge.mjs`: LLM judge (Sonnet 5.5 by default) of every shown AI line AND the template line for the same moment: factual, about the event, coherent, gender-neutral, Ukrainian. The template score is the judge's own false-alarm rate. Writes `judge-<tag>.json` and a sheet `judge-<tag>.md` for a human spot check.
- `slots.mjs` + `slots-bench.mjs`: the slow slots ADR-001 gives to the LLM (pre-race block, 30 s status, filler, results recap) from `races-v3/`, each run `REPEAT` times (default 2), validated, one retry, deadline per slot. Writes `bench-slots-<model>.json`; `judge.mjs` reads it too (plus a world-fact check for fillers).
- `slots-bench-v4.mjs`: control run for spec Revision 3 (step 0): prompt v4, renamed payloads (`racesBefore`, `bestWpm: null`, `debut`, `personalBest`), the pre-race block as keyed parts (`greeting:` / `driver:<username>:` / `rivalry:` / `track:`) streamed line by line with a template for every part that is late, invalid or missing; status and results with one retry. Writes `bench-slots-<TAG>-<model>.json` (TAG default `v4b`: driver lines must name the driver, `raceNumber`, clarified status task; the first control run was `v4`).
- `revalidate.mjs`: runs the current validator over saved first-generation results (`bench-<model>.json`) without API calls.

## Run

```bash
cd research/ai-commentator && npm install
# record (server must be running: npm start in the repo root)
node recorder.mjs pack races/pack-3.jsonl
node analyze.mjs && node validity.mjs
# LLM benchmark (needs a key from console.anthropic.com with a spend limit)
node --test validator.test.mjs
node revalidate.mjs
# key in .env (ANTHROPIC_API_KEY=...), .env is gitignored
node --env-file=.env llm-bench.mjs --dry
node --env-file=.env llm-bench.mjs                      # Haiku 5.5, prompt v2, retry on
PROMPT=v1 RETRY=0 node --env-file=.env llm-bench.mjs    # baseline
RACES=races-v3 node --env-file=.env llm-bench.mjs       # prompt v3: with event facts
RACES=races-v3 node --env-file=.env judge.mjs bench-claude-haiku-5-5-v3.json
node --env-file=.env slots-bench.mjs                    # slow slots
node --env-file=.env judge.mjs bench-slots-claude-haiku-5-5.json
node --env-file=.env slots-bench-v4.mjs                 # control run (Revision 3, step 0)
node --env-file=.env judge.mjs bench-slots-v4b-claude-haiku-5-5.json
```

61 calls on Haiku 5.5 cost well under one cent.
