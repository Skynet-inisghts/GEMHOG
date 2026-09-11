import type { Cohort, GradeSource, Retention, CheckpointLabel } from "./types.js";
import { CHECKPOINTS } from "./types.js";

/**
 * Retention at 5m / 15m / 1h / 6h / 24h / 7d, from Transfer history only.
 * The public RPC is not archival, so a wallet's balance at a checkpoint is
 * replayed from its transfers, and "still holding" means keeping at least 80%
 * of the peak balance seen so far — topping up counts, dumping does not, and
 * moving the bag to a fresh wallet counts as leaving.
 */

const HOLD_RATIO_NUM = 8n;
const HOLD_RATIO_DEN = 10n;

export function computeRetention(source: GradeSource, cohort: Cohort): Retention {
  const { launch, transfers, secPerBlock, now } = source;
  const scored = cohort.scoredIsHuman ? cohort.human : cohort.all;
  const ageSec = now - launch.launchedAt;

  const wallets = new Set(scored.map((w) => w.wallet.toLowerCase()));
  // Per-wallet transfer deltas in block order; the replay walks them once.
  const deltas = new Map<string, { block: number; delta: bigint }[]>();
  for (const wallet of wallets) deltas.set(wallet, []);
  for (const t of transfers) {
    const from = t.from.toLowerCase();
    const to = t.to.toLowerCase();
    if (wallets.has(from)) deltas.get(from)!.push({ block: t.block, delta: -t.value });
    if (wallets.has(to)) deltas.get(to)!.push({ block: t.block, delta: t.value });
  }

  const reached = CHECKPOINTS.filter((c) => c.sec <= ageSec);
  const held: Partial<Record<CheckpointLabel, number>> = {};
  let halfLife: CheckpointLabel | null = null;

  const checkpointBlocks = reached.map((c) => launch.launchBlock + Math.round(c.sec / secPerBlock));

  for (const [i, checkpoint] of reached.entries()) {
    const atBlock = checkpointBlocks[i];
    let holding = 0;
    for (const wallet of wallets) {
      let balance = 0n;
      let peak = 0n;
      for (const step of deltas.get(wallet)!) {
        if (step.block > atBlock) break;
        balance += step.delta;
        if (balance > peak) peak = balance;
      }
      if (peak > 0n && balance * HOLD_RATIO_DEN >= peak * HOLD_RATIO_NUM) holding++;
    }
    const share = wallets.size > 0 ? holding / wallets.size : 0;
    held[checkpoint.label] = share;
    if (halfLife === null && share < 0.5) halfLife = checkpoint.label;
  }

  return { held, halfLife, allReached: reached.length === CHECKPOINTS.length };
}
