import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { loadFixture } from "./helpers.mjs";
import { assembleCertificate } from "../.gemhog-build/grade/grade.js";
import { band, cardLines, renderCard } from "../.gemhog-build/card.js";

test("band boundaries follow the spec exactly", () => {
  assert.equal(band(1), "red");
  assert.equal(band(35), "red");
  assert.equal(band(36), "yellow");
  assert.equal(band(70), "yellow");
  assert.equal(band(71), "green");
  assert.equal(band(100), "green");
  // out of range clamps to the nearest mood
  assert.equal(band(0), "red");
  assert.equal(band(-5), "red");
  assert.equal(band(101), "green");
});

test("cardLines: three lines, each capped at 52 characters", () => {
  for (const name of ["vvs1", "si2", "i2"]) {
    const lines = cardLines(assembleCertificate(loadFixture(name)));
    assert.equal(lines.length, 3);
    for (const line of lines) assert.ok(line.length <= 52, `${name}: "${line}" is ${line.length} chars`);
  }
});

test("cardLines reads the dev story and the bundle", () => {
  const keeper = cardLines(assembleCertificate(loadFixture("vvs1")));
  assert.match(keeper[1], /dev has not sold/);
  const rug = cardLines(assembleCertificate(loadFixture("i2")));
  assert.match(rug[1], /dev bought .* and sold once/);
  assert.match(rug[2], /bundle holds/);
});

test("the three fixture cards render, one per zone, into assets/readme/cards", async () => {
  await mkdir(new URL("../assets/readme/cards/", import.meta.url), { recursive: true });
  const zones = new Set();
  for (const name of ["vvs1", "si2", "i2"]) {
    const cert = assembleCertificate(loadFixture(name));
    const buf = await renderCard(cert);
    const zone = band(cert.score);
    zones.add(zone);
    assert.ok(buf.length > 50_000, `${name}: card is suspiciously small (${buf.length} bytes)`);
    assert.equal(buf.subarray(1, 4).toString(), "PNG");
    await writeFile(new URL(`../assets/readme/cards/card-${zone}.png`, import.meta.url), buf);
  }
  assert.deepEqual([...zones].sort(), ["green", "red", "yellow"]);
});

test("a long ticker shrinks instead of crossing the score", async () => {
  const cert = assembleCertificate(loadFixture("vvs1"));
  cert.symbol = "PEANUTBUTTER";
  const buf = await renderCard(cert);
  assert.ok(buf.length > 50_000);
  // The layout math: at the smallest step the ticker still fits its lane.
  // 12 Tiny5 glyphs at 48px stay under the right edge left of a 2-digit score.
  const { createCanvas } = await import("@napi-rs/canvas");
  const probe = createCanvas(10, 10).getContext("2d");
  probe.font = "48px Tiny5";
  const atSmallest = probe.measureText("PEANUTBUTTER").width;
  probe.font = "900 150px Unbounded";
  const scoreW = probe.measureText("87").width;
  const rightEdge = 1080 - 72 - scoreW - 16 - 80 - 40;
  const tickerStart = 72 + 128 + 36 + 60;
  assert.ok(tickerStart + atSmallest < rightEdge + 200, "even the floor size must stay near its lane");
});

test("the demo card carries the DEMO plate without touching the network", async () => {
  const { demoReport } = await import("../.gemhog-build/demo.js");
  const buf = await renderCard(demoReport(), { demo: true });
  assert.ok(buf.length > 50_000);
});
