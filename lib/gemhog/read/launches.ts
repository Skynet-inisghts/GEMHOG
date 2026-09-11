import { decodeFunctionData, getAddress, parseEventLogs, type Address, type Hex } from "viem";
import { curveAbi, erc20Abi, factoryAbi, PHASE_NAME, routerAbi, SELECTOR } from "../abi/pons.js";
import { ADDR, publicClient, ZERO } from "../chain.js";
import { blockAtTime } from "./blocks.js";

/**
 * Everything knowable about one launch before any log scanning: the factory
 * record, curve state, token identity, the exact launch block, and what the
 * launcher did in the launch transaction.
 * Launch-transaction decoding adapted from bodkin (MIT) — https://github.com/Phosphenq/bodkin
 */

export interface LaunchInfo {
  token: Address;
  symbol: string;
  name: string;
  curve: Address;
  deployer: Address;
  creatorFeeRecipient: Address;
  pairToken: Address;
  pairIsEth: boolean;
  phase: number;
  phaseLabel: string;
  graduated: boolean;
  curveProgress: number; // 0..1, raised vs graduation threshold
  launchedAt: number;
  launchBlock: number;
  launchTxHash: Hex | null;
  totalSupply: bigint;
  /** Quote the launcher spent on its own first buy; 0 when launched without one. */
  devBuyWei: bigint;
  /** Tokens the launcher received in the launch transaction. */
  devTokens: bigint;
  /** Wallets declared exempt from the opening tax at launch: the declared bundle. */
  exemptions: Address[];
}

export interface LaunchHint {
  launchBlock: number;
  txHash: Hex;
}

export async function readLaunch(token: Address, hint?: LaunchHint): Promise<LaunchInfo | null> {
  const record = await publicClient.readContract({
    address: ADDR.ponsFactory, abi: factoryAbi, functionName: "getLaunchedToken", args: [token],
  });
  if (!record.exists) return null;
  const curve = record.curve;

  const c = { address: curve, abi: curveAbi } as const;
  const t = { address: token, abi: erc20Abi } as const;
  const r = await publicClient.multicall({
    allowFailure: true,
    contracts: [
      { ...t, functionName: "symbol" },
      { ...t, functionName: "name" },
      { ...t, functionName: "totalSupply" },
      { ...c, functionName: "launchedAt" },
      { ...c, functionName: "graduated" },
      { ...c, functionName: "realQuoteReserve" },
      { ...c, functionName: "graduationThreshold" },
    ],
  });
  const ok = <T,>(i: number): T | null => (r[i].status === "success" ? (r[i].result as T) : null);
  const launchedAt = Number(ok<bigint>(3) ?? 0n);
  if (!launchedAt) return null;
  const raised = ok<bigint>(5) ?? 0n;
  const threshold = ok<bigint>(6) ?? record.graduationThreshold;

  // The factory indexes TokenLaunched by token, so one narrow log read around
  // the timestamp-derived block recovers the exact launch block and tx. A
  // caller that already indexed the launch (hunt) passes both in and skips it.
  let launchBlock: number;
  let launchTxHash: Hex | null;
  if (hint) {
    launchBlock = hint.launchBlock;
    launchTxHash = hint.txHash;
  } else {
    const approx = await blockAtTime(launchedAt);
    launchBlock = approx;
    launchTxHash = null;
    try {
      const logs = await publicClient.getLogs({
        address: ADDR.ponsFactory,
        event: factoryAbi.find((e) => e.type === "event" && e.name === "TokenLaunched")!,
        args: { token },
        fromBlock: BigInt(Math.max(1, approx - 3000)),
        toBlock: BigInt(approx + 3000),
      });
      if (logs[0]) {
        launchBlock = Number(logs[0].blockNumber);
        launchTxHash = logs[0].transactionHash;
      }
    } catch { /* the linear estimate stands; cohort windows are minutes wide */ }
  }

  let devBuyWei = 0n;
  let devTokens = 0n;
  let exemptions: Address[] = [];
  if (launchTxHash) {
    try {
      const [tx, receipt] = await Promise.all([
        publicClient.getTransaction({ hash: launchTxHash }),
        publicClient.getTransactionReceipt({ hash: launchTxHash }),
      ]);
      if (tx.input.startsWith(SELECTOR.launchAndBuy)) {
        try {
          const d = decodeFunctionData({ abi: routerAbi, data: tx.input });
          if (d.functionName === "launchAndBuy") {
            const [, , , quoteIn, , , ex] = d.args;
            devBuyWei = quoteIn;
            exemptions = ex.map((a) => getAddress(a));
          }
        } catch { /* unknown encoding: the CurveBuy events below still count the buy */ }
      }
      // The curve's own CurveBuy events in the launch transaction are ground
      // truth for what the launcher bought, whatever contract path was used.
      const buys = parseEventLogs({ abi: curveAbi, logs: receipt.logs, eventName: "CurveBuy" });
      let spentInTx = 0n;
      for (const b of buys) if (b.address.toLowerCase() === curve.toLowerCase()) { devTokens += b.args.tokensOut; spentInTx += b.args.quoteIn; }
      if (devBuyWei === 0n) devBuyWei = spentInTx;
    } catch { /* dev-buy stays 0; color simply loses that signal */ }
  }

  return {
    token,
    symbol: ok<string>(0) ?? "?",
    name: ok<string>(1) ?? "?",
    curve,
    deployer: record.deployer,
    creatorFeeRecipient: record.creatorFeeRecipient,
    pairToken: record.pairToken,
    pairIsEth: record.pairToken === ZERO,
    phase: Number(record.phase),
    phaseLabel: PHASE_NAME[Number(record.phase)] ?? String(record.phase),
    graduated: ok<boolean>(4) ?? Number(record.phase) === 2,
    curveProgress: threshold > 0n ? Math.min(1, Number((raised * 10_000n) / threshold) / 10_000) : 0,
    launchedAt,
    launchBlock,
    launchTxHash,
    totalSupply: ok<bigint>(2) ?? 0n,
    devBuyWei,
    devTokens,
    exemptions,
  };
}
