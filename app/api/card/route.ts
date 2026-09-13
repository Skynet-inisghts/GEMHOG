import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { CheckError } from "@/lib/gemhog/check";
import { getCertificate, peekCertificate } from "@/lib/gemhog/service";
import { renderCard } from "@/lib/gemhog/card";
import { fetchTokenLogo } from "@/lib/gemhog/read/logo";
import { demoReport } from "@/lib/gemhog/demo";
import { certTtlMs, clientIp, coalesce, RateLimiter, TtlCache } from "@/lib/gemhog/web";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/card?token=0x… → the 1080x1080 share card as PNG.
 * GET /api/card?demo=1     → the walkthrough card with the DEMO plate.
 *
 * Cards are what unfurl on X and Telegram, so a viral link means a crowd
 * hitting one URL: the CDN caches the PNG (s-maxage + stale-while-revalidate),
 * one instance renders it once (coalescing), and the result stays warm with
 * the same age-aware TTL as the certificate behind it.
 */

const cache = new TtlCache<Buffer>(150);
const limiter = new RateLimiter(15, 60_000);

const png = (buf: Buffer) =>
  new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
    },
  });

export async function GET(request: Request) {
  const url = new URL(request.url);

  // The warm path: the grade route just computed this certificate and hands
  // it over under a shared secret, so the card renders in a second and the
  // response settles into the CDN for everyone else. No secret, no shortcut.
  const warmCert = request.headers.get("x-gemhog-cert");
  const warmSecret = request.headers.get("x-gemhog-secret");
  const expected = process.env.CARD_WARM_SECRET?.trim();
  if (warmCert && expected && warmSecret === expected) {
    try {
      const cert = JSON.parse(Buffer.from(warmCert, "base64").toString("utf8"));
      const raw = url.searchParams.get("token") ?? "";
      if (isAddress(raw) && cert.token?.toLowerCase() === raw.toLowerCase() && !cert.tooEarly) {
        const logo = await fetchTokenLogo(getAddress(raw)).catch(() => null);
        const buf = await renderCard(cert, { logo: logo ?? undefined });
        cache.set(getAddress(raw), buf, certTtlMs(cert.ageSec ?? 0));
        return png(buf);
      }
    } catch { /* fall through to the normal path */ }
  }

  if (url.searchParams.get("demo")) {
    const hit = cache.get("demo");
    if (hit) return png(hit);
    const buf = await coalesce("card:demo", () => renderCard(demoReport(), { demo: true }));
    cache.set("demo", buf, 60 * 60_000);
    return png(buf);
  }

  const raw = url.searchParams.get("token") ?? "";
  if (!isAddress(raw)) {
    return NextResponse.json({ error: "pass ?token=0x… (a pons token contract address)" }, { status: 400 });
  }
  const token = getAddress(raw);
  const hit = cache.get(token);
  if (hit) return png(hit);

  if (!limiter.allow(clientIp(request))) {
    return NextResponse.json({ error: "too many cards at once; try again shortly" }, { status: 429 });
  }

  try {
    const result = await coalesce(`card:${token}`, async () => {
      // The card never digs for minutes: it renders from a certificate this
      // instance already has, or computes one only for a young token. An old
      // token's card arrives through the grade route's warm-up; until that
      // lands in the CDN the answer is "still baking", and the page retries.
      let cert = peekCertificate(token);
      if (!cert) {
        const { readLaunch } = await import("@/lib/gemhog/read/launches");
        const launch = await readLaunch(token);
        if (!launch) throw new CheckError(`${token} was not launched through the pons v2 factory`);
        const ageSec = Date.now() / 1000 - launch.launchedAt;
        if (ageSec > 86_400) return { baking: true as const };
        cert = await getCertificate(token);
      }
      if (cert.tooEarly) return { tooEarly: true as const };
      const logo = await fetchTokenLogo(token).catch(() => null);
      const buf = await renderCard(cert, { logo: logo ?? undefined });
      return { buf, ttlMs: certTtlMs(cert.ageSec) };
    });
    if ("baking" in result) {
      return NextResponse.json({ baking: true }, { status: 202, headers: { "retry-after": "8" } });
    }
    if ("tooEarly" in result) return NextResponse.json({ tooEarly: true }, { status: 425 });
    cache.set(token, result.buf, result.ttlMs);
    return png(result.buf);
  } catch (error) {
    if (error instanceof CheckError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: "chain read failed; try again in a moment" }, { status: 502 });
  }
}
