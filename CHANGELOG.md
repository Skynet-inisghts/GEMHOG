# Changelog

## 0.1.0 — 2026-09-11

- Chain layer for Robinhood Chain 4663: chain definition, verified pons v2 addresses, multicall3, and an RPC gate with bounded concurrency and 429 backoff (adapted from bodkin, MIT).
- `gemhog doctor`: measured checks of both public RPC endpoints, the pons factory addresses re-read from the live factory, opening-tax parameters, Pons API, Blockscout and DexScreener.
- `gemhog demo`: synthetic certificate walkthrough with every line marked DEMO; JSON and Markdown formats; exports that refuse to overwrite existing files.
- Landing page in the GEMHOG palette with the grade scale, the three surfaces and the safety boundaries; `/terminal` and `/holders` as labelled placeholders until 0.2 and 0.3.
- `GET /api/health` running the same doctor checks as the CLI.
- CI on Node 22 and 24 plus a `no-signer` job that fails the build if a signing primitive appears in `lib/`, `app/` or `bin/`.
- `scripts/render-readme.mjs`: README terminal views rendered from real command output — a live doctor capture and the marked DEMO certificate and JSON export — each with a JSON capture beside it.
