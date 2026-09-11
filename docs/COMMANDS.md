# Command reference

Every command accepts `--format text|json|markdown` and `--output <file>`. Exports refuse to overwrite an existing file. Nothing needs an API key; `.env` values are optional accelerators.

## check `<token|ticker>` (alias: grade)

The certificate: early cohort, retention at every reached checkpoint, concentration, dev behaviour, weight, grade. A ticker fans out to DexScreener (and Blockscout with a key), every candidate is verified against the pons factory, and an ambiguous ticker returns the cluster table instead of guessing.

```bash
gemhog check 0xac79255f6f404eba14f316e8669d76573a2d7b1e
gemhog check PEANUT
gemhog check 0x… --format json --output certificate.json
```

Tokens younger than 5 minutes print `TOO EARLY`. A week-old token replays its whole transfer history and takes up to a minute or two.

## hunt

The flagship, and it lives only in the CLI. Indexes every launch in the window, grades the funded candidates best-funded first inside a time budget, prints the ranked table.

```bash
gemhog hunt --window 6h                 # 1h 3h 6h 12h 24h
gemhog hunt --min-grade VS2 --top 10
gemhog hunt --budget 120                # seconds of grading
gemhog hunt --follow                    # keep digging; see below
```

`--follow` re-digs every two minutes, prints tokens entering the top, appends VS1+ findings to `~/.gemhog/alerts.json` for `serve`, and posts a Telegram alert when `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set. With both empty, nothing is ever posted anywhere.

## watch `<token>`

Re-grades one token every 30 seconds and prints only what changed: grade, score, holder count, dev sells.

## top

The ten best rows of the last hunt from `~/.gemhog/last-hunt.json`; re-digs briefly when the cache is older than 20 minutes. Made for the bot.

## holders `<wallet>`

Every pons token on a public address, graded in turn, with balances and share of supply — the CLI twin of `/holders` on the site. Wallet listing needs Blockscout; on networks where its API answers with a bot challenge, set a free `BLOCKSCOUT_API_KEY`.

## export

The last hunt as CSV (default) or JSON.

```bash
gemhog export --format csv --output stones.csv
```

## serve

The local JSON API for the bot: `GET /check/:token`, `/top`, `/holders/:wallet`, `/alerts?since=`, `/health`. Binds to 127.0.0.1 only. See [BOT.md](BOT.md).

## demo

The offline walkthrough: the recorded fixture graded by the real engine, every line marked `DEMO`, no network.

## doctor

Measured checks of every source: both RPC endpoints, the factory addresses re-read from the live factory, opening-tax parameters, Pons API, Blockscout, DexScreener. `--probe` additionally grades the example token end to end. Exit code 2 when any line fails.
