#!/usr/bin/env node
/**
 * Renders the README terminal views as SVG from real command output.
 *
 * Nothing here is drawn by hand: `doctor` panels come from a live run at
 * render time (the capture moment is printed inside the image and saved next
 * to it as JSON), and the certificate/export panels come from `demo`, which is
 * synthetic and says so on every line. Refresh with: pnpm render:readme
 */
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const cli = new URL("../bin/gemhog.mjs", import.meta.url).pathname;
const outDir = new URL("../assets/readme/", import.meta.url).pathname;

// The site palette, kept in one place so the images match globals.css.
const C = {
  bg: "#050105",
  panel: "#0d0510",
  line: "#2a1622",
  lineHot: "#57284a",
  accent: "#ff7ac4",
  accentDark: "#571f42",
  text: "#d9d2d8",
  muted: "#8d7f8a",
  faint: "#564a54",
  ice: "#78c8f0",
  iceLight: "#ecfaff",
  dark: "#16020e",
};

const FONT = "'JetBrains Mono','SFMono-Regular',Consolas,'Liberation Mono',monospace";
const FS = 14; // font size
const LH = 22; // line height
const CW = FS * 0.6; // monospace advance width

const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** One output line as colored segments: [{ t, c, b? }, ...] */
function lineToSvg(segments, x, y) {
  let cursor = x;
  const parts = [];
  for (const seg of segments) {
    parts.push(
      `<text x="${cursor.toFixed(1)}" y="${y}" font-family="${FONT}" font-size="${FS}" fill="${seg.c}"${seg.b ? ' font-weight="700"' : ""} xml:space="preserve">${esc(seg.t)}</text>`,
    );
    cursor += seg.t.length * CW;
  }
  return parts.join("");
}

/**
 * 5x5 pixel alphabet for the wordmark, so the images carry the same pixel
 * identity as the site without embedding any font.
 */
const PIX = {
  G: ["11111", "10000", "10111", "10001", "11111"],
  E: ["11111", "10000", "11110", "10000", "11111"],
  M: ["10001", "11011", "10101", "10001", "10001"],
  H: ["10001", "10001", "11111", "10001", "10001"],
  O: ["11111", "10001", "10001", "10001", "11111"],
  D: ["11110", "10001", "10001", "10001", "11110"],
};

function wordmark(word, x, y, cell, color, shadow) {
  const rects = [];
  let ox = x;
  for (const ch of word) {
    const glyph = PIX[ch];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (glyph[r][c] === "1") {
          if (shadow) rects.push(`<rect x="${ox + c * cell + cell * 0.45}" y="${y + r * cell + cell * 0.45}" width="${cell}" height="${cell}" fill="${shadow}"/>`);
          rects.push(`<rect x="${ox + c * cell}" y="${y + r * cell}" width="${cell}" height="${cell}" fill="${color}"/>`);
        }
      }
    }
    ox += cell * 6.2;
  }
  return rects.join("");
}

