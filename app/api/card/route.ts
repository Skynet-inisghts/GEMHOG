import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { checkToken, CheckError } from "@/lib/gemhog/check";
import { renderCard } from "@/lib/gemhog/card";
import { fetchTokenLogo } from "@/lib/gemhog/read/logo";
import { demoReport } from "@/lib/gemhog/demo";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/card?token=0x… → the 1080x1080 share card as PNG.
 * GET /api/card?demo=1     → the walkthrough card with the DEMO plate.
 * A token younger than 5 minutes answers 425 { tooEarly: true }: there is no
 * grade to show yet, and the page says so instead of drawing one.
 */

const cache = new Map<string, { at: number; buf: Buffer }>();
const TTL_MS = 60_000;

const png = (buf: Buffer) =>
  new NextResponse(new Uint8Array(buf), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=60" },
  });

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (url.searchParams.get("demo")) {
    const key = "demo";
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return png(hit.buf);
    const buf = await renderCard(demoReport(), { demo: true });
    cache.set(key, { at: Date.now(), buf });
    return png(buf);
  }

  const raw = url.searchParams.get("token") ?? "";
  if (!isAddress(raw)) {
    return NextResponse.json({ error: "pass ?token=0x… (a pons token contract address)" }, { status: 400 });
  }
  const token = getAddress(raw);
  const hit = cache.get(token);
  if (hit && Date.now() - hit.at < TTL_MS) return png(hit.buf);

  try {
    const [cert, logo] = await Promise.all([checkToken(token), fetchTokenLogo(token)]);
    if (cert.tooEarly) return NextResponse.json({ tooEarly: true }, { status: 425 });
    const buf = await renderCard(cert, { logo: logo ?? undefined });
    cache.set(token, { at: Date.now(), buf });
    if (cache.size > 200) {
      for (const [k] of [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 100)) cache.delete(k);
    }
    return png(buf);
  } catch (error) {
    if (error instanceof CheckError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: "chain read failed; try again in a moment" }, { status: 502 });
  }
}
