/**
 * Shapes shared by the pure grading pipeline. Everything in grade/ is
 * synchronous and network-free: the reads in read/ produce a GradeSource, the
 * fixtures in test/fixtures/ produce the same shape from JSON, and both flow
 * through the same math.
 */

export interface SourceLaunch {
  token: string;
  symbol: string;
  name: string;
  curve: string;
  deployer: string;
  creatorFeeRecipient: string;
  pairIsEth: boolean;
  phase: number;
  phaseLabel: string;
  graduated: boolean;
  curveProgress: number;
  launchedAt: number;
  launchBlock: number;
  totalSupply: bigint;
  devBuyWei: bigint;
  devTokens: bigint;
  exemptions: string[];
}

export interface SourceTrade {
  kind: "buy" | "sell";
  wallet: string;
  quoteWei: bigint;
  tokens: bigint;
  taxWei: bigint;
  block: number;
}

export interface SourceTransfer {
  from: string;
  to: string;
  value: bigint;
  block: number;
}

export interface SourceHolders {
  top10Pct: number;
  holderCount: number;
  countIsFloor: boolean;
  source: string;
  complete: boolean;
  top: { wallet: string; balance: bigint }[];
}

export interface SourceEscrow {
  creditedWei: bigint;
  claims: { block: number; amountWei: bigint }[];
}

export interface GradeSource {
  launch: SourceLaunch;
  trades: SourceTrade[];
  transfers: SourceTransfer[];
  holders: SourceHolders;
  escrow: SourceEscrow;
  /** Current balances of the declared bundle, read directly when the fast
   *  transfer path is used; otherwise clarity replays them from transfers. */
  bundleBalances?: { wallet: string; balance: bigint }[];
  /** Unix seconds of the observation; fixtures pin it for determinism. */
  now: number;
  secPerBlock: number;
}

export interface CohortWallet {
  wallet: string;
  quoteInWei: bigint;
  taxBps: number;
  firstBuyBlock: number;
}

export interface Cohort {
  /** Wallets that qualify after exclusions; the scored set. */
  all: CohortWallet[];
  human: CohortWallet[];
  /** true when the human subset (>= 10 wallets) is the scored one. */
  scoredIsHuman: boolean;
  /** Cohort window actually used, seconds from launch. */
  windowSec: number;
  excluded: { infra: number; dev: number; bundle: number };
  bundleWallets: string[];
}

export const CHECKPOINTS = [
  { label: "5m", sec: 300, weight: 1 },
  { label: "15m", sec: 900, weight: 1 },
  { label: "1h", sec: 3600, weight: 2 },
  { label: "6h", sec: 21600, weight: 2 },
  { label: "24h", sec: 86400, weight: 3 },
  { label: "7d", sec: 604800, weight: 3 },
] as const;

export type CheckpointLabel = (typeof CHECKPOINTS)[number]["label"];

export interface Retention {
  /** Share (0..1) of the scored cohort still holding at each reached checkpoint. */
  held: Partial<Record<CheckpointLabel, number>>;
  /** First checkpoint where held dropped under 0.5; null while it has not happened. */
  halfLife: CheckpointLabel | null;
  /** True once all six checkpoints have passed. */
  allReached: boolean;
}

export interface Components {
  cut: number;
  clarity: number;
  color: number;
  carat: number;
  detail: {
    bundleHoldsPct: number;
    devSells: number;
    feeClaims24h: number;
    devBoughtPct: number;
    cohortQuoteWei: bigint;
    top3OfCohortPct: number;
  };
}

export interface CertificateReport {
  token: string;
  symbol: string;
  name: string;
  launchedAt: string;
  ageSec: number;
  tooEarly: boolean;
  grade: string;
  score: number;
  cut: { score: number; cohort: number; human: number; scoredIsHuman: boolean; held: Partial<Record<CheckpointLabel, number>>; halfLife: string };
  clarity: { score: number; top10Pct: number; bundleDeclared: number; bundleHoldsPct: number };
  color: { score: number; devBoughtPct: number; devSells: number; feesCreditedEth: number; feeClaims24h: number };
  carat: { score: number; holders: number; holdersIsFloor: boolean; cohortEth: number; top3Pct: number; pairIsEth: boolean };
  phase: string;
  holdersSource: string;
  source: string;
  observedAt: string;
  block: number;
  rpcCalls: number;
  ms: number;
}
