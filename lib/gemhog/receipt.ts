import { PROJECT_TOKEN, projectTokenLabel } from "./project-token.js";
import { pad, lpad, tokens as fmtTokens } from "./fmt.js";

/**
 * Holder-check rendering shared by the CLI and the site, plus the synthetic
 * example receipt. The example is invented solely to demonstrate the
 * interface and says EXAMPLE on every line.
 */

export interface GradedHolding {
  token: string;
  symbol: string;
  balance: bigint;
  pctOfSupply: number;
  grade: string | null;
  score: number | null;
}

export function renderHoldings(wallet: string, rows: GradedHolding[], markdown = false): string {
  const head = `holder check · ${wallet} · ${rows.length} pons token${rows.length === 1 ? "" : "s"}`;
  const table = [
    `${pad("GRADE", 11)}${lpad("SCORE", 5)}  ${pad("SYMBOL", 14)}${lpad("BALANCE", 10)}${lpad("% SUPPLY", 10)}  TOKEN`,
    ...rows.map((r) =>
      `${pad(r.grade ?? "…", 11)}${lpad(r.score === null ? "" : String(r.score), 5)}  ${pad(r.symbol.slice(0, 12), 14)}${lpad(fmtTokens(r.balance), 10)}${lpad(r.pctOfSupply.toFixed(3) + "%", 10)}  ${r.token}`,
    ),
  ];
  const project = PROJECT_TOKEN.address
    ? `official ${PROJECT_TOKEN.ticker}: ${PROJECT_TOKEN.address}`
    : `official ${PROJECT_TOKEN.ticker}: ${projectTokenLabel()} · the holder receipt activates at launch`;
  const body = [head, "", ...table, "", project].join("\n");
  return markdown ? ["```text", body, "```"].join("\n") : body;
}

export interface ExampleReceipt {
  example: true;
  wallet: string;
  ticker: string;
  balance: string;
  communityGrade: string;
  communityScore: number;
  cohortShare: string;
  note: string;
}

/** Every number here is invented; the wallet does not exist. */
export function exampleReceipt(): ExampleReceipt {
  return {
    example: true,
    wallet: "0x00000000000000000000000000000000ExampleHog",
    ticker: "$GEMHOG",
    balance: "1,250,000",
    communityGrade: "VVS2",
    communityScore: 82,
    cohortShare: "you are wallet 17 of 203 in the early cohort",
    note: "EXAMPLE · synthetic numbers to demonstrate the receipt · the live receipt activates at launch",
  };
}

export function renderExampleReceipt(receipt: ExampleReceipt): string {
  return [
    `EXAMPLE │ holder receipt · ${receipt.ticker}`,
    `EXAMPLE │`,
    `EXAMPLE │ wallet    ${receipt.wallet}`,
    `EXAMPLE │ balance   ${receipt.balance} ${receipt.ticker.slice(1)}`,
    `EXAMPLE │ community ${receipt.communityGrade}  ${receipt.communityScore} / 100`,
    `EXAMPLE │ cohort    ${receipt.cohortShare}`,
    `EXAMPLE │`,
    `EXAMPLE │ ${receipt.note}`,
  ].join("\n");
}
