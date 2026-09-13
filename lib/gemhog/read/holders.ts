import type { Address } from "viem";
import { BURN_ADDRESSES, INFRA_ADDRESSES, SOURCES } from "../chain.js";

/**
 * Who holds the token now. Primary source is the Pons Portal holders endpoint
 * (a Blockscout proxy, 50 per page, sorted by balance); the fallback rebuilds
 * balances from the same Transfer history the checkpoints already use. Both
 * paths exclude infrastructure — curve, pool manager, locker, escrow, burn —
 * because those hold float, not conviction.
 * Reconstruction pattern adapted from novamp (MIT) — https://github.com/bored2boar/novamp
 */

export interface HolderSnapshot {
  /** Real holders (infrastructure excluded), sorted by balance, top slice only. */
  top: { wallet: string; balance: bigint }[];
  /** Share of supply held by the top 10 real holders, percent. */
  top10Pct: number;
  /** Real holder count; when capped, `countIsFloor` is true and this is "at least". */
  holderCount: number;
  countIsFloor: boolean;
  source: "pons-api" | "blockscout" | "transfers";
  complete: boolean;
}

/** Holder count stops mattering to carat past 250 (score caps), so pagination stops soon after. */
const COUNT_CAP = 320;
const PAGES_MAX = 7;

const isInfra = (address: string, curve: string): boolean => {
  const lower = address.toLowerCase();
  return lower === curve.toLowerCase() || INFRA_ADDRESSES.has(lower) || BURN_ADDRESSES.has(lower);
};

export async function readHoldersFromPonsApi(token: Address, curve: Address, totalSupply: bigint): Promise<HolderSnapshot | null> {
  const real: { wallet: string; balance: bigint }[] = [];
  let params = "";
  let pages = 0;
  let exhausted = false;
  try {
    while (pages < PAGES_MAX) {
      const res = await fetch(`${SOURCES.ponsApi}/token/${token}/holders${params}`, {
        headers: { accept: "application/json", "user-agent": "gemhog/0.2" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { ok: boolean; holders?: { address: string; balance: string }[]; next_page_params?: Record<string, string | number> | null };
      if (!data.ok || !data.holders) return null;
      pages++;
      for (const h of data.holders) {
        if (!isInfra(h.address, curve)) real.push({ wallet: h.address, balance: BigInt(h.balance) });
      }
      if (!data.next_page_params) { exhausted = true; break; }
      if (real.length >= COUNT_CAP) break;
      params = "?" + new URLSearchParams(Object.entries(data.next_page_params).map(([k, v]) => [k, String(v)])).toString();
    }
  } catch {
    return null;
  }
  const top10 = real.slice(0, 10).reduce((sum, h) => sum + h.balance, 0n);
  return {
    top: real.slice(0, 25),
    top10Pct: totalSupply > 0n ? Number((top10 * 10_000n) / totalSupply) / 100 : 0,
    holderCount: real.length,
    countIsFloor: !exhausted,
    source: "pons-api",
    complete: true,
  };
}

/**
 * The keyed Blockscout instance as the second fast source: exact holder count
 * from the token counters, top-50 page for concentration. Used when the Pons
 * API is rate-limited; the full Transfer replay stays the last resort.
 */
export async function readHoldersFromBlockscout(token: Address, curve: Address, totalSupply: bigint): Promise<HolderSnapshot | null> {
  const { blockscoutFetch, blockscoutKey } = await import("../blockscout.js");
  if (!blockscoutKey()) return null;
  try {
    const [info, page] = await Promise.all([
      blockscoutFetch(`/api/v2/tokens/${token}`) as Promise<{ holders_count?: string; holders?: string }>,
      blockscoutFetch(`/api/v2/tokens/${token}/holders`) as Promise<{ items?: { address: { hash: string } | string; value: string }[] }>,
    ]);
    const rawCount = Number(info.holders_count ?? info.holders ?? 0);
    const real: { wallet: string; balance: bigint }[] = [];
    let infraSeen = 0;
    for (const item of page.items ?? []) {
      const wallet = typeof item.address === "string" ? item.address : item.address.hash;
      if (isInfra(wallet, curve)) { infraSeen++; continue; }
      real.push({ wallet, balance: BigInt(item.value) });
    }
    if (!rawCount && !real.length) return null;
    const top10 = real.slice(0, 10).reduce((sum, h) => sum + h.balance, 0n);
    return {
      top: real.slice(0, 25),
      top10Pct: totalSupply > 0n ? Number((top10 * 10_000n) / totalSupply) / 100 : 0,
      holderCount: Math.max(0, rawCount - infraSeen),
      countIsFloor: false,
      source: "blockscout",
      complete: true,
    };
  } catch {
    return null;
  }
}

/** Balance map for every wallet, replayed from the full Transfer history. */
export function balancesFromTransfers(transfers: { from: string; to: string; value: bigint }[]): Map<string, bigint> {
  const balances = new Map<string, bigint>();
  for (const t of transfers) {
    const from = t.from.toLowerCase();
    const to = t.to.toLowerCase();
    if (from !== "0x0000000000000000000000000000000000000000") {
      balances.set(from, (balances.get(from) ?? 0n) - t.value);
    }
    balances.set(to, (balances.get(to) ?? 0n) + t.value);
  }
  return balances;
}

export function holdersFromTransfers(transfers: { from: string; to: string; value: bigint }[], curve: string, totalSupply: bigint, complete: boolean): HolderSnapshot {
  const balances = balancesFromTransfers(transfers);
  const real: { wallet: string; balance: bigint }[] = [];
  for (const [wallet, balance] of balances) {
    if (balance > 0n && !isInfra(wallet, curve)) real.push({ wallet, balance });
  }
  real.sort((a, b) => (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0));
  const top10 = real.slice(0, 10).reduce((sum, h) => sum + h.balance, 0n);
  return {
    top: real.slice(0, 25),
    top10Pct: totalSupply > 0n ? Number((top10 * 10_000n) / totalSupply) / 100 : 0,
    holderCount: real.length,
    countIsFloor: !complete,
    source: "transfers",
    complete,
  };
}
