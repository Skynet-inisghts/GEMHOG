import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D, type Image } from "@napi-rs/canvas";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHECKPOINTS, type CertificateReport, type CheckpointLabel } from "./grade/types.js";

/**
 * Share cards: a 1080x1080 square for one certificate, three moods by score.
 *
 *   1-35    red     the pig has eaten something bad. lump of coal.
 *   36-70   yellow  the pig is unimpressed. dull pebble.
 *   71-100  green   the pig is thrilled. big diamond, sparkles.
 *
 * The layout is a one-to-one port of assets/cards/render_cards.py (the
 * reference renderer); change the reference first, then this file. The pig
 * sprites are the shipped PNGs from assets/cards/ - never redrawn here.
 */

export type Mood = "red" | "yellow" | "green";

const PALETTES: Record<Mood, { L4: string; TEXT: string; GLOW: string }> = {
  red: { L4: "rgb(112,18,36)", TEXT: "rgb(255,96,92)", GLOW: "rgb(255,60,60)" },
  yellow: { L4: "rgb(118,80,8)", TEXT: "rgb(255,214,64)", GLOW: "rgb(255,200,40)" },
  green: { L4: "rgb(14,88,46)", TEXT: "rgb(96,240,128)", GLOW: "rgb(60,230,110)" },
};

export const SITE_HOST = "gemhog.xyz";

export function band(score: number): Mood {
  if (score < 1) return "red";
  if (score <= 35) return "red";
  if (score <= 70) return "yellow";
  return "green";
}

/** The three description lines, each capped at 52 characters, trimmed on a word. */
export function cardLines(cert: CertificateReport): string[] {
  const reached = CHECKPOINTS.filter((c) => cert.cut.held[c.label as CheckpointLabel] !== undefined);
  const last = reached.at(-1);
  const holding = last ? Math.round((cert.cut.held[last.label] as number) * 100) : 0;
  const line1 = last
    ? `early cohort ${cert.cut.cohort} wallets · ${holding}% still holding at ${last.label}`
    : `early cohort ${cert.cut.cohort} wallets`;

  const sells = cert.color.devSells;
  const soldTimes = sells === 1 ? "once" : sells === 2 ? "twice" : `${sells} times`;
  let line2: string;
  if (sells === 0 && cert.color.devBoughtPct === 0) line2 = `dev did not buy · ${cert.color.feeClaims24h} fee claims`;
  else if (sells === 0) line2 = `dev has not sold · ${cert.color.feeClaims24h} fee claims`;
  else if (cert.color.devBoughtPct > 0) line2 = `dev bought ${cert.color.devBoughtPct.toFixed(1)}% and sold ${soldTimes}`;
  else line2 = `dev sold ${soldTimes}`;

  let line3 = `top 10 hold ${cert.clarity.top10Pct.toFixed(1)}% · ${cert.carat.holders}${cert.carat.holdersIsFloor ? "+" : ""} holders`;
  if (cert.clarity.bundleHoldsPct > 0) line3 += ` · bundle holds ${cert.clarity.bundleHoldsPct.toFixed(0)}%`;

  return [line1, line2, line3].map(capLine);
}

function capLine(line: string): string {
  if (line.length <= 52) return line;
  const cut = line.slice(0, 52);
  const space = cut.lastIndexOf(" ");
  return (space > 30 ? cut.slice(0, space) : cut).trimEnd();
}

// Both the compiled CLI and the Next server run with the repo as cwd; on
// Vercel the directory ships through outputFileTracingIncludes (next.config).
const cardsDir = () => join(process.cwd(), "assets", "cards");

let fontsReady = false;
function registerFonts(): void {
  if (fontsReady) return;
  const dir = join(cardsDir(), "fonts");
  GlobalFonts.register(readFileSync(join(dir, "Tiny5-Regular.ttf")), "Tiny5");
  GlobalFonts.register(readFileSync(join(dir, "Unbounded[wght].ttf")), "Unbounded");
  GlobalFonts.register(readFileSync(join(dir, "JetBrainsMono[wght].ttf")), "JBMono");
  fontsReady = true;
}

