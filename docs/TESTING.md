# Testing

```bash
pnpm check        # typecheck + lint + tests + site build; the commit gate
pnpm test         # engine and CLI tests only
cd bot && pytest  # bot tests (pip install -r requirements-dev.txt once)
```

## What is tested, and how

**The grade math is tested on fixtures with hand-derived expectations.** The three fixtures in `test/fixtures/` — a VVS1 keeper, an SI2 dumper, an I2 rug with a declared bundle — were built by computing every expected component score from the formulas in [METHODOLOGY.md](METHODOLOGY.md) *before* the code ran. If a formula changes, the spec changes first, then the fixture expectation, then the code.

- `grade.test.mjs` — components and the final grade on all three fixtures; the boundary cases: a token under 5 minutes, retention exactly at the 0.5 half-life edge, a dev who never bought, grade band edges.
- `cohort.test.mjs` — exclusions (deployer, declared bundle), the human-cohort tax split, quiet-launch window widening, one wallet buying twice.
- `hunt.test.mjs` — candidate ranking, the grade order, the table and CSV renderers on the spec's own sample shape.
- `receipt.test.mjs` — holder tables and the EXAMPLE-marked receipt.
- `cli.test.mjs` — the demo walkthrough (every line marked DEMO), formats, exclusive exports that refuse to overwrite.
- `serve.test.mjs` — the serve contract's offline surface: liveness, validation, empty states, 405s.
- `bot/tests/` — message formatting (pure) and the API client against a mocked serve: a real local HTTP server with canned answers.

## What is deliberately not in CI

Anything that talks to a live provider: `doctor`, `check` against real tokens, holder listings. Those are exercised by hand at every milestone gate — the workflow in the spec compares certificates against Blockscout token pages — and by the pulse workflow, which effectively runs a bounded hunt from GitHub Actions every 20 minutes. CI failing because a public RPC had a bad minute teaches nothing; CI passing while the math is wrong would be worse. The split keeps each side honest.

## Live verification checklist (per milestone)

1. `pnpm gemhog doctor` — all reachable sources green, addresses match the live factory.
2. `pnpm gemhog check` on a graduated token, a curve token and a dead one; compare holder counts and dev sells against Blockscout by eye.
3. `pnpm gemhog hunt --window 6h` — completes inside 90 seconds on the public RPC without a 429 crash.
4. `curl localhost:3000/api/grade` (site running) — byte-identical JSON to the CLI for the same token.
