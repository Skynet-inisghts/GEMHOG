import { BURN_ADDRESSES } from "../chain.js";
import { balancesFromTransfers } from "../read/holders.js";
import type { Cohort, Components, GradeSource, Retention } from "./types.js";
import { CHECKPOINTS } from "./types.js";

/**
 * The four components, sum 100:
 *   cut     0-40  do the early buyers hold through the checkpoints
 *   clarity 0-20  is the supply spread out or in two hands
 *   color   0-20  is the dev still in the game
 *   carat   0-20  is there anyone actually here
 * Formulas are fixed in GEMHOG_SPEC.md section 2.4 and docs/METHODOLOGY.md;
 * change them there first, then here.
 */

export function cutScore(retention: Retention): number {
  let weighted = 0;
  let weightSum = 0;
  for (const c of CHECKPOINTS) {
    const share = retention.held[c.label];
    if (share === undefined) continue;
    weighted += c.weight * share;
    weightSum += c.weight;
  }
  if (weightSum === 0) return 0;
  return Math.round((40 * weighted) / weightSum);
}

export function clarityScore(top10Pct: number, bundleHoldsPct: number): number {
  let score: number;
  if (top10Pct < 20) score = 20;
  else if (top10Pct <= 30) score = 20 - (top10Pct - 20) * 1.2; // 20 -> 8
  else if (top10Pct <= 50) score = 8 - (top10Pct - 30) * 0.4; // 8 -> 0
  else score = 0;
  if (bundleHoldsPct > 10) score -= 5;
  return Math.max(0, Math.round(score));
}

export function colorScore(input: { devSells: number; feeClaims24h: number; devBoughtPct: number }): number {
  let score = 20;
  if (input.devSells >= 1) score -= 8;
  if (input.devSells >= 2) score -= 12;
  score -= Math.min(8, input.feeClaims24h * 4);
  if (input.devBoughtPct > 8) score -= 6;
  return Math.max(0, score);
}

export function caratScore(input: { holders: number; cohortQuoteEth: number; top3OfCohortPct: number }): number {
  const weight = Math.min(10, input.holders / 25);
  const skin = Math.min(6, input.cohortQuoteEth / 2);
  const spread = input.top3OfCohortPct < 35 ? 4 : 0;
  return Math.round(weight + skin + spread);
}

export function computeComponents(source: GradeSource, cohort: Cohort, retention: Retention): Components {
  const { launch, trades, transfers, holders, escrow, secPerBlock } = source;

  // Bundle share of supply right now, from the replayed balances.
  const balances = balancesFromTransfers(transfers);
  let bundleHolds = 0n;
  for (const wallet of cohort.bundleWallets) bundleHolds += balances.get(wallet.toLowerCase()) ?? 0n;
  const bundleHoldsPct = launch.totalSupply > 0n ? Number((bundleHolds * 10_000n) / launch.totalSupply) / 100 : 0;

  // Dev exits: curve sells by the deployer or fee recipient, plus outbound
  // token transfers from either (a post-graduation pool sell shows up as a
  // transfer into the pool manager, so both paths are covered). A transfer to
  // the curve is the leg of a CurveSell already counted; a transfer to a burn
  // address is a burn, which is the opposite of an exit.
  const devAddresses = new Set([launch.deployer.toLowerCase(), launch.creatorFeeRecipient.toLowerCase()]);
  let devSells = 0;
  for (const t of trades) if (t.kind === "sell" && devAddresses.has(t.wallet.toLowerCase())) devSells++;
  for (const t of transfers) {
    const to = t.to.toLowerCase();
    if (!devAddresses.has(t.from.toLowerCase()) || t.value === 0n) continue;
    if (devAddresses.has(to) || to === launch.curve.toLowerCase() || BURN_ADDRESSES.has(to)) continue;
    devSells++;
  }

  const dayBlocks = Math.round(86_400 / secPerBlock);
  const feeClaims24h = escrow.claims.filter((c) => c.block <= launch.launchBlock + dayBlocks).length;
  const devBoughtPct = launch.totalSupply > 0n ? Number((launch.devTokens * 10_000n) / launch.totalSupply) / 100 : 0;

  const scored = cohort.scoredIsHuman ? cohort.human : cohort.all;
  let cohortQuoteWei = 0n;
  for (const w of scored) cohortQuoteWei += w.quoteInWei;
  const top3 = [...scored].sort((a, b) => (b.quoteInWei > a.quoteInWei ? 1 : b.quoteInWei < a.quoteInWei ? -1 : 0)).slice(0, 3);
  const top3Wei = top3.reduce((sum, w) => sum + w.quoteInWei, 0n);
  const top3OfCohortPct = cohortQuoteWei > 0n ? Number((top3Wei * 10_000n) / cohortQuoteWei) / 100 : 100;

  return {
    cut: cutScore(retention),
    clarity: clarityScore(holders.top10Pct, bundleHoldsPct),
    color: colorScore({ devSells, feeClaims24h, devBoughtPct }),
    carat: caratScore({ holders: holders.holderCount, cohortQuoteEth: Number(cohortQuoteWei) / 1e18, top3OfCohortPct }),
    detail: { bundleHoldsPct, devSells, feeClaims24h, devBoughtPct, cohortQuoteWei, top3OfCohortPct },
  };
}
