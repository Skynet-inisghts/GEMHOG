import type { Address } from "viem";
import { publicClient } from "./chain.js";
import { rpcCallCount } from "./rpc.js";
import { readLaunch } from "./read/launches.js";
import { makeClock } from "./read/blocks.js";
import { readCurveTrades, readEscrowActivity, readTransfers } from "./read/logs.js";
import { holdersFromTransfers, readHoldersFromPonsApi } from "./read/holders.js";
import { assembleCertificate } from "./grade/grade.js";
import { CHECKPOINTS } from "./grade/types.js";
import type { CertificateReport, GradeSource } from "./grade/types.js";

/**
 * The live path behind `gemhog check` and POST /api/grade: read one token off
 * the chain, hand everything to the pure pipeline, stamp provenance.
 */

export class CheckError extends Error {}

export interface CheckOptions {
  /** Launch block and tx already known from an index scan (hunt). */
  hint?: import("./read/launches.js").LaunchHint;
  /** "transfers" skips the Pons API holder pages: hunt grades dozens of tokens and the endpoint allows 8 req/min. */
  holdersVia?: "auto" | "transfers";
}

export async function checkToken(token: Address, options: CheckOptions = {}): Promise<CertificateReport> {
  const started = Date.now();
  const callsBefore = rpcCallCount();

  const launch = await readLaunch(token, options.hint);
  if (!launch) throw new CheckError(`${token} was not launched through the pons v2 factory`);

  const clock = await makeClock(launch.launchBlock, launch.launchedAt);
  const now = clock.headTs;
  const ageSec = now - launch.launchedAt;

  // Logs are read from launch to now, capped at the 7d checkpoint: past that
  // the retention grade is frozen, and the cap keeps one check to a handful of
  // 1M-block getLogs chunks on the public RPC.
  const horizonSec = Math.min(ageSec, CHECKPOINTS.at(-1)!.sec);
  const toBlock = Math.min(clock.headBlock, launch.launchBlock + Math.round(horizonSec / clock.secPerBlock) + 10);

  const [trades, transfers, escrow] = await Promise.all([
    readCurveTrades(launch.curve, launch.launchBlock, toBlock),
    readTransfers(launch.token, launch.launchBlock, toBlock),
    readEscrowActivity(launch.creatorFeeRecipient, launch.launchBlock, toBlock),
  ]);

  const holders = options.holdersVia === "transfers"
    ? holdersFromTransfers(transfers.events, launch.curve, launch.totalSupply, transfers.complete)
    : (await readHoldersFromPonsApi(launch.token, launch.curve, launch.totalSupply)) ??
      holdersFromTransfers(transfers.events, launch.curve, launch.totalSupply, transfers.complete);

  const source: GradeSource = {
    launch: { ...launch },
    trades: trades.events,
    transfers: transfers.events,
    holders,
    escrow: { creditedWei: escrow.creditedWei, claims: escrow.claims },
    now,
    secPerBlock: clock.secPerBlock,
  };

  const report = assembleCertificate(source);
  report.block = clock.headBlock;
  report.rpcCalls = rpcCallCount() - callsBefore;
  report.ms = Date.now() - started;
  if (!trades.complete || !transfers.complete) report.source = "live · partial (some log chunks refused)";
  return report;
}

export { publicClient };
