import { readFileSync } from "node:fs";

/** Load a fixture: JSON snapshots keep bigints as strings; the engine wants bigints. */
export function loadFixture(name) {
  const raw = JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
  return {
    ...raw,
    launch: {
      ...raw.launch,
      totalSupply: BigInt(raw.launch.totalSupply),
      devBuyWei: BigInt(raw.launch.devBuyWei),
      devTokens: BigInt(raw.launch.devTokens),
    },
    trades: raw.trades.map((t) => ({ ...t, quoteWei: BigInt(t.quoteWei), tokens: BigInt(t.tokens), taxWei: BigInt(t.taxWei) })),
    transfers: raw.transfers.map((t) => ({ ...t, value: BigInt(t.value) })),
    holders: { ...raw.holders, top: raw.holders.top.map((h) => ({ ...h, balance: BigInt(h.balance) })) },
    escrow: {
      creditedWei: BigInt(raw.escrow.creditedWei),
      claims: raw.escrow.claims.map((c) => ({ ...c, amountWei: BigInt(c.amountWei) })),
    },
  };
}
