/**
 * Synthetic walkthrough. Nothing here touches the network and every line of
 * output is marked DEMO; the numbers are invented solely to show the shape of
 * a certificate. The live engine lives in check.ts; this file never calls it.
 */

export interface DemoReport {
  demo: true;
  token: string;
  symbol: string;
  name: string;
  launchedAt: string;
  age: string;
  grade: string;
  score: number;
  cut: { score: number; cohort: number; human: number; held: Record<string, number>; halfLife: string };
  clarity: { score: number; top10Pct: number; bundle: boolean };
  color: { score: number; devBoughtPct: number; devSold: boolean; feesCreditedEth: number; claims: number };
  carat: { score: number; holders: number; cohortEth: number; top3Pct: number };
  phase: string;
  source: string;
}

/** Fixed synthetic numbers: reproducible output, stable tests. */
export function demoReport(): DemoReport {
  return {
    demo: true,
    token: "0x0000000000000000000000000000000000d3m000",
    symbol: "HOGSTONE",
    name: "Hogstone",
    launchedAt: "2026-09-11 08:14 UTC",
    age: "3h 12m",
    grade: "VVS1",
    score: 87,
    cut: { score: 34, cohort: 142, human: 117, held: { "5m": 0.96, "15m": 0.91, "1h": 0.84, "6h": 0.79 }, halfLife: "not reached" },
    clarity: { score: 16, top10Pct: 14.2, bundle: false },
    color: { score: 17, devBoughtPct: 2.1, devSold: false, feesCreditedEth: 0.41, claims: 0 },
    carat: { score: 20, holders: 611, cohortEth: 3.8, top3Pct: 22 },
    phase: "curve 74%",
    source: "DEMO · synthetic data, no network",
  };
}

export function renderDemo(report: DemoReport, markdown = false): string {
  const held = Object.entries(report.cut.held).map(([t, v]) => `${t} ${Math.round(v * 100)}%`).join(" · ");
  const lines = [
    `$${report.symbol} · ${report.token} · launched ${report.launchedAt} · ${report.age} ago`,
    "",
    `GRADE  ${report.grade}   ${report.score} / 100`,
    "",
    `cut      ${report.cut.score}/40   early cohort ${report.cut.cohort} wallets (${report.cut.human} human) · still holding: ${held}`,
    `                 half-life: ${report.cut.halfLife}`,
    `clarity  ${report.clarity.score}/20   top 10 hold ${report.clarity.top10Pct}% · ${report.clarity.bundle ? "bundle detected" : "no bundle"}`,
    `color    ${report.color.score}/20   dev bought ${report.color.devBoughtPct}% · dev has not sold · fees credited ${report.color.feesCreditedEth} ETH, ${report.color.claims} claims`,
    `carat    ${report.carat.score}/20   ${report.carat.holders} holders · ${report.carat.cohortEth} ETH in the early cohort · top 3 of cohort ${report.carat.top3Pct}%`,
    "",
    `phase    ${report.phase}                    source  ${report.source}`,
    "",
    "synthetic walkthrough · run gemhog check <token> for a live certificate",
  ];
  // Every line carries the DEMO mark so no excerpt can pass as live chain data.
  const marked = lines.map((l) => (l ? `DEMO │ ${l}` : "DEMO │")).join("\n");
  return markdown ? ["```text", marked, "```"].join("\n") : marked;
}
