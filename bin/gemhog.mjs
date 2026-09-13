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
  .version("0.8.5");

program
  .command("doctor")
  .description("check every source: RPC endpoints, pons factory addresses, opening-tax parameters, Pons API, Blockscout, DexScreener")
  .option("--probe", "additionally grade the known example token end to end")
  .option("--format <format>", "text, json or markdown", "text")
  .option("--output <file>", "save the report; never overwrites an existing file")
  .action(async (opts) => {
    checkFormat(opts.format);
    const { loadEnv } = await engine("env");
    loadEnv();
    const { runDoctor, renderDoctor, EXAMPLE_TOKEN } = await engine("doctor");
    const report = await runDoctor();
    let probe = null;
    if (opts.probe) {
      if (opts.format === "text" && !opts.output) process.stderr.write("probe: grading the example token end to end…\n");
      const { checkToken } = await engine("check");
      try {
        const cert = await checkToken(EXAMPLE_TOKEN);
        probe = { ok: true, grade: cert.grade, score: cert.score, symbol: cert.symbol, rpcCalls: cert.rpcCalls, ms: cert.ms };
      } catch (error) {
        probe = { ok: false, error: String(error.message).slice(0, 120) };
        process.exitCode = 2;
      }
    }
    if (opts.format === "json") {
      await deliver(JSON.stringify(probe ? { ...report, probe } : report, null, 2), opts.output);
    } else {
      let text = renderDoctor(report, opts.format === "markdown");
      if (probe) {
        const line = probe.ok
          ? `probe   full check of $${probe.symbol}: ${probe.grade} ${probe.score}/100 · ${probe.rpcCalls} rpc calls · ${(probe.ms / 1000).toFixed(1)}s`
          : `probe   FAILED: ${probe.error}`;
        text = opts.format === "markdown" ? text.replace(/\n```$/, `\n${line}\n\`\`\``) : `${text}\n${line}`;
      }
      await deliver(text, opts.output);
    }
    if (!report.ok) process.exitCode = 2;
  });

program
  .command("check")
  .alias("grade")
  .argument("<token>", "0x contract address or ticker")
  .description("grade one token: early-cohort retention, concentration, dev behaviour, weight; the diamond-clarity certificate")
  .option("--format <format>", "text, json or markdown", "text")
  .option("--output <file>", "save the certificate; never overwrites an existing file")
  .option("--card <file>", "also render the 1080x1080 share card as PNG; never overwrites an existing file")
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
      if (opts.card) {
        if (report.tooEarly) {
          process.stderr.write("gemhog: no card for a token under 5 minutes; the card unlocks at 5m\n");
          process.exit(1);
        }
        const { renderCard } = await engine("card");
        const { fetchTokenLogo } = await engine("read/logo");
        const logo = await fetchTokenLogo(resolved.token);
        const buf = await renderCard(report, { logo: logo ?? undefined });
        try {
          await writeFile(opts.card, buf, { flag: "wx" });
          process.stdout.write(`card saved to ${opts.card}\n`);
        } catch (error) {
          if (error.code === "EEXIST") {
            process.stderr.write(`gemhog: ${opts.card} already exists; exports refuse to overwrite\n`);
            process.exit(1);
          }
          throw error;
        }
      }
    } catch (error) {
      if (error instanceof CheckError) {
        process.stderr.write(`gemhog: ${error.message}\n`);
        process.exit(1);
      }
      throw error;
    }
  });

const parseWindow = async (raw) => {
  const { WINDOWS } = await engine("hunt");
  if (!WINDOWS[raw]) {
    process.stderr.write(`gemhog: unknown window ${raw}; use one of ${Object.keys(WINDOWS).join(", ")}\n`);
    process.exit(1);
  }
  return { windowSec: WINDOWS[raw], windowLabel: raw };
};

