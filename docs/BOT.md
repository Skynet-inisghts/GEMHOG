# The Telegram bot

The bot is a thin shell over `gemhog serve`: it implements zero grading logic and never talks to the chain. Every answer a user sees was computed by the same engine that powers the CLI and the site.

```
telegram <-> bot (python, aiogram)  <->  gemhog serve (127.0.0.1:4664)  <->  the engine
```

## Commands

| Command | What happens |
| --- | --- |
| `/check 0x…` | `GET /check/:token` on serve; the certificate as a `<pre>` block, grade bold, links to Blockscout and the site terminal. A bare pasted address does the same. |
| `/top` | `GET /top`: the ten best rows of the last hunt. This is the owner's bot, so the list is allowed here — the public API still returns only counters. |
| `/watch 0x…` | Re-grades every 15 minutes through serve and messages on any change of grade, score or dev behaviour. `/unwatch` stops all. |
| `/alerts on\|off` | VS1-or-better findings from `gemhog hunt --follow`, polled from `GET /alerts?since=`. Needs a follow running next to serve. |

English, no emoji — with one exception fixed by the spec: a single diamond before VVS2 and better.

## Running it

Two processes, one machine:

```bash
# terminal 1: the engine's local API (127.0.0.1 only, by design)
pnpm build:cli && node bin/gemhog.mjs serve

# terminal 2 (optional, feeds /top and /alerts):
node bin/gemhog.mjs hunt --window 6h --follow

# terminal 3: the bot
cd bot
pip install -r requirements.txt
TELEGRAM_BOT_TOKEN=123:abc python main.py
```

Or with Docker: `TELEGRAM_BOT_TOKEN=123:abc docker compose up`.

Environment:

| Variable | Meaning |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | required; the bot refuses to start without it |
| `GEMHOG_SERVE_URL` | serve base URL, default `http://127.0.0.1:4664` |
| `GEMHOG_SITE_URL` | when set, certificates link to `/terminal?token=` on the site |
| `GEMHOG_BOT_DB` | SQLite path, default `bot/state.db` |

## State

One SQLite file with three tables: watches (chat, token, last seen grade), alert subscriptions (chat, since), and sent alerts (so a restart never re-sends). Delete the file to reset everything.

## Tests

```bash
cd bot && pip install -r requirements-dev.txt && pytest
```

Formatting tests are pure; the API client is tested against a mocked serve — a real local HTTP server with canned answers. Nothing in the test suite touches Telegram or the chain.
