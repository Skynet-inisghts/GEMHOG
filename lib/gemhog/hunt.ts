import type { Address, Hex } from "viem";
import { ADDR, publicClient } from "./chain.js";
import { curveAbi, factoryAbi } from "./abi/pons.js";
import { rpcCallCount } from "./rpc.js";
import { checkToken } from "./check.js";
import { TOO_EARLY_SEC, gradeFor } from "./grade/grade.js";
import type { CertificateReport } from "./grade/types.js";
import { ago, lpad, pad, short } from "./fmt.js";

/**
 * hunt: dig through every launch in a window and keep the stones.
 *
 * The novamp pattern, applied to grading: a cheap index first (TokenLaunched
 * logs, then three curve reads per launch through multicall3), and the
 * expensive part — a full certificate — only for the short list of candidates
 * that raised real money, best-funded first, until the time budget runs out.
 * Nothing expensive ever runs across the whole window.
 */

export interface IndexedLaunch {
  token: Address;
  curve: Address;
  deployer: Address;
  block: number;
  txHash: Hex;
  raisedWei: bigint;
  graduated: boolean;
  launchedAt: number;
}

export interface HuntRow {
  rank: number;
  grade: string;
  score: number;
  symbol: string;
  ageSec: number;
  cohort: number;
  held1h: number | null;
  dev: string;
  top10Pct: number;
  holders: number;
  token: string;
}

export interface HuntResult {
  window: string;
  launches: number;
  withBuyers: number;
  graded: number;
  incubating: number;
  rows: HuntRow[];
  byGrade: Record<string, number>;
  vs2plus: number;
  observedAt: string;
  rpcCalls: number;
  ms: number;
  budgetHit: boolean;
}

export const WINDOWS: Record<string, number> = { "1h": 3600, "3h": 10800, "6h": 21600, "12h": 43200, "24h": 86400 };

/** Raised quote below this is noise: nobody ever bought. */
const MIN_RAISED_WEI = 50_000_000_000_000_000n; // 0.05 ETH

const SEC_PER_BLOCK = 0.1014;

/** Every TokenLaunched in the window plus three curve reads each: the cheap index. */
export async function indexLaunches(windowSec: number): Promise<{ launches: IndexedLaunch[]; head: number }> {
  const head = Number(await publicClient.getBlockNumber());
  const from = head - Math.round(windowSec / SEC_PER_BLOCK);
  const event = factoryAbi.find((e) => e.type === "event" && e.name === "TokenLaunched")!;
  const raw: { token: Address; curve: Address; deployer: Address; block: number; txHash: Hex }[] = [];
  let chunk = 400_000;
  let start = from;
  while (start <= head) {
    const end = Math.min(head, start + chunk - 1);
    try {
      const logs = await publicClient.getLogs({ address: ADDR.ponsFactory, event, fromBlock: BigInt(start), toBlock: BigInt(end) });
      for (const log of logs) {
        if (!log.args.token || !log.args.curve || !log.args.deployer) continue;
        raw.push({ token: log.args.token, curve: log.args.curve, deployer: log.args.deployer, block: Number(log.blockNumber), txHash: log.transactionHash });
      }
      start = end + 1;
    } catch {
      chunk = Math.max(2_000, Math.floor(chunk / 4));
    }
  }

  const launches: IndexedLaunch[] = [];
  const BATCH = 100;
  for (let i = 0; i < raw.length; i += BATCH) {
    const slice = raw.slice(i, i + BATCH);
    const r = await publicClient.multicall({
      allowFailure: true,
      contracts: slice.flatMap((l) => [
        { address: l.curve, abi: curveAbi, functionName: "realQuoteReserve" as const },
        { address: l.curve, abi: curveAbi, functionName: "graduated" as const },
        { address: l.curve, abi: curveAbi, functionName: "launchedAt" as const },
      ]),
    });
    for (const [j, l] of slice.entries()) {
      const raised = r[j * 3].status === "success" ? (r[j * 3].result as bigint) : 0n;
      const graduated = r[j * 3 + 1].status === "success" ? (r[j * 3 + 1].result as boolean) : false;
      const launchedAt = r[j * 3 + 2].status === "success" ? Number(r[j * 3 + 2].result as bigint) : 0;
      launches.push({ ...l, raisedWei: raised, graduated, launchedAt });
    }
  }
  return { launches, head };
}

/** Candidates worth a full certificate: real money on the curve (or graduated), best-funded first. */
export function rankCandidates(launches: IndexedLaunch[]): IndexedLaunch[] {
  return launches
    .filter((l) => l.launchedAt > 0 && (l.graduated || l.raisedWei >= MIN_RAISED_WEI))
    .sort((a, b) => (b.raisedWei > a.raisedWei ? 1 : b.raisedWei < a.raisedWei ? -1 : 0));
}

export interface HuntOptions {
  windowSec: number;
  windowLabel: string;
  minGrade?: string;
  top: number;
  /** Wall-clock budget for the deepen loop, ms. */
  budgetMs: number;
  onProgress?: (msg: string) => void;
}

