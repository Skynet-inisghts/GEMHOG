import { getAddress, isAddress, type Address } from "viem";
import { publicClient, ADDR, SOURCES } from "./chain.js";
import { factoryAbi } from "./abi/pons.js";

/**
 * Turn user input into a token address. A 0x address passes through; a ticker
 * fans out to the search sources and every candidate is verified against the
 * pons factory, because a ticker proves nothing — anyone can launch $PEANUT
 * again, which is exactly why an ambiguous ticker returns the whole cluster
 * and asks for the contract address.
 *
 * Sources: DexScreener search (graduated tokens with a pool) and, when a key
 * is configured, Blockscout search (bonding-curve tokens too). A ticker that
 * only exists on the curve and no key set is an honest miss, not a guess.
 */

export interface ResolveCandidate {
  token: Address;
  symbol: string;
  name: string;
}

export interface ResolveResult {
  kind: "address" | "single" | "cluster" | "none";
  token?: Address;
  cluster: ResolveCandidate[];
  note?: string;
}

async function searchDexScreener(ticker: string): Promise<ResolveCandidate[]> {
  try {
    const res = await fetch(`${SOURCES.dexscreener}/latest/dex/search?q=${encodeURIComponent(ticker)}`, {
      headers: { accept: "application/json", "user-agent": "gemhog/0.2" },
      signal: AbortSignal.timeout(12_000),
    });
    const data = (await res.json()) as { pairs?: { chainId: string; baseToken: { address: string; symbol: string; name: string } }[] };
    const out = new Map<string, ResolveCandidate>();
    for (const pair of data.pairs ?? []) {
      if (pair.chainId !== "robinhood") continue;
      if (pair.baseToken.symbol.toUpperCase() !== ticker.toUpperCase()) continue;
      out.set(pair.baseToken.address.toLowerCase(), {
        token: getAddress(pair.baseToken.address),
        symbol: pair.baseToken.symbol,
        name: pair.baseToken.name,
      });
    }
    return [...out.values()];
  } catch {
    return [];
  }
}

async function searchBlockscout(ticker: string): Promise<ResolveCandidate[]> {
  const key = process.env.BLOCKSCOUT_API_KEY?.trim();
  if (!key) return [];
  try {
    const res = await fetch(`${SOURCES.blockscout}/api/v2/search?q=${encodeURIComponent(ticker)}&apikey=${key}`, {
      headers: { accept: "application/json", "user-agent": "gemhog/0.2" },
      signal: AbortSignal.timeout(12_000),
    });
    const data = (await res.json()) as { items?: { type: string; address?: string; symbol?: string; name?: string }[] };
    const out: ResolveCandidate[] = [];
    for (const item of data.items ?? []) {
      if (item.type !== "token" || !item.address) continue;
      if ((item.symbol ?? "").toUpperCase() !== ticker.toUpperCase()) continue;
      out.push({ token: getAddress(item.address), symbol: item.symbol ?? ticker, name: item.name ?? "" });
    }
    return out;
  } catch {
    return [];
  }
}

/** Keep only tokens the pons factory knows; everything else is noise or a fake. */
async function filterPonsTokens(candidates: ResolveCandidate[]): Promise<ResolveCandidate[]> {
  if (!candidates.length) return [];
  const results = await publicClient.multicall({
    allowFailure: true,
    contracts: candidates.map((c) => ({
      address: ADDR.ponsFactory, abi: factoryAbi, functionName: "getLaunchedToken" as const, args: [c.token] as const,
    })),
  });
  return candidates.filter((_, i) => {
    const r = results[i];
    return r.status === "success" && (r.result as { exists: boolean }).exists;
  });
}

export interface ClusterRow extends ResolveCandidate {
  ageSec: number;
  phase: string;
  holders: string;
}

/** Fill the cluster table: age and phase from one multicall, holder counts from one Pons API page each. */
export async function enrichCluster(cluster: ResolveCandidate[]): Promise<ClusterRow[]> {
  const { curveAbi } = await import("./abi/pons.js");
  const records = await publicClient.multicall({
    allowFailure: true,
    contracts: cluster.map((c) => ({
      address: ADDR.ponsFactory, abi: factoryAbi, functionName: "getLaunchedToken" as const, args: [c.token] as const,
    })),
  });
  const curves = records.map((r) => (r.status === "success" ? (r.result as { curve: Address; phase: number }) : null));
  const launchedAts = await publicClient.multicall({
    allowFailure: true,
    contracts: curves.map((rec, i) => ({
      address: rec?.curve ?? cluster[i].token, abi: curveAbi, functionName: "launchedAt" as const,
    })),
  });
  const now = Date.now() / 1000;
  return Promise.all(cluster.map(async (c, i) => {
    const rec = curves[i];
    const launchedAt = launchedAts[i].status === "success" ? Number(launchedAts[i].result as bigint) : 0;
    let holders = "?";
    try {
      const res = await fetch(`${SOURCES.ponsApi}/token/${c.token}/holders`, { headers: { accept: "application/json", "user-agent": "gemhog/0.2" }, signal: AbortSignal.timeout(10_000) });
      const data = (await res.json()) as { ok: boolean; holders?: unknown[]; next_page_params?: unknown };
      if (data.ok && data.holders) holders = `${data.holders.length}${data.next_page_params ? "+" : ""}`;
    } catch { /* the table shows ? and the certificate recounts anyway */ }
    return {
      ...c,
      ageSec: launchedAt ? Math.max(0, now - launchedAt) : 0,
      phase: rec ? (Number(rec.phase) === 2 ? "pool" : "curve") : "?",
      holders,
    };
  }));
}

export async function resolveInput(input: string): Promise<ResolveResult> {
  const trimmed = input.trim();
  if (isAddress(trimmed)) return { kind: "address", token: getAddress(trimmed), cluster: [] };

  const ticker = trimmed.replace(/^\$/, "");
  const [dex, scout] = await Promise.all([searchDexScreener(ticker), searchBlockscout(ticker)]);
  const merged = new Map<string, ResolveCandidate>();
  for (const c of [...dex, ...scout]) merged.set(c.token.toLowerCase(), c);
  const pons = await filterPonsTokens([...merged.values()]);

  if (pons.length === 0) {
    return {
      kind: "none",
      cluster: [],
      note: process.env.BLOCKSCOUT_API_KEY
        ? `no pons token with ticker $${ticker} found`
        : `no graduated pons token with ticker $${ticker} found · bonding-curve tickers need BLOCKSCOUT_API_KEY, or pass the contract address`,
    };
  }
  if (pons.length === 1) return { kind: "single", token: pons[0].token, cluster: pons };
  return { kind: "cluster", cluster: pons, note: `${pons.length} pons launches share $${ticker} · pick one by contract address` };
}
