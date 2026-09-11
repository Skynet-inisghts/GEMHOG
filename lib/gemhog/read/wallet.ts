import { getAddress, type Address } from "viem";
import { erc20Abi, factoryAbi } from "../abi/pons.js";
import { ADDR, publicClient, SOURCES } from "../chain.js";

/**
 * Every ERC-20 a wallet holds, narrowed to tokens the pons factory knows.
 * The listing comes from the Blockscout API — a standard JSON-RPC cannot
 * answer "which tokens does this address hold". On some networks Blockscout
 * fronts the API with a Cloudflare browser challenge; that case is reported
 * as a typed error so callers can fall back or explain the fix, never
 * silently shown as an empty wallet.
 */

export class WalletListError extends Error {
  constructor(message: string, public readonly reason: "challenge" | "http") {
    super(message);
  }
}

export interface WalletToken {
  token: Address;
  symbol: string;
  name: string;
  decimals: number;
  balance: bigint;
  /** Share of total supply, percent. */
  pctOfSupply: number;
}

interface BlockscoutTokenItem {
  token: { address?: string; address_hash?: string; symbol?: string; name?: string; decimals?: string; type?: string };
  value?: string;
}

async function fetchWalletErc20(wallet: Address): Promise<{ address: Address; symbol: string; name: string; decimals: number; balance: bigint }[]> {
  const key = process.env.BLOCKSCOUT_API_KEY?.trim();
  const out: { address: Address; symbol: string; name: string; decimals: number; balance: bigint }[] = [];
  let params = "type=ERC-20";
  for (let page = 0; page < 4; page++) {
    const url = `${SOURCES.blockscout}/api/v2/addresses/${wallet}/tokens?${params}${key ? `&apikey=${key}` : ""}`;
    const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "gemhog/0.3" }, signal: AbortSignal.timeout(15_000) });
    const text = await res.text();
    if (res.status === 403 && /just a moment|cloudflare|challenge/i.test(text)) {
      throw new WalletListError(
        "Blockscout answers this network with a bot challenge; set BLOCKSCOUT_API_KEY (free at dev.blockscout.com) or run from another network",
        "challenge",
      );
    }
    if (!res.ok) throw new WalletListError(`Blockscout returned HTTP ${res.status}`, "http");
    const data = JSON.parse(text) as { items?: BlockscoutTokenItem[]; next_page_params?: Record<string, string | number> | null };
    for (const item of data.items ?? []) {
      const raw = item.token.address_hash ?? item.token.address;
      if (!raw || item.token.type !== "ERC-20" || !item.value || item.value === "0") continue;
      out.push({
        address: getAddress(raw),
        symbol: item.token.symbol ?? "?",
        name: item.token.name ?? "",
        decimals: Number(item.token.decimals ?? 18) || 18,
        balance: BigInt(item.value),
      });
    }
    if (!data.next_page_params) break;
    params = "type=ERC-20&" + new URLSearchParams(Object.entries(data.next_page_params).map(([k, v]) => [k, String(v)])).toString();
  }
  return out;
}

/** Which of these tokens the pons factory launched, with each holding's share of supply. */
export async function filterPonsHoldings(
  holdings: { address: Address; symbol: string; name: string; decimals: number; balance: bigint }[],
): Promise<WalletToken[]> {
  if (!holdings.length) return [];
  const records = await publicClient.multicall({
    allowFailure: true,
    contracts: holdings.map((h) => ({
      address: ADDR.ponsFactory, abi: factoryAbi, functionName: "getLaunchedToken" as const, args: [h.address] as const,
    })),
  });
  const pons = holdings.filter((_, i) => {
    const r = records[i];
    return r.status === "success" && (r.result as { exists: boolean }).exists;
  });
  if (!pons.length) return [];
  const supplies = await publicClient.multicall({
    allowFailure: true,
    contracts: pons.map((h) => ({ address: h.address, abi: erc20Abi, functionName: "totalSupply" as const })),
  });
  return pons.map((h, i) => {
    const supply = supplies[i].status === "success" ? (supplies[i].result as bigint) : 0n;
    return {
      token: h.address,
      symbol: h.symbol,
      name: h.name,
      decimals: h.decimals,
      balance: h.balance,
      pctOfSupply: supply > 0n ? Number((h.balance * 100_000n) / supply) / 1000 : 0,
    };
  }).sort((a, b) => b.pctOfSupply - a.pctOfSupply);
}

export async function readWalletTokens(wallet: Address): Promise<WalletToken[]> {
  return filterPonsHoldings(await fetchWalletErc20(wallet));
}
