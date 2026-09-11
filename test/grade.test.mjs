import { test } from "node:test";
import assert from "node:assert/strict";
import { loadFixture } from "./helpers.mjs";
import { assembleCertificate, gradeFor, gradeTone } from "../.gemhog-build/grade/grade.js";
import { clarityScore, colorScore, cutScore } from "../.gemhog-build/grade/components.js";

// The three fixtures are hand-derived: every expected number below was
// computed from the formulas in GEMHOG_SPEC.md 2.4 before the code ran.

test("vvs1 fixture: strong retention grades VVS1 87", () => {
  const report = assembleCertificate(loadFixture("vvs1"));
  assert.equal(report.cut.score, 34);
  assert.equal(report.clarity.score, 20);
  assert.equal(report.color.score, 20);
  assert.equal(report.carat.score, 13);
  assert.equal(report.score, 87);
  assert.equal(report.grade, "VVS1");
  assert.equal(report.cut.halfLife, "not reached");
  assert.equal(report.cut.cohort, 25);
  assert.equal(report.cut.scoredIsHuman, true);
});

test("si2 fixture: heavy dumping grades SI2 with an early half-life", () => {
  const report = assembleCertificate(loadFixture("si2"));
  assert.equal(report.cut.score, 14); // held .65/.40/.30/.20, weighted
  assert.equal(report.grade, "SI2");
  assert.equal(report.score, 47);
  assert.equal(report.cut.halfLife, "15m");
});

test("i2 fixture: dev dump, bundle and claims grade I2", () => {
  const report = assembleCertificate(loadFixture("i2"));
  assert.equal(report.color.devSells, 1);
  assert.equal(report.color.feeClaims24h, 1);
  assert.equal(report.clarity.score, 0); // 42% top10 minus the bundle penalty
  assert.equal(report.clarity.bundleDeclared, 2);
  assert.ok(report.clarity.bundleHoldsPct > 10);
  assert.equal(report.cut.scoredIsHuman, false); // 5 humans of 20: whole cohort scored
  assert.equal(report.score, 23);
  assert.equal(report.grade, "I2");
});

test("too early: under 5 minutes yields TOO EARLY and no score", () => {
  const fixture = loadFixture("vvs1");
  fixture.now = fixture.launch.launchedAt + 120;
  const report = assembleCertificate(fixture);
  assert.equal(report.tooEarly, true);
  assert.equal(report.grade, "TOO EARLY");
  assert.equal(report.score, 0);
});

test("retention at exactly 0.5 is not a half-life", () => {
  // held < 0.5 triggers; held == 0.5 does not.
  assert.equal(cutScore({ held: { "5m": 0.5 }, halfLife: null, allReached: false }), Math.round((40 * 0.5 * 1) / 1));
});

test("grade bands match the spec table", () => {
  assert.equal(gradeFor(100), "FL");
  assert.equal(gradeFor(95), "FL");
  assert.equal(gradeFor(94), "IF");
  assert.equal(gradeFor(85), "VVS1");
  assert.equal(gradeFor(84), "VVS2");
  assert.equal(gradeFor(79), "VS1");
  assert.equal(gradeFor(60), "VS2");
  assert.equal(gradeFor(59), "SI1");
  assert.equal(gradeFor(40), "SI2");
  assert.equal(gradeFor(39), "I1");
  assert.equal(gradeFor(24), "I2");
  assert.equal(gradeFor(9), "I3");
  assert.equal(gradeTone("IF"), "vvs");
  assert.equal(gradeTone("VS2"), "vs");
  assert.equal(gradeTone("SI1"), "si");
  assert.equal(gradeTone("I3"), "i");
});

test("clarity bands and bundle penalty", () => {
  assert.equal(clarityScore(10, 0), 20);
  assert.equal(clarityScore(25, 0), 14); // 20 - 5*1.2
  assert.equal(clarityScore(40, 0), 4); // 8 - 10*0.4
  assert.equal(clarityScore(60, 0), 0);
  assert.equal(clarityScore(10, 11), 15); // -5 when the bundle holds > 10%
});

test("color: a dev who never bought is not penalized", () => {
  assert.equal(colorScore({ devSells: 0, feeClaims24h: 0, devBoughtPct: 0 }), 20);
  assert.equal(colorScore({ devSells: 1, feeClaims24h: 0, devBoughtPct: 0 }), 12);
  assert.equal(colorScore({ devSells: 2, feeClaims24h: 0, devBoughtPct: 0 }), 0);
  assert.equal(colorScore({ devSells: 0, feeClaims24h: 3, devBoughtPct: 0 }), 12); // claims cap at -8
  assert.equal(colorScore({ devSells: 0, feeClaims24h: 0, devBoughtPct: 9 }), 14);
});
