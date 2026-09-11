#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { Command } from "commander";

// The CLI is a thin shell: every answer comes from the compiled engine in
// .gemhog-build (source: lib/gemhog). Run `pnpm build:cli` once after cloning.

const FORMATS = ["text", "json", "markdown"];

async function engine(module) {
  try {
    return await import(`../.gemhog-build/${module}.js`);
  } catch (error) {
    if (error.code === "ERR_MODULE_NOT_FOUND") {
      process.stderr.write("gemhog: run pnpm build:cli before using the CLI\n");
      process.exit(1);
    }
    throw error;
  }
}

/** Print, or save exclusively; exports never overwrite an existing file. */
async function deliver(text, file) {
  if (!file) {
    process.stdout.write(text + "\n");
    return;
  }
  try {
    await writeFile(file, text + "\n", { flag: "wx" });
    process.stdout.write(`saved to ${file}\n`);
  } catch (error) {
    if (error.code === "EEXIST") {
      process.stderr.write(`gemhog: ${file} already exists; exports refuse to overwrite\n`);
      process.exit(1);
    }
    throw error;
  }
}

function checkFormat(format) {
  if (!FORMATS.includes(format)) {
    process.stderr.write("gemhog: use --format text, json or markdown\n");
    process.exit(1);
  }
}

const program = new Command();
program
  .name("gemhog")
  .description("Diamond-hands terminal for Pons V2 tokens on Robinhood Chain. Read only: no keys, no signing, no transactions.")
  .version("0.2.0");

program
  .command("doctor")
  .description("check every source: RPC endpoints, pons factory addresses, opening-tax parameters, Pons API, Blockscout, DexScreener")
  .option("--format <format>", "text, json or markdown", "text")
  .option("--output <file>", "save the report; never overwrites an existing file")
  .action(async (opts) => {
    checkFormat(opts.format);
    const { loadEnv } = await engine("env");
    loadEnv();
    const { runDoctor, renderDoctor } = await engine("doctor");
    const report = await runDoctor();
    const text = opts.format === "json" ? JSON.stringify(report, null, 2) : renderDoctor(report, opts.format === "markdown");
    await deliver(text, opts.output);
    if (!report.ok) process.exitCode = 2;
  });

program
  .command("check")
  .alias("grade")
  .argument("<token>", "0x contract address or ticker")
  .description("grade one token: early-cohort retention, concentration, dev behaviour, weight; the diamond-clarity certificate")
  .option("--format <format>", "text, json or markdown", "text")
  .option("--output <file>", "save the certificate; never overwrites an existing file")
  .action(async (input, opts) => {
    checkFormat(opts.format);
    const { loadEnv } = await engine("env");
    loadEnv();
    const { resolveInput, enrichCluster } = await engine("resolve");
    const resolved = await resolveInput(input);
    if (resolved.kind === "none") {
      process.stderr.write(`gemhog: ${resolved.note}\n`);
      process.exit(1);
    }
    if (resolved.kind === "cluster") {
      const { pad, ago } = await engine("fmt");
      const rows = await enrichCluster(resolved.cluster);
      const table = [
        resolved.note,
        "",
        `${pad("SYMBOL", 12)}${pad("AGE", 10)}${pad("PHASE", 8)}${pad("HOLDERS", 9)}TOKEN`,
        ...rows.map((r) => `${pad(r.symbol, 12)}${pad(ago(0, r.ageSec), 10)}${pad(r.phase, 8)}${pad(r.holders, 9)}${r.token}`),
        "",
        "run again with the contract address: gemhog check 0x…",
      ].join("\n");
      if (opts.format === "json") await deliver(JSON.stringify({ cluster: rows.map((r) => ({ ...r })) }, null, 2), opts.output);
      else await deliver(opts.format === "markdown" ? ["```text", table, "```"].join("\n") : table, opts.output);
      return;
    }
    const { checkToken, CheckError } = await engine("check");
    const { renderCertificate } = await engine("certificate");
    try {
      const report = await checkToken(resolved.token);
      const text = opts.format === "json" ? JSON.stringify(report, null, 2) : renderCertificate(report, opts.format === "markdown");
      await deliver(text, opts.output);
    } catch (error) {
      if (error instanceof CheckError) {
        process.stderr.write(`gemhog: ${error.message}\n`);
        process.exit(1);
      }
      throw error;
    }
  });

program
  .command("demo")
  .description("synthetic certificate walkthrough; every line is marked DEMO and nothing touches the network")
  .option("--format <format>", "text, json or markdown", "text")
  .option("--output <file>", "save the output; never overwrites an existing file")
  .action(async (opts) => {
    checkFormat(opts.format);
    const { demoReport, renderDemo } = await engine("demo");
    const report = demoReport();
    const text = opts.format === "json" ? JSON.stringify(report, null, 2) : renderDemo(report, opts.format === "markdown");
    await deliver(text, opts.output);
  });

program.parseAsync().catch((error) => {
  // Strip control characters so provider errors cannot draw over the terminal.
  process.stderr.write(`gemhog: ${String(error.message).replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")}\n`);
  process.exit(1);
});