program
  .command("hunt")
  .description("dig through every launch in a window, grade the funded ones, keep the stones; the flagship, and it lives only in the CLI")
  .option("--window <window>", "1h, 3h, 6h, 12h or 24h", "6h")
  .option("--min-grade <grade>", "hide rows below this grade (e.g. VS2)")
  .option("--top <n>", "rows to keep", "20")
  .option("--budget <seconds>", "time budget for grading, best-funded first", "75")
  .option("--follow", "keep digging: re-grade as checkpoints pass, print new top entries, alert VS1+ when Telegram is configured")
  .option("--format <format>", "text, json or markdown", "text")
  .option("--output <file>", "save the table; never overwrites an existing file")
  .action(async (opts) => {
    checkFormat(opts.format);
    const { loadEnv } = await engine("env");
    loadEnv();
    const { runHunt, renderHunt, gradeAtLeast } = await engine("hunt");
    const { saveHunt, appendAlert } = await engine("state");
    const window = await parseWindow(opts.window);
    const progress = opts.format === "text" && !opts.output ? (msg) => process.stderr.write(msg + "\n") : undefined;
    const huntOptions = {
      ...window,
      minGrade: opts.minGrade,
      top: Number(opts.top) || 20,
      budgetMs: (Number(opts.budget) || 75) * 1000,
      onProgress: progress,
    };
    const { result } = await runHunt(huntOptions);
    saveHunt(result);
    const text = opts.format === "json" ? JSON.stringify(result, null, 2) : renderHunt(result, opts.format === "markdown");
    await deliver(text, opts.output);

    if (!opts.follow) return;
    const { alertsConfigured, sendAlert } = await engine("alerts");
    const { short } = await engine("fmt");
    const alerted = new Set();
    const known = new Map(result.rows.map((r) => [r.token.toLowerCase(), r.score]));
    process.stderr.write(`following · re-digging every 2 minutes · alerts ${alertsConfigured() ? "on" : "off (no telegram token)"} · ctrl-c to stop\n`);
    for (;;) {
      await new Promise((r) => setTimeout(r, 120_000));
      try {
        const { result: next } = await runHunt({ ...huntOptions, budgetMs: 45_000, onProgress: undefined });
        saveHunt(next);
        for (const row of next.rows) {
          const key = row.token.toLowerCase();
          const prev = known.get(key);
          if (prev === undefined || row.score !== prev) {
            process.stdout.write(`${new Date().toISOString().slice(11, 19)}  ${prev === undefined ? "enters top" : "re-graded"}  ${row.grade} ${row.score}  $${row.symbol}  ${short(row.token)}\n`);
          }
          known.set(key, row.score);
          if (gradeAtLeast(row.grade, "VS1") && !alerted.has(key)) {
            alerted.add(key);
            appendAlert({ at: new Date().toISOString(), grade: row.grade, score: row.score, symbol: row.symbol, token: row.token });
            if (alertsConfigured()) await sendAlert(`GEMHOG ${row.grade} ${row.score}/100 $${row.symbol}\n${row.token}`);
          }
        }
      } catch (error) {
        process.stderr.write(`follow cycle failed, retrying: ${String(error.message).slice(0, 80)}\n`);
      }
    }
  });

program
  .command("watch")
  .argument("<token>", "0x contract address")
  .description("re-grade one token every 30 seconds and print only what changed")
  .action(async (token) => {
    const { loadEnv } = await engine("env");
    loadEnv();
    const { checkToken, CheckError } = await engine("check");
    const { renderCertificate } = await engine("certificate");
    let prev = null;
    process.stderr.write("watching · ctrl-c to stop\n");
    for (;;) {
      try {
        const report = await checkToken(token, { holdersVia: "transfers" });
        const ts = new Date().toISOString().slice(11, 19);
        if (!prev) {
          process.stdout.write(renderCertificate(report) + "\n");
        } else {
          const changes = [];
          if (report.grade !== prev.grade) changes.push(`grade ${prev.grade} to ${report.grade}`);
          if (report.score !== prev.score) changes.push(`score ${prev.score} to ${report.score}`);
          if (report.carat.holders !== prev.carat.holders) changes.push(`holders ${prev.carat.holders} to ${report.carat.holders}`);
          if (report.color.devSells !== prev.color.devSells) changes.push(`dev sells ${prev.color.devSells} to ${report.color.devSells}`);
          if (changes.length) process.stdout.write(`${ts}  ${changes.join(" · ")}\n`);
        }
        prev = report;
      } catch (error) {
        if (error instanceof CheckError) {
          process.stderr.write(`gemhog: ${error.message}\n`);
          process.exit(1);
        }
        process.stderr.write(`watch read failed, retrying: ${String(error.message).slice(0, 80)}\n`);
      }
      await new Promise((r) => setTimeout(r, 30_000));
    }
  });

