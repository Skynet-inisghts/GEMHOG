import type { Address } from "viem";
import { publicClient } from "./chain.js";
import { erc20Abi } from "./abi/pons.js";
import { rpcCallCount } from "./rpc.js";
import { readLaunch } from "./read/launches.js";
import { makeClock } from "./read/blocks.js";
import { readCurveTrades, readEscrowActivity, readTransfers, readTransfersFor } from "./read/logs.js";
import { holdersFromTransfers, readHoldersFromPonsApi } from "./read/holders.js";
import { assembleCertificate } from "./grade/grade.js";
import { buildCohort } from "./grade/cohort.js";
import { CHECKPOINTS } from "./grade/types.js";
import type { CertificateReport, GradeSource } from "./grade/types.js";

/**
 * The live path behind `gemhog check` and POST /api/grade: read one token off
 * the chain, hand everything to the pure pipeline, stamp provenance.
 *
 * The transfer read has two gears. When the Pons API supplies the holder
 * snapshot, only the transfers touching the cohort and the dev are read —
 * topic-filtered queries whose results stay tiny even on a token with tens of
 * thousands of swaps. Only when that API is down does the engine fall back to
 * the full Transfer replay it also uses to rebuild holders.
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
  if (!launch) {
    const { creatorLabel } = await import("./read/creator.js");
    const label = await creatorLabel(token);
    throw new CheckError(
      label
        ? `${token} was not launched through the pons v2 factory; it was created by ${label}. GEMHOG grades pons v2 launches only`
        : `${token} was not launched through the pons v2 factory`,
    );
  }

  const clock = await makeClock(launch.launchBlock, launch.launchedAt);
  const now = clock.headTs;
  const ageSec = now - launch.launchedAt;

  // Logs are read from launch to now, capped at the 7d checkpoint: past that
  // the retention grade is frozen.
  const horizonSec = Math.min(ageSec, CHECKPOINTS.at(-1)!.sec);
  const toBlock = Math.min(clock.headBlock, launch.launchBlock + Math.round(horizonSec / clock.secPerBlock) + 10);

  const [trades, escrow, holdersViaApi] = await Promise.all([
    readCurveTrades(launch.curve, launch.launchBlock, toBlock),
    readEscrowActivity(launch.creatorFeeRecipient, launch.launchBlock, toBlock),
    options.holdersVia === "transfers"
      ? Promise.resolve(null)
      : readHoldersFromPonsApi(launch.token, launch.curve, launch.totalSupply),
  ]);

  // The cohort falls out of the curve trades alone, before any transfer read.
  const preSource = {
    launch: { ...launch },
    trades: trades.events,
    transfers: [],
    holders: { top10Pct: 0, holderCount: 0, countIsFloor: false, source: "", complete: true, top: [] },
    escrow: { creditedWei: 0n, claims: [] },
    now,
    secPerBlock: clock.secPerBlock,
  } as GradeSource;
  const cohort = buildCohort(preSource);

  let transfers: { events: GradeSource["transfers"]; complete: boolean };
  let holders: GradeSource["holders"];
  let bundleBalances: GradeSource["bundleBalances"];

  if (holdersViaApi) {
    // Fast gear: transfers for the wallets the grade actually inspects.
    const watch = new Set<string>([
      ...cohort.all.map((w) => w.wallet),
      ...cohort.human.map((w) => w.wallet),
      ...cohort.bundleWallets,
      launch.deployer,
      launch.creatorFeeRecipient,
    ].map((w) => w.toLowerCase()));
    transfers = await readTransfersFor(launch.token, [...watch], launch.launchBlock, toBlock);
    holders = holdersViaApi;
    if (cohort.bundleWallets.length) {
      const balances = await publicClient.multicall({
        allowFailure: true,
        contracts: cohort.bundleWallets.map((w) => ({
          address: launch.token, abi: erc20Abi, functionName: "balanceOf" as const, args: [w as Address] as const,
        })),
      });
      bundleBalances = cohort.bundleWallets.map((w, i) => ({
        wallet: w,
        balance: balances[i].status === "success" ? (balances[i].result as bigint) : 0n,
      }));
    }
  } else {
    // Slow gear: the full replay, which doubles as the holder snapshot.
    transfers = await readTransfers(launch.token, launch.launchBlock, toBlock);
    holders = holdersFromTransfers(transfers.events, launch.curve, launch.totalSupply, transfers.complete);
  }

  const source: GradeSource = {
    launch: { ...launch },
    trades: trades.events,
    transfers: transfers.events,
    holders,
    escrow: { creditedWei: escrow.creditedWei, claims: escrow.claims },
    bundleBalances,
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
