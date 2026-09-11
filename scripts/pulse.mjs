#!/usr/bin/env node
import { writeFile } from "node:fs/promises";

/**
 * Writes assets/pulse.json: grade counters for the last 6 hours, refreshed by
 * .github/workflows/pulse.yml every 20 minutes. Counters and the grade
 * distribution only — never token addresses; the list lives in the CLI.
 */
const { runHunt } = await import("../.gemhog-build/hunt.js");

const { result } = await runHunt({ windowSec: 21_600, windowLabel: "6h", top: 0, budgetMs: 60_000 });
const pulse = {
  generatedAt: result.observedAt,
  window: result.window,
  launches: result.launches,
  withBuyers: result.withBuyers,
  graded: result.graded,
  byGrade: result.byGrade,
  vs2plus: result.vs2plus,
};
await writeFile(new URL("../assets/pulse.json", import.meta.url), JSON.stringify(pulse, null, 2) + "\n");
console.log(`pulse: ${pulse.launches} launches · ${pulse.graded} graded · ${pulse.vs2plus} at VS2+ · ${(result.ms / 1000).toFixed(1)}s`);
