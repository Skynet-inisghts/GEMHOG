import { parseEventLogs, type Address } from "viem";
import { curveAbi, erc20Abi, escrowAbi } from "../abi/pons.js";
import { ADDR, publicClient } from "../chain.js";

/**
 * Chunked log reads. The public Robinhood RPC accepts ranges up to about 1M
 * blocks (~28 hours) on a single address filter (measured 2026-09-11) and
 * meters eth_getLogs separately, so the chunk starts big and halves on
 * refusal. A refused chunk that never succeeds is reported as a hole, not
 * silently treated as empty — see `complete`.
 * Chunking pattern adapted from novamp (MIT) — https://github.com/bored2boar/novamp
 */

const START_CHUNK = 900_000;
const MIN_CHUNK = 500;

export interface ChunkedResult<T> {
  events: T[];
  complete: boolean;
}

type RawLog = Awaited<ReturnType<typeof publicClient.getLogs>>[number];

/**
 * AIMD chunking: the RPC refuses any range whose result would be too large
 * ("Missing or invalid parameters", ~10k logs), so a refusal quarters the
 * chunk down to 500 blocks (~50 s) and every couple of clean reads doubles it
 * back. A launch-hour hot zone reads in small bites, the quiet weeks after in
 * 1M-block strides.
 */
async function readChunked(address: Address, fromBlock: number, toBlock: number): Promise<{ logs: RawLog[]; complete: boolean }> {
  const logs: RawLog[] = [];
  let complete = true;
  let chunk = START_CHUNK;
  let streak = 0;
  let start = fromBlock;
  while (start <= toBlock) {
    const end = Math.min(toBlock, start + chunk - 1);
    try {
      const batch = await publicClient.getLogs({ address, fromBlock: BigInt(start), toBlock: BigInt(end) });
      logs.push(...batch);
      start = end + 1;
      if (++streak >= 2 && chunk < START_CHUNK) { chunk = Math.min(START_CHUNK, chunk * 2); streak = 0; }
    } catch {
      streak = 0;
      if (chunk > MIN_CHUNK) { chunk = Math.max(MIN_CHUNK, Math.floor(chunk / 4)); continue; }
      complete = false; // a hole in the window, not an empty window
      start = end + 1;
    }
  }
  return { logs, complete };
}

export interface CurveTrade {
  kind: "buy" | "sell";
  /** recipient for buys, seller for sells. */
  wallet: Address;
  quoteWei: bigint;
  tokens: bigint;
  taxWei: bigint;
  block: number;
}

/** Every CurveBuy and CurveSell on a curve over a block window, in order. */
export async function readCurveTrades(curve: Address, fromBlock: number, toBlock: number): Promise<ChunkedResult<CurveTrade>> {
  const { logs, complete } = await readChunked(curve, fromBlock, toBlock);
  const events: CurveTrade[] = [];
  for (const log of parseEventLogs({ abi: curveAbi, logs })) {
    if (log.eventName === "CurveBuy") {
      events.push({ kind: "buy", wallet: log.args.recipient, quoteWei: log.args.quoteIn, tokens: log.args.tokensOut, taxWei: log.args.tax, block: Number(log.blockNumber) });
    } else if (log.eventName === "CurveSell") {
      events.push({ kind: "sell", wallet: log.args.seller, quoteWei: log.args.quoteOut, tokens: log.args.tokensIn, taxWei: log.args.tax, block: Number(log.blockNumber) });
    }
  }
  events.sort((a, b) => a.block - b.block);
  return { events, complete };
}

export interface TokenTransfer {
  from: Address;
  to: Address;
  value: bigint;
  block: number;
}

/** The token's full Transfer history over a window: cohort balances are rebuilt from this, never from archive-state reads. */
export async function readTransfers(token: Address, fromBlock: number, toBlock: number): Promise<ChunkedResult<TokenTransfer>> {
  const { logs, complete } = await readChunked(token, fromBlock, toBlock);
  const events: TokenTransfer[] = [];
  for (const log of parseEventLogs({ abi: erc20Abi, logs, eventName: "Transfer" })) {
    events.push({ from: log.args.from, to: log.args.to, value: log.args.value, block: Number(log.blockNumber) });
  }
  events.sort((a, b) => a.block - b.block);
  return { events, complete };
}

export interface EscrowActivity {
  creditedWei: bigint;
  claims: { block: number; amountWei: bigint }[];
  complete: boolean;
}

/** Creator-fee escrow flow for one recipient: what was credited, when it was claimed. */
export async function readEscrowActivity(recipient: Address, fromBlock: number, toBlock: number): Promise<EscrowActivity> {
  const out: EscrowActivity = { creditedWei: 0n, claims: [], complete: true };
  const credited = escrowAbi.find((e) => e.type === "event" && e.name === "Credited")!;
  const claimed = escrowAbi.find((e) => e.type === "event" && e.name === "Claimed")!;
  let chunk = START_CHUNK;
  let start = fromBlock;
  while (start <= toBlock) {
    const end = Math.min(toBlock, start + chunk - 1);
    try {
      const [creditedLogs, claimedLogs] = await Promise.all([
        publicClient.getLogs({ address: ADDR.ponsEscrow, event: credited, args: { recipient }, fromBlock: BigInt(start), toBlock: BigInt(end) }),
        publicClient.getLogs({ address: ADDR.ponsEscrow, event: claimed, args: { recipient }, fromBlock: BigInt(start), toBlock: BigInt(end) }),
      ]);
      for (const log of creditedLogs) out.creditedWei += log.args.amount ?? 0n;
      for (const log of claimedLogs) out.claims.push({ block: Number(log.blockNumber), amountWei: log.args.amount ?? 0n });
      start = end + 1;
    } catch {
      if (chunk > MIN_CHUNK) { chunk = Math.max(MIN_CHUNK, Math.floor(chunk / 4)); continue; }
      out.complete = false;
      start = end + 1;
    }
  }
  out.claims.sort((a, b) => a.block - b.block);
  return out;
}
