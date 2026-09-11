import { NextResponse } from "next/server";
import { resolveInput, enrichCluster } from "@/lib/gemhog/resolve";
import { checkToken, CheckError } from "@/lib/gemhog/check";

export const dynamic = "force-dynamic";
// A week-old token replays its whole transfer history; give the read room.
export const maxDuration = 300;

/**
 * { token } or { ticker } in; a certificate, a cluster to disambiguate, or an
 * error out. A 60-second in-memory cache per input keeps a page full of
 * browsers from hammering the public RPC with identical checks.
 */

const cache = new Map<string, { at: number; status: number; body: unknown }>();
const TTL_MS = 60_000;

export async function POST(request: Request) {
  let input = "";
  try {
    const body = (await request.json()) as { token?: string; ticker?: string };
    input = String(body.token ?? body.ticker ?? "").trim();
  } catch {
    /* fall through to the empty-input error */
  }
  if (!input || input.length > 80) {
    return NextResponse.json({ error: "pass a token contract address or a ticker" }, { status: 400 });
  }

  const key = input.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json(hit.body, { status: hit.status });
  }

  let status = 200;
  let payload: unknown;
  try {
    const resolved = await resolveInput(input);
    if (resolved.kind === "none") {
      status = 404;
      payload = { error: resolved.note };
    } else if (resolved.kind === "cluster") {
      payload = { cluster: await enrichCluster(resolved.cluster), note: resolved.note };
    } else {
      payload = await checkToken(resolved.token!);
    }
  } catch (error) {
    if (error instanceof CheckError) {
      status = 404;
      payload = { error: error.message };
    } else {
      status = 502;
      payload = { error: "chain read failed; try again in a moment" };
    }
  }
  cache.set(key, { at: Date.now(), status, body: payload });
  if (cache.size > 500) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 250);
    for (const [k] of oldest) cache.delete(k);
  }
  return NextResponse.json(payload, { status });
}
