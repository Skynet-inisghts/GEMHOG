import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { readWalletTokens, WalletListError } from "@/lib/gemhog/read/wallet";
import { PROJECT_TOKEN } from "@/lib/gemhog/project-token";
import { clientIp, coalesce, RateLimiter, TtlCache } from "@/lib/gemhog/web";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * { wallet } in, the wallet's pons tokens out — listing only, no grades.
 * Grades are fetched per token through POST /api/grade so the page can fill
 * them in progressively. The Blockscout key behind the listing allows ~5
 * requests a second in total, so listings are cached for two minutes,
 * concurrent identical requests share one read, and a per-IP bucket keeps a
 * single visitor from spending the shared budget.
 */

const cache = new TtlCache<{ status: number; body: unknown }>(300);
const limiter = new RateLimiter(8, 60_000);

export async function POST(request: Request) {
  let wallet = "";
  try {
    const body = (await request.json()) as { wallet?: string };
    wallet = String(body.wallet ?? "").trim();
  } catch { /* falls through to validation */ }
  if (!isAddress(wallet)) {
    return NextResponse.json({ error: "pass a public EVM address (0x…)" }, { status: 400 });
  }
  const key = wallet.toLowerCase();
  const hit = cache.get(key);
  if (hit) return NextResponse.json(hit.body, { status: hit.status });
  if (!limiter.allow(clientIp(request))) {
    return NextResponse.json({ error: "a few wallets a minute is the ceiling; try again shortly" }, { status: 429 });
  }
  try {
    const tokens = await coalesce(`holder:${key}`, () => readWalletTokens(getAddress(wallet)));
    const body = {
      wallet: getAddress(wallet),
      tokens: tokens.map((t) => ({
        token: t.token,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        balance: t.balance.toString(),
        pctOfSupply: t.pctOfSupply,
      })),
      projectToken: { ticker: PROJECT_TOKEN.ticker, address: PROJECT_TOKEN.address },
    };
    cache.set(key, { status: 200, body }, 2 * 60_000);
    return NextResponse.json(body);
  } catch (error) {
    if (error instanceof WalletListError) {
      return NextResponse.json(
        { error: error.message, clientFallback: error.reason === "challenge" },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "wallet read failed; try again in a moment" }, { status: 502 });
  }
}
