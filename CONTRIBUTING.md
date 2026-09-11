# Contributing

## Ground rules

1. **No signing, ever.** The `no-signer` CI job is not a suggestion. A PR that adds a write path, however useful, will be closed.
2. **The formula lives in the spec.** If a grade component feels wrong, change `docs/METHODOLOGY.md` first, then the fixtures' hand-derived expectations, then the code. PRs that silently change math to make a test pass will be closed.
3. **Honest degradation.** A refused RPC chunk is `partial`, an unreachable source names the fix, demo data says DEMO on every line. Nothing is ever rounded down to a comfortable answer.
4. **Expensive reads only for a short list.** Anything that reads transfers, holders or funding must be bounded by a candidate list or a time budget, never mapped over a whole window.

## Working on it

```bash
pnpm install --frozen-lockfile
pnpm demo          # offline walkthrough, no network
pnpm gemhog doctor # live source checks
pnpm dev           # site on localhost:3000
pnpm check         # the gate: typecheck + lint + tests + build
```

Engine code is TypeScript ESM in `lib/gemhog/` with NodeNext `.js` import specifiers (the compiled CLI runs on plain Node). Pure math goes in `grade/`, network reads in `read/`. Comments explain why, not what. Commits are short and lowercase: `grade: weigh the 24h checkpoint double`.

`pnpm check` must be green and `pnpm gemhog doctor` should be green on every reachable source before a PR.

## Tests

See [docs/TESTING.md](docs/TESTING.md). New grade behaviour needs a fixture with hand-derived expected numbers; new read behaviour needs its failure path exercised, not only its happy path.
