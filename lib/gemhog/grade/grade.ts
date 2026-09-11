import { buildCohort } from "./cohort.js";
import { computeRetention } from "./checkpoints.js";
import { computeComponents } from "./components.js";
import type { CertificateReport, GradeSource } from "./types.js";
import { CHECKPOINTS } from "./types.js";
import { iso } from "../fmt.js";

/** Score bands on the diamond clarity scale. Exact per GEMHOG_SPEC.md 2.5. */
const BANDS: [number, string][] = [
  [95, "FL"], [90, "IF"], [85, "VVS1"], [80, "VVS2"],
  [70, "VS1"], [60, "VS2"], [50, "SI1"], [40, "SI2"],
  [25, "I1"], [10, "I2"], [0, "I3"],
];

export const gradeFor = (score: number): string => BANDS.find(([floor]) => score >= floor)![1];

/** Grade color families for the UI: VVS2 and better pink, VS white, SI gray, I dim. */
export const gradeTone = (grade: string): "vvs" | "vs" | "si" | "i" =>
  grade === "FL" || grade === "IF" || grade.startsWith("VVS") ? "vvs"
    : grade.startsWith("VS") ? "vs"
      : grade.startsWith("SI") ? "si" : "i";

export const TOO_EARLY_SEC = 300;

/**
 * The whole pipeline as one pure function: a GradeSource in, a certificate
 * out. IO fills in provenance (block, rpcCalls, ms) afterwards.
 */
export function assembleCertificate(source: GradeSource): CertificateReport {
  const { launch, now } = source;
  const ageSec = Math.max(0, now - launch.launchedAt);
  const tooEarly = ageSec < TOO_EARLY_SEC;

  const cohort = buildCohort(source);
  const retention = computeRetention(source, cohort);
  const components = computeComponents(source, cohort, retention);
  const score = tooEarly ? 0 : components.cut + components.clarity + components.color + components.carat;

  const halfLife = retention.halfLife ?? (retention.allReached ? "never" : "not reached");
  const phase = launch.graduated || launch.phase === 2
    ? "pool"
    : `curve ${Math.round(launch.curveProgress * 100)}% → pool`;

  return {
    token: launch.token,
    symbol: launch.symbol,
    name: launch.name,
    launchedAt: iso(launch.launchedAt),
    ageSec,
    tooEarly,
    grade: tooEarly ? "TOO EARLY" : gradeFor(score),
    score,
    cut: {
      score: components.cut,
      cohort: cohort.all.length,
      human: cohort.human.length,
      scoredIsHuman: cohort.scoredIsHuman,
      held: retention.held,
      halfLife,
    },
    clarity: {
      score: components.clarity,
      top10Pct: source.holders.top10Pct,
      bundleDeclared: cohort.bundleWallets.length,
      bundleHoldsPct: components.detail.bundleHoldsPct,
    },
    color: {
      score: components.color,
      devBoughtPct: components.detail.devBoughtPct,
      devSells: components.detail.devSells,
      feesCreditedEth: Number(source.escrow.creditedWei) / 1e18,
      feeClaims24h: components.detail.feeClaims24h,
    },
    carat: {
      score: components.carat,
      holders: source.holders.holderCount,
      holdersIsFloor: source.holders.countIsFloor,
      cohortEth: Number(components.detail.cohortQuoteWei) / 1e18,
      top3Pct: components.detail.top3OfCohortPct,
      pairIsEth: launch.pairIsEth,
    },
    phase,
    holdersSource: source.holders.source,
    source: "live",
    observedAt: new Date(now * 1000).toISOString(),
    block: 0,
    rpcCalls: 0,
    ms: 0,
  };
}

/** Seconds until the first checkpoint, for the TOO EARLY line. */
export const secToFirstCheckpoint = (ageSec: number): number => Math.max(0, CHECKPOINTS[0].sec - ageSec);
