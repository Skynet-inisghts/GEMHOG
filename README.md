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

## Available in the current source

| Surface | What works |
| --- | --- |
| Local CLI | `doctor` with measured checks of every source; `demo`, a marked synthetic walkthrough |
| Landing page | The project front door with the grade scale and safety boundaries |
| `/terminal`, `/holders` | Labelled placeholders; the live terminal arrives in 0.2, Holder Check in 0.3 |
| `GET /api/health` | The doctor's checks as JSON |
| Exports | JSON and Markdown for both commands; exports refuse to overwrite existing files |
| Verification | CLI tests, Node 22/24 CI, and a `no-signer` job that fails the build if a signing primitive appears |

Official `$GEMHOG` contract: TBA. The address will be published here, on the site and in `lib/gemhog/project-token.ts` at launch; until then any address claiming to be $GEMHOG is not ours.

## Start in one minute

Install Node.js 20+ and pnpm, then:

```bash
git clone https://github.com/Skynet-inisghts/GEMHOG.git
cd GEMHOG
pnpm install --frozen-lockfile
pnpm demo
```

`demo` compiles the CLI and prints a reproducible, synthetic certificate. Every line of it is marked `DEMO`; it does not fetch live data.

Check the sources this tool reads, with measured latency:

```bash
pnpm doctor
```

The doctor talks to both public RPC endpoints, re-reads the pons factory addresses from the live factory, and probes the Pons API, Blockscout and DexScreener. A red line means grades cannot be trusted yet.

Open the site locally:

```bash
pnpm dev
```

Visit `http://localhost:3000` for the landing page.

## Boundaries and sources

GEMHOG holds no keys and has no transaction path. Holder Check will request only a public EVM address. A grade is a measurement of past holder behaviour, not a prediction and not a proof that a token is safe.

Built against public [Pons Portal data](https://www.ponsportal.fun/docs.html), [Pons V2 contracts](https://github.com/ponsdotdev/ponsfamily/tree/main/contractsV2), [Robinhood Chain](https://docs.robinhood.com/chain/), [Blockscout](https://robinhoodchain.blockscout.com) and [DexScreener](https://docs.dexscreener.com/api/reference). Independent of these services. Chain-reading code adapted from [bodkin](https://github.com/Phosphenq/bodkin) and [novamp](https://github.com/bored2boar/novamp) (MIT). MIT — see [LICENSE](LICENSE).
