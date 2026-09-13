import { NextResponse } from "next/server";
import { resolveInput, enrichCluster } from "@/lib/gemhog/resolve";
import { CheckError } from "@/lib/gemhog/check";
import { getCertificate } from "@/lib/gemhog/service";
import { certTtlMs, clientIp, coalesce, RateLimiter, TtlCache } from "@/lib/gemhog/web";

export const dynamic = "force-dynamic";
// A week-old token replays its whole transfer history; give the read room.
export const maxDuration = 300;

/**
 * { token } or { ticker } in; a certificate, a cluster to disambiguate, or an
 * error out. Load armour: a per-IP bucket answers 429 politely, concurrent
 * identical requests share one chain read, and results stay cached with an
 * age-aware TTL — a week-old grade is frozen, re-reading it every minute
 * would only burn the public RPC.
 */

const cache = new TtlCache<{ status: number; body: unknown }>(500);
const limiter = new RateLimiter(12, 60_000);

export async function POST(request: Request) {
  let input = "";
  try {
    const body = (await request.json()) as { token?: string; ticker?: string };
    input = String(body.token ?? body.ticker ?? "").trim();
  } catch {
    /* falls through to the empty-input error */
  }
  if (!input || input.length > 80) {
    return NextResponse.json({ error: "pass a token contract address or a ticker" }, { status: 400 });
  }

  const key = input.toLowerCase();
  const hit = cache.get(key);
  if (hit) return NextResponse.json(hit.body, { status: hit.status });

  if (!limiter.allow(clientIp(request))) {
    return NextResponse.json({ error: "easy: a dozen grades a minute per address is the ceiling; try again shortly" }, { status: 429 });
  }

  const { status, body, ttlMs } = await coalesce(`grade:${key}`, async () => {
    try {
      const resolved = await resolveInput(input);
      if (resolved.kind === "none") {
        return { status: 404, body: { error: resolved.note }, ttlMs: 60_000 };
      }
      if (resolved.kind === "cluster") {
        return { status: 200, body: { cluster: await enrichCluster(resolved.cluster), note: resolved.note }, ttlMs: 120_000 };
      }
      const report = await getCertificate(resolved.token!);
      return { status: 200, body: report, ttlMs: report.tooEarly ? 30_000 : certTtlMs(report.ageSec) };
    } catch (error) {
      if (error instanceof CheckError) {
        return { status: 404, body: { error: error.message }, ttlMs: 5 * 60_000 };
      }
      return { status: 502, body: { error: "chain read failed; try again in a moment" }, ttlMs: 10_000 };
    }
  });
  cache.set(key, { status, body }, ttlMs);
  return NextResponse.json(body, { status });
}