const GRADE_ORDER = ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "I1", "I2", "I3"];
export const gradeAtLeast = (grade: string, floor: string): boolean =>
  GRADE_ORDER.indexOf(grade) !== -1 && GRADE_ORDER.indexOf(grade) <= GRADE_ORDER.indexOf(floor);

export function toRow(report: CertificateReport, rank: number): HuntRow {
  return {
    rank,
    grade: report.grade,
    score: report.score,
    symbol: report.symbol,
    ageSec: report.ageSec,
    cohort: report.cut.cohort,
    held1h: report.cut.held["1h"] ?? report.cut.held["15m"] ?? report.cut.held["5m"] ?? null,
    dev: report.color.devSells === 0 ? "held" : `sold${report.color.devSells}`,
    top10Pct: report.clarity.top10Pct,
    holders: report.carat.holders,
    token: report.token,
  };
}

export async function runHunt(options: HuntOptions): Promise<{ result: HuntResult; reports: CertificateReport[] }> {
  const started = Date.now();
  const callsBefore = rpcCallCount();
  options.onProgress?.(`indexing ${options.windowLabel} of launches…`);
  const { launches } = await indexLaunches(options.windowSec);
  const candidates = rankCandidates(launches);
  const now = Date.now() / 1000;
  const incubating = launches.filter((l) => l.launchedAt > 0 && now - l.launchedAt < TOO_EARLY_SEC).length;
  options.onProgress?.(`${launches.length} launches · ${candidates.length} with buyers · grading best-funded first…`);

  const reports: CertificateReport[] = [];
  let budgetHit = false;
  for (const candidate of candidates) {
    if (Date.now() - started > options.budgetMs) { budgetHit = true; break; }
    if (now - candidate.launchedAt < TOO_EARLY_SEC) continue;
    try {
      const report = await checkToken(candidate.token, {
        hint: { launchBlock: candidate.block, txHash: candidate.txHash },
        holdersVia: "transfers",
      });
      if (!report.tooEarly) {
        reports.push(report);
        options.onProgress?.(`  ${pad(report.grade, 5)} ${report.score}  $${report.symbol}`);
      }
    } catch { /* one unreadable token never stops the dig */ }
  }

  const byGrade: Record<string, number> = {};
  let vs2plus = 0;
  for (const r of reports) {
    byGrade[r.grade] = (byGrade[r.grade] ?? 0) + 1;
    if (gradeAtLeast(r.grade, "VS2")) vs2plus++;
  }
  const kept = reports
    .filter((r) => !options.minGrade || gradeAtLeast(r.grade, options.minGrade))
    .sort((a, b) => b.score - a.score)
    .slice(0, options.top);

  return {
    result: {
      window: options.windowLabel,
      launches: launches.length,
      withBuyers: candidates.length,
      graded: reports.length,
      incubating,
      rows: kept.map((r, i) => toRow(r, i + 1)),
      byGrade,
      vs2plus,
      observedAt: new Date().toISOString(),
      rpcCalls: rpcCallCount() - callsBefore,
      ms: Date.now() - started,
      budgetHit,
    },
    reports,
  };
}

export function renderHunt(result: HuntResult, markdown = false): string {
  const head = `gemhog hunt · window ${result.window} · ${result.launches} launches · ${result.withBuyers} with buyers · ${result.graded} graded · robinhood chain 4663`;
  const cols = `${pad("#", 4)}${pad("GRADE", 7)}${lpad("SCORE", 5)}  ${pad("SYMBOL", 12)}${pad("AGE", 8)}${lpad("COHORT", 6)}  ${pad("HELD", 6)}${pad("DEV", 7)}${lpad("TOP10", 6)}${lpad("HOLDERS", 8)}  TOKEN`;
  const rows = result.rows.map((r) =>
    `${pad(String(r.rank), 4)}${pad(r.grade, 7)}${lpad(String(r.score), 5)}  ${pad(r.symbol.slice(0, 10), 12)}${pad(ago(0, r.ageSec), 8)}${lpad(String(r.cohort), 6)}  ${pad(r.held1h === null ? "–" : Math.round(r.held1h * 100) + "%", 6)}${pad(r.dev, 7)}${lpad(r.top10Pct.toFixed(1) + "%", 6)}${lpad(String(r.holders), 8)}  ${short(r.token)}`,
  );
  const foot = [
    `incubating (under 5m, no grade yet): ${result.incubating}`,
    `${result.rpcCalls} rpc calls · ${(result.ms / 1000).toFixed(1)}s${result.budgetHit ? " · time budget reached, best-funded candidates graded first" : ""}`,
  ];
  const body = [head, "", cols, ...rows, "", ...foot].join("\n");
  return markdown ? ["```text", body, "```"].join("\n") : body;
}

export function huntToCsv(result: HuntResult): string {
  const header = "rank,grade,score,symbol,age_sec,cohort,held_1h,dev,top10_pct,holders,token";
  const lines = result.rows.map((r) =>
    [r.rank, r.grade, r.score, JSON.stringify(r.symbol), Math.round(r.ageSec), r.cohort, r.held1h ?? "", r.dev, r.top10Pct, r.holders, r.token].join(","),
  );
  return [header, ...lines].join("\n");
}

export { gradeFor };
