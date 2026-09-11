import { test } from "node:test";
import assert from "node:assert/strict";
import { gradeAtLeast, huntToCsv, rankCandidates, renderHunt, toRow } from "../.gemhog-build/hunt.js";

const launch = (over = {}) => ({
  token: "0x1111111111111111111111111111111111111111",
  curve: "0x2222222222222222222222222222222222222222",
  deployer: "0x3333333333333333333333333333333333333333",
  block: 1000,
  txHash: "0x" + "ab".repeat(32),
  raisedWei: 10n ** 18n,
  graduated: false,
  launchedAt: 1_700_000_000,
  ...over,
});

test("rankCandidates keeps funded and graduated launches, best-funded first", () => {
  const dust = launch({ raisedWei: 10n ** 15n });
  const funded = launch({ raisedWei: 2n * 10n ** 18n });
  const richest = launch({ raisedWei: 5n * 10n ** 18n });
  const graduatedDust = launch({ raisedWei: 0n, graduated: true });
  const unreadable = launch({ launchedAt: 0 });
  const ranked = rankCandidates([dust, funded, richest, graduatedDust, unreadable]);
  assert.deepEqual(ranked.map((l) => l.raisedWei), [5n * 10n ** 18n, 2n * 10n ** 18n, 0n]);
});

test("gradeAtLeast orders the clarity scale", () => {
  assert.ok(gradeAtLeast("FL", "VS2"));
  assert.ok(gradeAtLeast("VS2", "VS2"));
  assert.ok(!gradeAtLeast("SI1", "VS2"));
  assert.ok(!gradeAtLeast("TOO EARLY", "VS2"));
});

const sampleResult = {
  window: "6h",
  launches: 1412,
  withBuyers: 388,
  graded: 61,
  incubating: 37,
  rows: [
    { rank: 1, grade: "VVS1", score: 87, symbol: "PEANUT", ageSec: 11520, cohort: 142, held1h: 0.84, dev: "held", top10Pct: 14.2, holders: 611, token: "0xa0c54ffbe2ea6f151468fd40d4281d807fc2f6b5" },
    { rank: 2, grade: "VS1", score: 74, symbol: "NOVA", ageSec: 18060, cohort: 204, held1h: 0.71, dev: "sold1", top10Pct: 22.5, holders: 902, token: "0x23c8000000000000000000000000000000001dc9" },
  ],
  byGrade: { VVS1: 1, VS1: 1 },
  vs2plus: 2,
  observedAt: "2026-09-11T12:00:00.000Z",
  rpcCalls: 300,
  ms: 76000,
  budgetHit: true,
};

test("the hunt table renders the spec shape", () => {
  const text = renderHunt(sampleResult);
  assert.ok(text.includes("gemhog hunt · window 6h · 1412 launches · 388 with buyers · 61 graded"));
  assert.ok(text.includes("VVS1"));
  assert.ok(text.includes("PEANUT"));
  assert.ok(text.includes("incubating (under 5m, no grade yet): 37"));
  assert.ok(text.includes("time budget reached"));
  assert.ok(renderHunt(sampleResult, true).startsWith("```text"));
});

test("csv export carries full addresses and one row per grade line", () => {
  const csv = huntToCsv(sampleResult);
  const lines = csv.split("\n");
  assert.equal(lines.length, 3);
  assert.ok(lines[0].startsWith("rank,grade,score"));
  assert.ok(lines[1].includes("0xa0c54ffbe2ea6f151468fd40d4281d807fc2f6b5"));
});

test("toRow compacts a certificate into a hunt row", () => {
  const row = toRow({
    grade: "VS2", score: 62, symbol: "911", ageSec: 725, token: "0xdead",
    cut: { cohort: 22, held: { "5m": 0.6, "15m": 0.41 } },
    color: { devSells: 0 },
    clarity: { top10Pct: 24.6 },
    carat: { holders: 38 },
  }, 2);
  assert.equal(row.rank, 2);
  assert.equal(row.held1h, 0.41); // falls back to the latest reached checkpoint
  assert.equal(row.dev, "held");
});
