import type { CertificateReport, CheckpointLabel } from "./grade/types.js";
import { CHECKPOINTS } from "./grade/types.js";
import { secToFirstCheckpoint } from "./grade/grade.js";
import { ago, pad } from "./fmt.js";

/**
 * The certificate, exactly as specified in GEMHOG_SPEC.md 2.6. One renderer
 * for the CLI, the site and the exports, so the text never drifts between
 * surfaces. Markdown is the same block fenced as text.
 */

const heldLine = (held: Partial<Record<CheckpointLabel, number>>): string =>
  CHECKPOINTS.filter((c) => held[c.label] !== undefined)
    .map((c) => `${c.label} ${Math.round((held[c.label] as number) * 100)}%`)
    .join(" · ");

export function renderCertificate(report: CertificateReport, markdown = false): string {
  const head = `$${report.symbol} · ${report.token} · launched ${report.launchedAt} · ${ago(0, report.ageSec)} ago`;

  if (report.tooEarly) {
    const wait = secToFirstCheckpoint(report.ageSec);
    const body = [
      head,
      "",
      "GRADE  TOO EARLY",
      "",
      `this token is ${Math.round(report.ageSec)}s old; the first checkpoint lands in ${wait}s.`,
      "run the check again once it does.",
      "",
      footer(report),
    ].join("\n");
    return markdown ? fence(body) : body;
  }

  const cohortNote = report.cut.scoredIsHuman ? "" : " · scored on the full cohort";
  const holders = `${report.carat.holders}${report.carat.holdersIsFloor ? "+" : ""} holders`;
  const quoteUnit = report.pairSymbol;
  const claims = report.color.feeClaims === 0
    ? "not claimed yet"
    : `claimed ${report.color.feeClaims}x (${report.color.feeClaims24h} in first 24h)`;
  const bundle = report.clarity.bundleDeclared > 0
    ? `bundle: ${report.clarity.bundleDeclared} declared, holds ${report.clarity.bundleHoldsPct.toFixed(1)}%`
    : "no bundle";
  const devSold = report.color.devSells === 0
    ? "dev has not sold"
    : `dev sold ${report.color.devSells === 1 ? "once" : `${report.color.devSells} times`}`;

  const body = [
    head,
    "",
    `GRADE  ${report.grade}   ${report.score} / 100`,
    "",
    `cut      ${pad(`${report.cut.score}/40`, 6)}  early cohort ${report.cut.cohort} wallets (${report.cut.human} human)${cohortNote} · still holding: ${heldLine(report.cut.held)}`,
    `                 half-life: ${report.cut.halfLife}`,
    `clarity  ${pad(`${report.clarity.score}/20`, 6)}  top 10 hold ${report.clarity.top10Pct.toFixed(1)}% · ${bundle}`,
    `color    ${pad(`${report.color.score}/20`, 6)}  dev bought ${report.color.devBoughtPct.toFixed(1)}% · ${devSold} · fees credited ${report.color.feesCredited.toFixed(2)} ${quoteUnit} · ${claims}`,
    `carat    ${pad(`${report.carat.score}/20`, 6)}  ${holders} · ${report.carat.cohortEth.toFixed(1)} ${quoteUnit} in the early cohort · top 3 of cohort ${Math.round(report.carat.top3Pct)}%`,
    "",
    footer(report),
  ].join("\n");
  return markdown ? fence(body) : body;
}

const footer = (report: CertificateReport): string =>
  `phase    ${pad(report.phase, 24)}source  ${report.source} · robinhood chain 4663 · ${report.rpcCalls} rpc calls · ${(report.ms / 1000).toFixed(1)}s`;

const fence = (body: string): string => ["```text", body, "```"].join("\n");