/** Terminal window: chrome bar with three dots, a title, a right-hand tag. */
function windowFrame({ width, height, title, tag, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
<rect width="${width}" height="${height}" rx="8" fill="${C.bg}"/>
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="none" stroke="${C.lineHot}"/>
<line x1="0" y1="44" x2="${width}" y2="44" stroke="${C.line}"/>
<circle cx="24" cy="22" r="5" fill="${C.accentDark}"/>
<circle cx="42" cy="22" r="5" fill="${C.accentDark}"/>
<circle cx="60" cy="22" r="5" fill="${C.accent}"/>
<text x="80" y="27" font-family="${FONT}" font-size="13" fill="${C.muted}" xml:space="preserve">${esc(title)}</text>
<text x="${width - 24}" y="27" font-family="${FONT}" font-size="12" fill="${C.accent}" text-anchor="end" letter-spacing="1" xml:space="preserve">${esc(tag)}</text>
${body}
</svg>`;
}

const seg = (t, c, b) => ({ t, c, ...(b ? { b: true } : {}) });

/* ------------------------------------------------------------------ doctor */

async function renderDoctor() {
  // A real run at render time; exit code 2 (a failing source) still reports.
  const { stdout } = await run("node", [cli, "doctor", "--format", "json"]).catch((e) => ({ stdout: e.stdout }));
  const report = JSON.parse(stdout);
  await writeFile(`${outDir}doctor-snapshot.json`, JSON.stringify(report, null, 2) + "\n");

  const left = 32;
  let y = 118;
  const lines = [];
  lines.push(lineToSvg([seg("$ ", C.faint), seg("pnpm doctor", C.accent, true)], left, y)); y += LH * 1.6;
  lines.push(lineToSvg([seg("STATUS  ", C.faint), seg("SOURCE", C.faint), seg(" ".repeat(22), C.faint), seg("LATENCY", C.faint), seg("   DETAIL", C.faint)], left, y)); y += LH * 0.6;
  lines.push(`<line x1="${left}" y1="${y}" x2="${940}" y2="${y}" stroke="${C.line}"/>`); y += LH;
  for (const check of report.checks) {
    const status = check.ok ? seg("[ OK ]", C.accent, true) : seg("[FAIL]", C.faint, true);
    const name = check.name.padEnd(28, " ");
    const lat = `${check.latencyMs}ms`.padStart(7, " ");
    const detail = check.detail.length > 44 ? check.detail.slice(0, 43) + "…" : check.detail;
    lines.push(lineToSvg([status, seg("  ", C.text), seg(name, C.text), seg(lat, C.ice), seg("   " + detail, C.muted)], left, y));
    y += LH;
  }
  y += LH * 0.5;
  const okCount = report.checks.filter((c) => c.ok).length;
  lines.push(lineToSvg([seg(`${okCount}/${report.checks.length} source checks passed at capture time.`, C.accent)], left, y));
  y += LH * 1.4;
  lines.push(lineToSvg([seg(`CAPTURED ${report.observedAt.slice(0, 19).replace("T", " ")} UTC / STATUS CAN CHANGE`, C.faint)], left, y));
  y += LH * 0.4;

  const width = 980;
  const height = Math.ceil(y + 24);
  const body = `
${wordmark("GEMHOG", left, 62, 4, C.accent, C.accentDark)}
<text x="${left + 200}" y="76" font-family="${FONT}" font-size="13" fill="${C.muted}" xml:space="preserve">source diagnostics / robinhood chain ${report.chainId}</text>
<text x="${left + 200}" y="94" font-family="${FONT}" font-size="13" fill="${C.text}" xml:space="preserve">Check the inputs before the output.</text>
${lines.join("\n")}
<rect x="${width - 250}" y="58" width="218" height="44" fill="none" stroke="${C.line}"/>
<text x="${width - 141}" y="76" font-family="${FONT}" font-size="11" fill="${C.faint}" text-anchor="middle" xml:space="preserve">NO KEYS / NO SIGNER</text>
<text x="${width - 141}" y="92" font-family="${FONT}" font-size="11" fill="${C.muted}" text-anchor="middle" xml:space="preserve">READ ONLY / ${report.rpcCalls} RPC CALLS / ${(report.ms / 1000).toFixed(1)}S</text>`;
  await writeFile(`${outDir}doctor.svg`, windowFrame({ width, height, title: "gemhog / doctor", tag: "CAPTURED SOURCE CHECK", body }) + "\n");
  return report;
}

/* ------------------------------------------------------- demo certificate */

async function renderCertificate() {
  const { stdout: jsonOut } = await run("node", [cli, "demo", "--format", "json"]);
  const report = JSON.parse(jsonOut);
  await writeFile(`${outDir}certificate-snapshot.json`, JSON.stringify(report, null, 2) + "\n");

  const left = 32;
  let y = 118;
  const held = Object.entries(report.cut.held).map(([t, v]) => `${t} ${Math.round(v * 100)}%`).join(" · ");
  const mark = () => seg("DEMO │ ", C.faint);
  const lines = [];
  const push = (segments) => { lines.push(lineToSvg(segments, left, y)); y += LH; };

  push([mark(), seg(`$${report.symbol}`, C.accent, true), seg(` · ${report.token} · launched ${report.launchedAt} · ${report.age} ago`, C.muted)]);
  y += LH * 0.4;
  push([mark(), seg("GRADE  ", C.text), seg(report.grade, C.accent, true), seg(`   ${report.score} / 100`, C.text, true)]);
  y += LH * 0.4;
  push([mark(), seg("cut      ", C.muted), seg(`${report.cut.score}/40`, C.text, true), seg(`   early cohort ${report.cut.cohort} wallets (${report.cut.human} human)`, C.muted)]);
  push([mark(), seg("         ", C.muted), seg(`still holding: ${held} · half-life: ${report.cut.halfLife}`, C.muted)]);
  push([mark(), seg("clarity  ", C.muted), seg(`${report.clarity.score}/20`, C.text, true), seg(`   top 10 hold ${report.clarity.top10Pct}% · ${report.clarity.bundle ? "bundle detected" : "no bundle"}`, C.muted)]);
  push([mark(), seg("color    ", C.muted), seg(`${report.color.score}/20`, C.text, true), seg(`   dev bought ${report.color.devBoughtPct}% · dev has not sold · ${report.color.claims} fee claims`, C.muted)]);
  push([mark(), seg("carat    ", C.muted), seg(`${report.carat.score}/20`, C.text, true), seg(`   ${report.carat.holders} holders · ${report.carat.cohortEth} ETH in the early cohort · top 3 ${report.carat.top3Pct}%`, C.muted)]);
  y += LH * 0.4;
  push([mark(), seg("phase    ", C.muted), seg(report.phase, C.ice), seg("          source  ", C.muted), seg("DEMO · synthetic data, no network", C.accent)]);

  // Retention strip drawn from the same numbers as the text above.
  y += LH * 0.6;
  lines.push(`<text x="${left}" y="${y}" font-family="${FONT}" font-size="12" fill="${C.faint}" xml:space="preserve">RETENTION BY CHECKPOINT / SYNTHETIC</text>`);
  y += 14;
  const entries = Object.entries(report.cut.held);
  const barW = 640;
  for (const [t, v] of entries) {
    const kept = Math.round(barW * v);
    lines.push(`<text x="${left}" y="${y + 11}" font-family="${FONT}" font-size="12" fill="${C.muted}" xml:space="preserve">${t.padStart(3, " ")}</text>`);
    lines.push(`<rect x="${left + 46}" y="${y}" width="${barW}" height="12" fill="${C.accentDark}" opacity="0.35"/>`);
    lines.push(`<rect x="${left + 46}" y="${y}" width="${kept}" height="12" fill="${C.accent}"/>`);
    lines.push(`<text x="${left + 46 + barW + 14}" y="${y + 11}" font-family="${FONT}" font-size="12" fill="${C.text}" xml:space="preserve">${Math.round(v * 100)}% still holding</text>`);
    y += 20;
  }
  y += LH;
  lines.push(`<text x="${left}" y="${y}" font-family="${FONT}" font-size="12" fill="${C.faint}" xml:space="preserve">synthetic walkthrough · reproduce with: pnpm demo · the live engine lands in 0.2.0</text>`);

  const width = 980;
  const height = Math.ceil(y + 30);
  const body = `
${wordmark("GEMHOG", left, 62, 4, C.accent, C.accentDark)}
<text x="${left + 200}" y="76" font-family="${FONT}" font-size="13" fill="${C.muted}" xml:space="preserve">certificate walkthrough / diamond clarity scale</text>
<text x="${left + 200}" y="94" font-family="${FONT}" font-size="13" fill="${C.text}" xml:space="preserve">Grade the hands before the bag.</text>
${lines.join("\n")}`;
  await writeFile(`${outDir}certificate-demo.svg`, windowFrame({ width, height, title: "gemhog / demo", tag: "SYNTHETIC DATA / MARKED DEMO", body }) + "\n");
}

/* ------------------------------------------------------------ json export */

async function renderJsonExport() {
  const { stdout } = await run("node", [cli, "demo", "--format", "json"]);
  const report = JSON.parse(stdout);
  const excerpt = {
    demo: report.demo,
    symbol: report.symbol,
    grade: report.grade,
    score: report.score,
    cut: { score: report.cut.score, cohort: report.cut.cohort, human: report.cut.human, halfLife: report.cut.halfLife },
    clarity: { score: report.clarity.score, top10Pct: report.clarity.top10Pct },
    color: { score: report.color.score, devSold: report.color.devSold },
    carat: { score: report.carat.score, holders: report.carat.holders },
  };
  const jsonLines = JSON.stringify(excerpt, null, 2).split("\n");

  const left = 32;
  let y = 118;
  const lines = [];
  lines.push(lineToSvg([seg("$ ", C.faint), seg("pnpm gemhog demo --format json --output demo.json", C.accent, true)], left, y));
  y += LH * 1.4;
  for (const [i, raw] of jsonLines.entries()) {
    const no = String(i + 1).padStart(2, "0");
    const segments = [seg(`${no}  `, C.faint)];
    const m = raw.match(/^(\s*)("[^"]+":)(.*)$/);
    if (m) segments.push(seg(m[1], C.text), seg(m[2], C.ice), seg(m[3], C.text));
    else segments.push(seg(raw, C.text));
    lines.push(lineToSvg(segments, left, y));
    y += LH * 0.86;
  }
  y += LH;
  lines.push(`<text x="${left}" y="${y}" font-family="${FONT}" font-size="12" fill="${C.faint}" xml:space="preserve">DEMO data / excerpt. Exports refuse to overwrite existing files.</text>`);

  const width = 980;
  const height = Math.ceil(y + 30);
  const right = [
    ["TEXT", "read it in your terminal"],
    ["JSON", "pipe it into your tools"],
    ["MARKDOWN", "share the full certificate"],
  ];
  let ry = 150;
  const rightCol = right.map(([title, sub]) => {
    const block = `<text x="${width - 300}" y="${ry}" font-family="${FONT}" font-size="18" fill="${C.accent}" font-weight="700" xml:space="preserve">${title}</text>
<text x="${width - 300}" y="${ry + 20}" font-family="${FONT}" font-size="12" fill="${C.muted}" xml:space="preserve">${sub}</text>`;
    ry += 64;
    return block;
  }).join("\n");
  const body = `
${wordmark("GEMHOG", left, 62, 4, C.accent, C.accentDark)}
<text x="${left + 200}" y="76" font-family="${FONT}" font-size="13" fill="${C.muted}" xml:space="preserve">machine-readable certificates</text>
<text x="${left + 200}" y="94" font-family="${FONT}" font-size="13" fill="${C.text}" xml:space="preserve">Keep the evidence with the numbers.</text>
<line x1="${width - 330}" y1="110" x2="${width - 330}" y2="${height - 40}" stroke="${C.line}"/>
${rightCol}
${lines.join("\n")}`;
  await writeFile(`${outDir}json-export.svg`, windowFrame({ width, height, title: "gemhog / certificate export", tag: "SYNTHETIC DEMO / JSON EXCERPT", body }) + "\n");
}

/* ------------------------------------------------------------------- main */

await mkdir(outDir, { recursive: true });
const doctor = await renderDoctor();
await renderCertificate();
await renderJsonExport();
console.log(`rendered assets/readme: doctor.svg (${doctor.checks.filter((c) => c.ok).length}/${doctor.checks.length} ok), certificate-demo.svg, json-export.svg`);
