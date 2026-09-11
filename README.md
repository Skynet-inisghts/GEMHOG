<p align="center"><img src="assets/avatar-sniffer.png" width="128" alt="GEMHOG pixel pig" /></p>
<p align="center"><img src="assets/banner.png" width="100%" alt="GEMHOG — digs through 25 000 launches a day. keeps the stones." /></p>

<p align="center">
  <a href="https://github.com/Skynet-inisghts/GEMHOG/actions/workflows/ci.yml"><img src="https://github.com/Skynet-inisghts/GEMHOG/actions/workflows/ci.yml/badge.svg" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/Node-20%2B-FF7AC4?style=flat-square&amp;labelColor=0a0a0a" alt="Node 20 or newer" />
  <img src="https://img.shields.io/badge/Robinhood_Chain-4663-FF7AC4?style=flat-square&amp;labelColor=0a0a0a" alt="Robinhood Chain 4663" />
  <img src="https://img.shields.io/badge/signing-none-FF7AC4?style=flat-square&amp;labelColor=0a0a0a" alt="No signing" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-FF7AC4?style=flat-square&amp;labelColor=0a0a0a" alt="MIT license" /></a>
</p>

<p align="center"><strong>Grade the hands before the bag.</strong><br/>A browser and local CLI for grading holder retention of Pons V2 tokens on Robinhood Chain.</p>
<p align="center"><a href="#start-in-one-minute">Start locally</a> · <a href="#available-in-the-current-source">What works today</a> · <a href="CHANGELOG.md">Changelog</a></p>

## Why GEMHOG

A wallet shows you a price. It does not show you whether anyone intends to stay. 25,000 tokens launch on Pons every day, and the word "community" in a token description means nothing; the only community that can be measured is the buyers of the first minute, and the only question that matters is whether they are still holding.

GEMHOG takes a token, finds those first-minute buyers, and checks who is still in position at 5m, 15m, 1h, 6h, 24h and 7d. Retention, concentration, dev behaviour and weight fold into a score out of 100 and a grade on the diamond clarity scale, FL down to I3. The pig is the meme; the certificate is the product.

### Read the hands, not the post

![GEMHOG live certificate: a captured check of the supported example token, with the four components, retention by checkpoint and provenance](assets/readme/certificate-snapshot.svg)

A styled documentation view of an actual `check` result against the live chain. The capture time is printed inside the image; it is a historical grade, not a current one. [Full captured data →](assets/readme/certificate-snapshot.json)

## Available in the current source

| Surface | What works |
| --- | --- |
| Grade engine | Early cohort, six retention checkpoints, cut/clarity/color/carat, the full clarity scale |
| Local CLI | `check <token\|ticker>` live grading with cluster disambiguation; `doctor`; `demo` |
| Browser terminal | `/terminal`: ticker or CA in, certificate out, offline demo, share as image |
| API | `POST /api/grade` (same JSON as the CLI), `GET /api/health` |
| Holder Check | `/holders` and `gemhog holders`: every pons token in a public wallet, graded |
| Offline walkthrough | Synthetic certificate, labelled DEMO on every line, no provider requests |
| Exports | JSON and Markdown for every command; exports refuse to overwrite existing files |
| Verification | Engine fixtures with hand-derived expected grades, CLI tests, Node 22/24 CI, `no-signer` job |

Official `$GEMHOG` contract: TBA. The address will be published here, on the site and in `lib/gemhog/project-token.ts` at launch; until then any address claiming to be $GEMHOG is not ours.

### Holder Check

Open `/holders` to request an account from an injected EVM wallet. The browser asks the wallet for exactly one thing, `eth_requestAccounts` — the public address. There is no signature, approval, network switch or transaction request, and the `no-signer` CI job greps the source on every commit to keep it that way. A pasted public address works identically, with no wallet at all.

The page lists every pons token the address holds with its balance and share of supply; the largest holdings grade automatically and the rest grade on demand, since each certificate replays that token's transfer history. **View example receipt** shows a visibly labelled synthetic walkthrough of the $GEMHOG holder receipt that activates at launch.