const pigCache: Partial<Record<Mood, Image>> = {};
async function pigSprite(mood: Mood): Promise<Image> {
  if (!pigCache[mood]) {
    pigCache[mood] = await loadImage(readFileSync(join(cardsDir(), `pig-${mood}.png`)));
  }
  return pigCache[mood]!;
}

export interface CardOptions {
  /** Raw image bytes of the token logo; a grey initial circle when missing. */
  logo?: Buffer;
  /** Overlays the DEMO plate across the pig; only the demo path sets it. */
  demo?: boolean;
}

export async function renderCard(cert: CertificateReport, options: CardOptions = {}): Promise<Buffer> {
  registerFonts();
  const mood = band(cert.score);
  const p = PALETTES[mood];
  const ACC = p.TEXT;
  const W = 1080;
  const H = 1080;
  const M = 72; // margin

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, W, H);

  // faint coloured pool behind the pig
  ctx.save();
  ctx.filter = "blur(130px)";
  ctx.fillStyle = p.GLOW.replace("rgb", "rgba").replace(")", ",0.2)");
  ctx.beginPath();
  ctx.ellipse(W * 0.5, H * 0.9, W * 0.35, H * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---- header: logo + ticker (left), score (right)
  const LOGO = 128;
  if (options.logo) {
    try {
      const img = await loadImage(options.logo);
      ctx.save();
      ctx.beginPath();
      ctx.arc(M + LOGO / 2, M + LOGO / 2, LOGO / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, M, M, LOGO, LOGO);
      ctx.restore();
    } catch {
      drawInitialCircle(ctx, M, LOGO, cert.symbol);
    }
  } else {
    drawInitialCircle(ctx, M, LOGO, cert.symbol);
  }
  ctx.strokeStyle = ACC;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(M + LOGO / 2, M + LOGO / 2, LOGO / 2 + 4, 0, Math.PI * 2);
  ctx.stroke();

  const scoreText = String(cert.score);
  ctx.font = "900 150px Unbounded";
  const sw = ctx.measureText(scoreText).width;
  ctx.font = "400 34px JBMono";
  const slashW = ctx.measureText("/100").width;
  const rightEdge = W - M - sw - 16 - slashW - 40; // the ticker may not cross this

  ctx.textBaseline = "middle";
  ctx.font = "700 84px JBMono";
  let tx = M + LOGO + 36;
  ctx.fillStyle = ACC;
  ctx.fillText("$", tx, M + LOGO / 2);
  tx += ctx.measureText("$").width + 6;
  const ticker = cert.symbol.toUpperCase();
  let tickerSize = 112; // shrink long tickers in whole Tiny5 cells
  ctx.font = `${tickerSize}px Tiny5`;
  while (tickerSize > 48 && tx + ctx.measureText(ticker).width > rightEdge) {
    tickerSize -= 8;
    ctx.font = `${tickerSize}px Tiny5`;
  }
  ctx.fillStyle = "white";
  ctx.fillText(ticker, tx, M + LOGO / 2);

  ctx.font = "900 150px Unbounded";
  ctx.fillStyle = ACC;
  ctx.fillText(scoreText, W - M - sw, M + LOGO / 2);
  ctx.font = "400 34px JBMono";
  ctx.fillStyle = "rgb(120,120,120)";
  ctx.fillText("/100", W - M - sw - 16 - slashW, M + LOGO / 2 + 36);
  ctx.font = "56px Tiny5";
  ctx.fillStyle = ACC;
  const gradeW = ctx.measureText(cert.grade).width;
  ctx.fillText(cert.grade, W - M - gradeW, M + LOGO + 40);

  // ---- score bar with three zones
  const by = M + LOGO + 118;
  const bx0 = M;
  const bw = W - 2 * M;
  const zones: [number, number, string][] = [
    [0, 35, PALETTES.red.L4],
    [35, 70, PALETTES.yellow.L4],
    [70, 100, PALETTES.green.L4],
  ];
  for (const [lo, hi, col] of zones) {
    ctx.fillStyle = col;
    ctx.fillRect(bx0 + (bw * lo) / 100, by, (bw * (hi - lo)) / 100 - 4, 14);
  }
  const mx = bx0 + (bw * Math.max(0, Math.min(100, cert.score))) / 100;
  ctx.fillStyle = ACC;
  ctx.fillRect(mx - 6, by - 10, 12, 34);
  ctx.fillStyle = "white";
  ctx.fillRect(mx - 2, by - 10, 4, 34);
  ctx.font = "400 22px JBMono";
  ctx.fillStyle = "rgb(90,90,90)";
  ctx.textBaseline = "top";
  ctx.fillText("1", bx0, by + 32);
  ctx.fillText("35", bx0 + bw * 0.35 - ctx.measureText("35").width / 2, by + 32);
  ctx.fillText("70", bx0 + bw * 0.7 - ctx.measureText("70").width / 2, by + 32);
  ctx.fillText("100", bx0 + bw - ctx.measureText("100").width, by + 32);

  // ---- description
  ctx.font = "400 30px JBMono";
  ctx.fillStyle = "rgb(200,200,200)";
  let ty = by + 96;
  for (const line of cardLines(cert).slice(0, 3)) {
    ctx.fillText(line, M, ty);
    ty += 44;
  }

  // ---- the pig (shipped v2 sprite, native 104x92 at 6x, mound flush with the bottom edge)
  const sprite = await pigSprite(mood);
  const SPW = 104 * 6;
  const SPH = 92 * 6;
  const px = W - M - SPW + 40;
  const py = H - SPH + 24;
  ctx.save();
  ctx.filter = "blur(60px)";
  ctx.globalAlpha = 0.42;
  const silhouette = createCanvas(SPW, SPH);
  const sctx = silhouette.getContext("2d");
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(sprite, 0, 0, SPW, SPH);
  sctx.globalCompositeOperation = "source-in";
  sctx.fillStyle = p.GLOW;
  sctx.fillRect(0, 0, SPW, SPH);
  ctx.drawImage(silhouette, px, py);
  ctx.restore();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, px, py, SPW, SPH);
  ctx.imageSmoothingEnabled = true;

  if (options.demo) {
    ctx.save();
    ctx.translate(px + SPW / 2, py + SPH / 2);
    ctx.rotate(-0.22);
    ctx.font = "96px Tiny5";
    const dw = ctx.measureText("DEMO").width;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(-dw / 2 - 24, -64, dw + 48, 128);
    ctx.strokeStyle = ACC;
    ctx.lineWidth = 4;
    ctx.strokeRect(-dw / 2 - 24, -64, dw + 48, 128);
    ctx.fillStyle = ACC;
    ctx.textBaseline = "middle";
    ctx.fillText("DEMO", -dw / 2, 8);
    ctx.restore();
  }

  // ---- corners: signature stacked bottom-left, site and date under it
  ctx.textBaseline = "middle";
  ctx.font = "56px Tiny5";
  ctx.fillStyle = ACC;
  ctx.fillText("GEMHOG", M, H - M - 74);
  ctx.font = "400 30px JBMono";
  ctx.fillStyle = "rgb(140,140,140)";
  ctx.fillText("Terminal", M, H - M - 34);
  ctx.font = "400 22px JBMono";
  ctx.fillText(SITE_HOST, M, H - M - 2);
  ctx.fillStyle = "rgb(90,90,90)";
  ctx.fillText(`${cert.observedAt.slice(0, 16).replace("T", " ")} UTC`, M, H - M + 26);

  return canvas.toBuffer("image/png");
}

function drawInitialCircle(ctx: SKRSContext2D, M: number, LOGO: number, symbol: string): void {
  ctx.fillStyle = "rgb(26,26,26)";
  ctx.beginPath();
  ctx.arc(M + LOGO / 2, M + LOGO / 2, LOGO / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "72px Tiny5";
  ctx.fillStyle = "rgb(120,120,120)";
  ctx.textBaseline = "middle";
  const ch = (symbol[0] ?? "?").toUpperCase();
  ctx.fillText(ch, M + LOGO / 2 - ctx.measureText(ch).width / 2, M + LOGO / 2 + 4);
}
