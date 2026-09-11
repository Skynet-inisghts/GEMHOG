# Methodology

GEMHOG answers one question: **are the early buyers of this token still holding, or already leaving?** Everything below is computed from public chain state; nothing is predicted, simulated or estimated from price.

## The early cohort

The cohort is the set of unique `CurveBuy` recipients in the **first 60 seconds** after `launchedAt`. A quiet launch widens the window to the **first 20 buyers**, but never past 10 minutes.

Excluded from the cohort:

- the deployer and the creator-fee recipient;
- the curve, the pool manager, the locker, the router and other infrastructure;
- the declared bundle: wallets listed as opening-tax exemptions in the launch transaction's calldata.

The pons opening tax starts at 99% and decays to zero over about three seconds, charged per recipient. That makes the buy list unusually informative: a buyer whose recorded tax was ~99% of the buy raced the first block with a bot; a buyer near zero waited on purpose. Buyers at or below **15%** form the **human cohort**. When the human cohort has at least 10 wallets it carries the score; otherwise the full cohort does. Both counts are printed on every certificate.

## Checkpoints and retention

Checkpoints are measured from `launchedAt`: **5m, 15m, 1h, 6h, 24h, 7d** — only the ones that have already happened.

Balances are replayed from the token's `Transfer` history, never read from archive state. For each cohort wallet at each checkpoint:

- `peak` is the wallet's largest balance seen up to that checkpoint;
- the wallet **is holding** if its balance at the checkpoint is at least `0.8 × peak`.

`held(t)` is the share of the cohort holding at checkpoint `t`. The **half-life** is the first checkpoint where `held < 0.5`; a token that never crosses it shows `never` once all six checkpoints pass, and `not reached` before that.

Tokens younger than 5 minutes print `TOO EARLY` with the time until the first checkpoint.

## The four components (sum = 100)

### cut — retention, 0-40

```
cut = 40 · Σ w(t) · held(t) / Σ w(t)
w = { 5m: 1, 15m: 1, 1h: 2, 6h: 2, 24h: 3, 7d: 3 }        (reached checkpoints only)
```

### clarity — concentration, 0-20

Top-10 holder share of supply, with the curve, pool and locker excluded:

```
top10 < 20%          -> 20
20% <= top10 <= 30%  -> 20 down to 8, linear
30% <  top10 <= 50%  -> 8 down to 0, linear
top10 > 50%          -> 0
bundle holds > 10%   -> additional -5
```

### color — dev behaviour, 0-20

Starts at 20:

```
first dev exit   -8       (a CurveSell, or an outbound transfer that is not
second dev exit  -12       a burn and not the leg of a counted curve sell,
                           from the deployer or the fee recipient)
fee claim in the first 24h   -4 each, capped at -8
dev bought > 8% of supply    -6
floor at 0
```

A dev who burns their bag is not penalized: a burn is the opposite of an exit.

### carat — weight, 0-20

```
carat = min(10, holders / 25)
      + min(6, cohortQuote / 2)          (ETH spent by the scored cohort)
      + 4 if the top 3 cohort wallets bought < 35% of the cohort's volume
```

## Grade

| Score | Grade | | Score | Grade |
|---|---|---|---|---|
| 95-100 | FL | | 50-59 | SI1 |
| 90-94 | IF | | 40-49 | SI2 |
| 85-89 | VVS1 | | 25-39 | I1 |
| 80-84 | VVS2 | | 10-24 | I2 |
| 70-79 | VS1 | | 0-9 | I3 |
| 60-69 | VS2 | | | |

## Sources and their limits

- **RPC** (publicnode for state, the official Robinhood endpoint for logs): launch record, curve state, `CurveBuy`/`CurveSell`, `Transfer`, escrow `Credited`/`Claimed`. Log reads are chunked adaptively; a chunk the RPC refuses even at the minimum size is reported as `partial`, never silently treated as empty.
- **Pons Portal API**: holder pages (a Blockscout proxy). Holder counts stop mattering to carat past 250, so pagination stops soon after and the certificate prints `N+` for a floor.
- **Blockscout API** (optional key): ticker search for bonding-curve tokens.
- **DexScreener**: ticker search for graduated tokens.

A ticker proves nothing — anyone can relaunch the same symbol. An ambiguous ticker returns the whole cluster and the certificate is always issued for one contract address.

A grade is a measurement of past holder behaviour. It is not a prediction, not an endorsement, and not a proof that a token is safe.
