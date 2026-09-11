import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { readWalletTokens, WalletListError } from "@/lib/gemhog/read/wallet";
import { PROJECT_TOKEN } from "@/lib/gemhog/project-token";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * { wallet } in, the wallet's pons tokens out — listing only, no grades.
 * Grades are fetched per token through POST /api/grade so the page can fill
 * them in progressively instead of blocking for minutes.
 */
export async function POST(request: Request) {
  let wallet = "";
  try {
    const body = (await request.json()) as { wallet?: string };
    wallet = String(body.wallet ?? "").trim();
  } catch { /* falls through to validation */ }
  if (!isAddress(wallet)) {
    return NextResponse.json({ error: "pass a public EVM address (0x…)" }, { status: 400 });
  }
  try {
    const tokens = await readWalletTokens(getAddress(wallet));
    return NextResponse.json({
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
    });
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
