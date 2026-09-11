# Changelog

## 0.7.0 — 2026-09-12

- Share cards: a 1080x1080 PNG per certificate, three moods by score band (1-35 red with a lump of coal, 36-70 yellow with a dull pebble, 71-100 green with the diamond), rendered by `lib/gemhog/card.ts` — a one-to-one port of the reference renderer in `assets/cards/render_cards.py`, on @napi-rs/canvas with the shipped pig sprites.
- `GET /api/card?token=0x…` with a 60-second cache; token logos come from the contract's own `getTokenInfo` through the pons gateway, with a grey initial circle as the fallback. Tokens under 5 minutes answer 425: no grade, no card.
- The terminal shows the live card under every certificate; **Share as image** now downloads the card (`gemhog-TICKER-score.png`) and **Copy link** copies `/terminal?token=…`.
- A shared `/terminal?token=…` link unfurls into the token's card on X and Telegram (`og:image` + `twitter:card = summary_large_image`).
- `gemhog check --card out.png` writes the same card locally; exclusive, like every export. `gemhog serve` grew `GET /card/:token` and the bot answers `/check` with the card as a photo, certificate text following.
- The demo card carries a DEMO plate across the pig.

## 0.6.0 — 2026-09-11

- `demo` now runs the real engine over a recorded fixture — the same synthetic VVS1 launch the test suite grades — so the walkthrough and a live certificate can never drift apart. Every line still says DEMO.
- `doctor --probe`: after the source checks, a full end-to-end grade of the example token.
- `/docs` on the site renders the repository docs — methodology, commands, architecture, testing, the bot — in the terminal skin.
- The launch kit (`docs/LAUNCH.md`): the one-file CA swap in `lib/gemhog/project-token.ts`, what activates where, what never changes at launch.
- `SECURITY.md` (the no-signing boundary and how to report), `CONTRIBUTING.md` (the four ground rules), `docs/ARCHITECTURE.md`, `docs/COMMANDS.md`, `docs/TESTING.md`.
- README completed: the how-it-works flowchart, the project map, the bot section, a tests badge with the real count.

## 0.5.0 — 2026-09-11

- `gemhog serve`: the engine as a local JSON API for the bot — `/check/:token`, `/top`, `/holders/:wallet`, `/alerts?since=`, `/health` — bound to 127.0.0.1 only, by design.
- The Telegram bot (`bot/`, Python 3.11, aiogram 3): `/check` (a bare pasted address works too), `/top` (the list is allowed here — this is the owner's bot; the public API still returns counters only), `/watch` with 15-minute re-grades and change messages, `/alerts on|off` fed by `hunt --follow`. English, no emoji, except one diamond before VVS2 and better. Not one line of grading logic.
- `hunt --follow` now appends VS1+ findings to `~/.gemhog/alerts.json`, which serve exposes for the bot; Telegram delivery stays env-gated as before.
- SQLite bot state (watches, subscriptions, sent alerts) that survives restarts without double-sending.
- `docker-compose.yml` with the serve + bot pair; `docs/BOT.md` with the full contract.
- Tests: pytest for formatting and for the API client against a mocked serve; `test/serve.test.mjs` for the serve contract's offline surface; a python job in CI.

## 0.4.0 — 2026-09-11

- `gemhog hunt`: the flagship. Indexes every launch in the window (6,000+ over 6h), enriches each with three multicall reads, and grades funded candidates best-funded first inside a time budget — 76s for a full 6h window on the public RPC, no 429 crashes.
- `hunt --follow`: re-digs every two minutes, prints tokens entering the top, and alerts VS1+ over Telegram when a token and chat id are configured; with both empty nothing is ever posted.
- `gemhog watch <token>`: one token re-graded every 30 seconds, printing only what changed.
- `gemhog top` and `gemhog export`: the cached last hunt as a ten-row table or CSV/JSON, state in `~/.gemhog/`, never in the repository.
- `GET /api/top` and `GET /api/pulse`: counters and the grade distribution only — the ranked list stays in the CLI by design. `pulse.yml` refreshes `assets/pulse.json` every 20 minutes and commits only on change.
- The landing pulse block now shows real numbers from the latest snapshot.
- `terminal-desk.svg`: the retention-desk study rendered from the real formulas.

## 0.3.0 — 2026-09-11

- Holder Check: `/holders` with connect-or-paste entry. Connecting asks an injected wallet for `eth_requestAccounts` and nothing else; a pasted public address works without any wallet.
- `gemhog holders <wallet>`: the same view in the CLI — every pons token on the address, graded in turn, with balances and share of supply.
- `POST /api/holder`: wallet listing (Blockscout-sourced, factory-verified) split from grading, so the page fills grades in progressively through `POST /api/grade`.
- The $GEMHOG holder receipt slot with a visibly labelled synthetic example; the live receipt activates when the official contract is published.
- `/terminal?token=0x…` deep links straight into a check; holder rows link to it.
- Honest degradation: a Blockscout bot challenge is reported with the exact fix (a free `BLOCKSCOUT_API_KEY`), never shown as an empty wallet.

## 0.2.0 — 2026-09-11

- The grade engine: early cohort with the opening-tax human filter and declared-bundle exclusion, Transfer-replayed balances at six checkpoints, half-life, and the four components cut/clarity/color/carat exactly as specified in `docs/METHODOLOGY.md`.
- `gemhog check <token|ticker>` (alias `grade`): the live certificate against the chain, ticker resolution through DexScreener and optional Blockscout search with every candidate verified against the pons factory, and a cluster table when one ticker has several launches.
- Adaptive log chunking: 1M-block strides on quiet ranges, 500-block bites through launch-hour hot zones, refused chunks reported as `partial` instead of silently dropped.
- Holder snapshots via the Pons Portal holders endpoint with a Transfer-replay fallback; infrastructure (curve, pool manager, locker, escrow, burn) never counts as a holder.
- `/terminal`: certificate view with the grade in its clarity color, cluster picker, offline demo marked DEMO, share-as-image PNG and full provenance. `POST /api/grade` with a 60-second cache.
- Engine fixtures with hand-derived expected grades (VVS1 87, SI2 47, I2 23) and boundary tests: too-early tokens, quiet-launch window widening, the 0.5 half-life edge, burns not counted as dev exits.
- README: the captured live certificate replaces the synthetic one up top; live-grading and API sections.

## 0.1.0 — 2026-09-11

- Chain layer for Robinhood Chain 4663: chain definition, verified pons v2 addresses, multicall3, and an RPC gate with bounded concurrency and 429 backoff (adapted from bodkin, MIT).
- `gemhog doctor`: measured checks of both public RPC endpoints, the pons factory addresses re-read from the live factory, opening-tax parameters, Pons API, Blockscout and DexScreener.
- `gemhog demo`: synthetic certificate walkthrough with every line marked DEMO; JSON and Markdown formats; exports that refuse to overwrite existing files.
- Landing page in the GEMHOG palette with the grade scale, the three surfaces and the safety boundaries; `/terminal` and `/holders` as labelled placeholders until 0.2 and 0.3.
- `GET /api/health` running the same doctor checks as the CLI.
- CI on Node 22 and 24 plus a `no-signer` job that fails the build if a signing primitive appears in `lib/`, `app/` or `bin/`.
- `scripts/render-readme.mjs`: README terminal views rendered from real command output — a live doctor capture and the marked DEMO certificate and JSON export — each with a JSON capture beside it.
