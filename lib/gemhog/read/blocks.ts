import { publicClient } from "../chain.js";

/**
 * Block/time mapping. Robinhood Chain seals a block about every 101 ms and the
 * rate is stable over days (measured 0.1014-0.1017 s/block across 1M blocks),
 * so a launch anchor plus the current head give a linear clock that is accurate
 * to seconds — good enough to bucket transfers into 5m+ checkpoints without
 * burning RPC calls on per-block timestamp reads.
 */

export interface ChainClock {
  headBlock: number;
  headTs: number;
  anchorBlock: number;
  anchorTs: number;
  secPerBlock: number;
}

export async function makeClock(anchorBlock: number, anchorTs: number): Promise<ChainClock> {
  const head = await publicClient.getBlock({ blockTag: "latest" });
  const headBlock = Number(head.number);
  const headTs = Number(head.timestamp);
  const span = headBlock - anchorBlock;
  const secPerBlock = span > 100 ? (headTs - anchorTs) / span : 0.1014;
  return { headBlock, headTs, anchorBlock, anchorTs, secPerBlock };
}

export const blockToTs = (clock: ChainClock, block: number): number =>
  clock.anchorTs + (block - clock.anchorBlock) * clock.secPerBlock;

export const tsToBlock = (clock: ChainClock, ts: number): number =>
  Math.round(clock.anchorBlock + (ts - clock.anchorTs) / clock.secPerBlock);

/**
 * Find the block sealed nearest to a timestamp by iterating the linear
 * estimate against real block headers. Converges in 2-4 reads on this chain.
 */
export async function blockAtTime(ts: number, hintBlock?: number): Promise<number> {
  const head = await publicClient.getBlock({ blockTag: "latest" });
  let guess = hintBlock ?? Number(head.number) - Math.round((Number(head.timestamp) - ts) / 0.1014);
  for (let i = 0; i < 6; i++) {
    guess = Math.max(1, Math.min(guess, Number(head.number)));
    const b = await publicClient.getBlock({ blockNumber: BigInt(guess) });
    const drift = ts - Number(b.timestamp);
    const step = Math.round(drift / 0.1014);
    if (Math.abs(step) <= 4) return guess + step;
    guess += step;
  }
  return guess;
}
