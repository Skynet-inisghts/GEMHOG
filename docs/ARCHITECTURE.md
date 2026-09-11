# Architecture

One engine, three doors. The grading engine lives in `lib/gemhog/` and is the only place the formulas exist; the CLI, the site's API routes and (through `serve`) the Telegram bot all import the same code. If two surfaces ever disagree about a grade, that is a bug by construction, not a judgement call.

```
                       lib/gemhog  (TypeScript, ESM, one runtime dep: viem)
                      ┌──────────────────────────────────────────────┐
   chain reads        │  read/    launches · logs · holders · wallet │
   (rpc gate, chunked)│  grade/   cohort · checkpoints · components  │   pure math,
                      │  resolve · certificate · card · hunt · serve │   fixture-tested
                      └──────┬──────────────┬──────────────┬─────────┘
                             │              │              │
                   bin/gemhog.mjs      app/api/*      gemhog serve (127.0.0.1)
                     the CLI          Next.js site      └─ bot/ (aiogram)
```

## Layers

- **`lib/gemhog/rpc.ts`** — every JSON-RPC request goes through one gate: a list of public endpoints with capabilities (publicnode for state, the official Robinhood endpoint for logs), bounded concurrency, minimum spacing, a process-wide cooldown after a 429, and a penalty box per endpoint.
- **`lib/gemhog/read/`** — everything that touches the network. Log reads are chunked adaptively (AIMD): 1M-block strides through quiet ranges, 500-block bites through launch-hour hot zones, and a chunk the RPC refuses even at minimum size is reported as `partial`, never silently treated as empty.
- **`lib/gemhog/grade/`** — pure functions, no network anywhere. `GradeSource` in, certificate out; the fixtures in `test/fixtures/` exercise exactly this boundary.
- **`lib/gemhog/card.ts`** — the share-card renderer (@napi-rs/canvas), a one-to-one port of the reference in `assets/cards/render_cards.py`; served by `GET /api/card` on the site and `GET /card/:token` on serve.
- **`bin/gemhog.mjs`** — a thin commander shell over the compiled engine (`pnpm build:cli` → `.gemhog-build/`).
- **`app/`** — Next.js App Router. The API routes import the engine directly; the pages are the browser skin. The site builds with webpack (`next build --webpack`): the engine uses NodeNext `.js` specifiers so the compiled CLI runs on plain Node, and webpack's `extensionAlias` maps them back to the TypeScript sources, which Turbopack currently will not.
- **`bot/`** — Python, aiogram 3. Zero grading logic; it formats answers from `gemhog serve` and keeps its subscriptions in SQLite.

## The expensive-read rule

Costly reads (transfers, holders, funding) run only for a short list, never across a whole window. `hunt` indexes thousands of launches with one event filter and three multicall reads each, then spends a wall-clock budget grading candidates best-funded first. `check` reads one token's history capped at the 7-day checkpoint.

## Data sources

| Source | Used for | Failure mode |
| --- | --- | --- |
| Robinhood RPC (logs) | `TokenLaunched`, `CurveBuy/Sell`, `Transfer`, escrow events | adaptive chunking; `partial` when refused |
| publicnode RPC (state) | multicall3 reads, blocks, transactions | gate retries, endpoint penalty box |
| Pons Portal API | holder pages, cluster holder counts | falls back to Transfer replay |
| Blockscout API | wallet token lists, ticker search (with key) | typed error with the exact fix |
| DexScreener | ticker search for graduated tokens | resolve degrades to CA-only |

## Hosting

The site deploys to Vercel as a standard Next.js project (`pnpm build`; env: `RPC_URL` and `BLOCKSCOUT_API_KEY`, both optional). It would run equally well on Cloudflare or any Node host — nothing in the repository is Vercel-specific beyond the defaults, the same way hop-out hosts theirs elsewhere.

The pulse workflow (`.github/workflows/pulse.yml`) refreshes `assets/pulse.json` every 20 minutes from GitHub Actions and commits only on change, so the landing counter stays honest without a server.