```bash
pnpm gemhog holders <PUBLIC_WALLET>
```

Wallet listings come from the Blockscout API. On networks where Blockscout fronts its API with a bot challenge, set a free `BLOCKSCOUT_API_KEY` from dev.blockscout.com in `.env`; grading itself never needs it.

## Start in one minute

Install Node.js 20+ and pnpm, then:

```bash
git clone https://github.com/Skynet-inisghts/GEMHOG.git
cd GEMHOG
pnpm install --frozen-lockfile
pnpm demo
```

`demo` compiles the CLI and prints a reproducible, synthetic certificate. Every line of it is marked `DEMO`; it does not fetch live data.

### Check the sources

![GEMHOG doctor: captured checks of both public RPC endpoints, the pons factory addresses, opening-tax parameters, Pons API, Blockscout and DexScreener, with measured latency](assets/readme/doctor.svg)

The doctor talks to both public RPC endpoints, re-reads the pons factory addresses from the live factory, and probes the Pons API, Blockscout and DexScreener. These are measured results from the capture time printed inside the image, not a continuous uptime monitor. [Captured checks →](assets/readme/doctor-snapshot.json)

```bash
pnpm doctor
```

A red line means grades cannot be trusted yet.

## Receipts that travel

![GEMHOG JSON export: an excerpt of the synthetic demo certificate as machine-readable JSON, with the three output formats](assets/readme/json-export.svg)

The same certificate can be read in a terminal, consumed as JSON, or shared as Markdown. The picture shows an excerpt of the real demo schema.

```bash
pnpm gemhog demo --format json --output demo.json
pnpm gemhog demo --format markdown --output demo.md
```

Exports refuse to overwrite existing files.

The terminal images are documentation illustrations of existing outputs, rendered by `scripts/render-readme.mjs` from real command runs, never drawn by hand. [Reproduce or refresh the images →](assets/readme/README.md)

Open the site locally:

```bash
pnpm dev
```

Visit `http://localhost:3000` for the landing page and `/terminal` for the browser terminal.

## Live grading

The example below is a supported public token, not the GEMHOG contract:

```bash
pnpm gemhog check 0xac79255f6f404eba14f316e8669d76573a2d7b1e
pnpm gemhog check PEANUT
pnpm gemhog check 0x… --format json --output certificate.json
```

The certificate near the top of this README shows a captured run of the first command. A ticker fans out to the search sources and every candidate is verified against the pons factory; an ambiguous ticker returns the whole cluster and asks for the contract address. Bonding-curve tokens that never graduated are searchable by ticker only with a free `BLOCKSCOUT_API_KEY` in `.env`; the contract address always works.

How the grade is computed — the cohort, the checkpoints and all four component formulas — is written down in [docs/METHODOLOGY.md](docs/METHODOLOGY.md).

## API and development

`POST /api/grade` accepts `{ "token": "0x…" }` or `{ "ticker": "PEANUT" }` and returns the same certificate JSON as the CLI, `{ "cluster": [...] }` for an ambiguous ticker, or `{ "error": "…" }`. `GET /api/health` runs the doctor's checks. Server routes hold a 60-second in-memory cache per input so a page full of browsers cannot hammer the public RPC.

```bash
pnpm check
```

## Boundaries and sources

GEMHOG holds no keys and has no transaction path. Holder Check will request only a public EVM address. A grade is a measurement of past holder behaviour, not a prediction and not a proof that a token is safe.

Built against public [Pons Portal data](https://www.ponsportal.fun/docs.html), [Pons V2 contracts](https://github.com/ponsdotdev/ponsfamily/tree/main/contractsV2), [Robinhood Chain](https://docs.robinhood.com/chain/), [Blockscout](https://robinhoodchain.blockscout.com) and [DexScreener](https://docs.dexscreener.com/api/reference). Independent of these services. Chain-reading code adapted from [bodkin](https://github.com/Phosphenq/bodkin) and [novamp](https://github.com/bored2boar/novamp) (MIT). MIT — see [LICENSE](LICENSE).
