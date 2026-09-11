import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = promisify(execFile);
const cli = new URL("../bin/gemhog.mjs", import.meta.url).pathname;

// Only offline commands run here; doctor talks to live providers and is
// exercised by hand and by the milestone gates, not by CI.

test("demo marks every line as DEMO", async () => {
  const { stdout } = await run("node", [cli, "demo"]);
  const lines = stdout.trimEnd().split("\n");
  assert.ok(lines.length > 5);
  for (const line of lines) assert.match(line, /^DEMO │/);
  assert.ok(stdout.includes("GRADE"));
});

test("demo --format json is a parseable synthetic report", async () => {
  const { stdout } = await run("node", [cli, "demo", "--format", "json"]);
  const report = JSON.parse(stdout);
  assert.equal(report.demo, true);
  assert.equal(report.grade, "VVS1");
  assert.equal(report.cut.score + report.clarity.score + report.color.score + report.carat.score, report.score);
});

test("demo --format markdown fences the output", async () => {
  const { stdout } = await run("node", [cli, "demo", "--format", "markdown"]);
  assert.ok(stdout.startsWith("```text"));
  assert.ok(stdout.includes("DEMO │"));
});

test("exports refuse to overwrite an existing file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gemhog-"));
  const file = join(dir, "demo.json");
  await run("node", [cli, "demo", "--format", "json", "--output", file]);
  const first = await readFile(file, "utf8");
  await assert.rejects(
    () => run("node", [cli, "demo", "--format", "json", "--output", file]),
    (error) => error.stderr.includes("refuse"),
  );
  assert.equal(await readFile(file, "utf8"), first);
});

test("exports save to a fresh file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gemhog-"));
  const file = join(dir, "demo.md");
  await run("node", [cli, "demo", "--format", "markdown", "--output", file]);
  assert.ok((await readFile(file, "utf8")).includes("DEMO │"));
});

test("unknown format is rejected", async () => {
  await assert.rejects(
    () => run("node", [cli, "demo", "--format", "yaml"]),
    (error) => error.stderr.includes("--format"),
  );
});

test("help lists the current commands", async () => {
  const { stdout } = await run("node", [cli, "--help"]);
  assert.ok(stdout.includes("doctor"));
  assert.ok(stdout.includes("demo"));
  assert.ok(stdout.includes("Read only"));
});