program
  .command("top")
  .description("the current top from the last hunt (re-digs briefly when the cache is stale); made for the bot")
  .option("--window <window>", "window to dig when the cache is stale", "6h")
  .option("--format <format>", "text, json or markdown", "text")
  .option("--output <file>", "save the table; never overwrites an existing file")
  .action(async (opts) => {
    checkFormat(opts.format);
    const { loadEnv } = await engine("env");
    loadEnv();
    const { loadHunt, saveHunt } = await engine("state");
    const { runHunt, renderHunt } = await engine("hunt");
    let result = loadHunt();
    const fresh = result && Date.now() - Date.parse(result.observedAt) < 20 * 60_000;
    if (!fresh) {
      const window = await parseWindow(opts.window);
      ({ result } = await runHunt({ ...window, top: 10, budgetMs: 30_000 }));
      saveHunt(result);
    }
    result = { ...result, rows: result.rows.slice(0, 10) };
    const text = opts.format === "json" ? JSON.stringify(result, null, 2) : renderHunt(result, opts.format === "markdown");
    await deliver(text, opts.output);
  });

program
  .command("serve")
  .description("local JSON API for the Telegram bot: /check/:token /top /holders/:wallet /alerts?since= /health; binds to 127.0.0.1 only")
  .option("--port <port>", "port to listen on", "4664")
  .action(async (opts) => {
    const { loadEnv } = await engine("env");
    loadEnv();
    const { startServe } = await engine("serve");
    const { port } = await startServe(Number(opts.port) || 4664);
    process.stderr.write(`gemhog serve · http://127.0.0.1:${port} · routes: /check/:token /top /holders/:wallet /alerts?since= /health · ctrl-c to stop\n`);
    await new Promise(() => {});
  });

program
  .command("export")
  .description("the last hunt as CSV or JSON")
  .option("--format <format>", "csv or json", "csv")
  .option("--output <file>", "save the export; never overwrites an existing file")
  .action(async (opts) => {
    if (!["csv", "json"].includes(opts.format)) {
      process.stderr.write("gemhog: use --format csv or json\n");
      process.exit(1);
    }
    const { loadHunt, huntStatePath } = await engine("state");
    const { huntToCsv } = await engine("hunt");
    const result = loadHunt();
    if (!result) {
      process.stderr.write(`gemhog: no hunt to export yet; run gemhog hunt first (state lives at ${huntStatePath()})\n`);
      process.exit(1);
    }
    await deliver(opts.format === "json" ? JSON.stringify(result, null, 2) : huntToCsv(result), opts.output);
  });

program
  .command("holders")
  .argument("<wallet>", "public EVM address")
  .description("every pons token a wallet holds, each with its grade; the same view as /holders on the site")
  .option("--format <format>", "text, json or markdown", "text")
  .option("--output <file>", "save the table; never overwrites an existing file")
  .action(async (wallet, opts) => {
    checkFormat(opts.format);
    const { loadEnv } = await engine("env");
    loadEnv();
    const { readWalletTokens, WalletListError } = await engine("read/wallet");
    const { checkToken } = await engine("check");
    const { renderHoldings } = await engine("receipt");
    let tokens;
    try {
      tokens = await readWalletTokens(wallet);
    } catch (error) {
      if (error instanceof WalletListError) {
        process.stderr.write(`gemhog: ${error.message}\n`);
        process.exit(1);
      }
      throw error;
    }
    if (!tokens.length) {
      process.stdout.write(`no pons tokens on ${wallet}\n`);
      return;
    }
    if (opts.format === "text" && !opts.output) {
      process.stderr.write(`${tokens.length} pons tokens on ${wallet}; grading each in turn…\n`);
    }
    const rows = [];
    for (const t of tokens) {
      let grade = null;
      let score = null;
      try {
        const report = await checkToken(t.token);
        grade = report.grade;
        score = report.tooEarly ? null : report.score;
      } catch {
        grade = "unreadable";
      }
      rows.push({ token: t.token, symbol: t.symbol, balance: t.balance, pctOfSupply: t.pctOfSupply, grade, score });
      if (opts.format === "text" && !opts.output) process.stderr.write(`  ${grade ?? "?"}  $${t.symbol}\n`);
    }
    const text = opts.format === "json"
      ? JSON.stringify({ wallet, holdings: rows.map((r) => ({ ...r, balance: r.balance.toString() })) }, null, 2)
      : renderHoldings(wallet, rows, opts.format === "markdown");
    await deliver(text, opts.output);
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
