import { test } from "node:test";
import assert from "node:assert/strict";
import { exampleReceipt, renderExampleReceipt, renderHoldings } from "../.gemhog-build/receipt.js";

test("the example receipt marks every line EXAMPLE", () => {
  const text = renderExampleReceipt(exampleReceipt());
  for (const line of text.split("\n")) assert.match(line, /^EXAMPLE │/);
  assert.ok(text.includes("synthetic"));
});

test("holdings table renders grades, balances and the TBA project line", () => {
  const text = renderHoldings("0x9f154A743f79819965E190475960462423Ff3185", [
    { token: "0xaC79255f6F404EBA14F316e8669D76573A2D7b1E", symbol: "COPY", balance: 360440n * 10n ** 18n, pctOfSupply: 0.036, grade: "I1", score: 35 },
    { token: "0x91da2b31Cc0000000000000000000000000000aa", symbol: "PONS", balance: 800000n * 10n ** 18n, pctOfSupply: 0.08, grade: null, score: null },
  ]);
  assert.ok(text.includes("2 pons tokens"));
  assert.ok(text.includes("I1"));
  assert.ok(text.includes("360.4K"));
  assert.ok(text.includes("$GEMHOG: TBA"));
  const markdown = renderHoldings("0xabc", [], true);
  assert.ok(markdown.startsWith("```text"));
});
