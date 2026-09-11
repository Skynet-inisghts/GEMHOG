import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { checkToken, CheckError } from "@/lib/gemhog/check";
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
      const [cert, logo] = await Promise.all([checkToken(token), fetchTokenLogo(token)]);
      if (cert.tooEarly) return { tooEarly: true as const };
      const buf = await renderCard(cert, { logo: logo ?? undefined });
      return { buf, ttlMs: certTtlMs(cert.ageSec) };
    });
    if ("tooEarly" in result) return NextResponse.json({ tooEarly: true }, { status: 425 });
    cache.set(token, result.buf, result.ttlMs);
    return png(result.buf);
  } catch (error) {
    if (error instanceof CheckError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: "chain read failed; try again in a moment" }, { status: 502 });
  }
}
