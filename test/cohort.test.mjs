import { test } from "node:test";
import assert from "node:assert/strict";
import { loadFixture } from "./helpers.mjs";
import { buildCohort } from "../.gemhog-build/grade/cohort.js";

test("cohort excludes the deployer, the fee recipient and the declared bundle", () => {
  const fixture = loadFixture("i2");
  const cohort = buildCohort(fixture);
  assert.equal(cohort.excluded.bundle, 2);
  const wallets = new Set(cohort.all.map((w) => w.wallet.toLowerCase()));
  for (const exempt of fixture.launch.exemptions) assert.ok(!wallets.has(exempt.toLowerCase()));
  assert.ok(!wallets.has(fixture.launch.deployer.toLowerCase()));
});

test("human subset splits on the opening tax at 15%", () => {
  const cohort = buildCohort(loadFixture("i2"));
  assert.equal(cohort.all.length, 20);
  assert.equal(cohort.human.length, 5);
  assert.equal(cohort.scoredIsHuman, false); // fewer than 10 humans: score the full cohort
});

test("a quiet launch widens to the first 20 buyers", () => {
  const fixture = loadFixture("vvs1");
  // Push all but 6 buys past the first minute but inside 10 minutes.
  fixture.trades = fixture.trades.map((t, i) =>
    t.kind === "buy" && i >= 6 ? { ...t, block: fixture.launch.launchBlock + 700 + i * 10 } : t,
  );
  const cohort = buildCohort(fixture);
  assert.equal(cohort.windowSec, 600);
  assert.equal(cohort.all.length, 20);
});

test("one wallet buying twice counts once, at its first buy", () => {
  const fixture = loadFixture("vvs1");
  const first = fixture.trades.find((t) => t.kind === "buy");
  fixture.trades.push({ ...first, block: first.block + 100 });
  const cohort = buildCohort(fixture);
  const entries = cohort.all.filter((w) => w.wallet === first.wallet);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].firstBuyBlock, first.block);
});
