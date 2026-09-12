import type { Address } from "viem";
import { blockscoutFetch } from "../blockscout.js";

/**
 * Who deployed a contract, for one purpose: when a pasted token is not a
 * pons v2 launch, the error can say what it actually is ("created by
 * DopplerERC20V1Factory") instead of leaving the user guessing. Best-effort;
 * silence degrades to the plain message.
 */
export async function creatorLabel(token: Address): Promise<string | null> {
  try {
    const addr = (await blockscoutFetch(`/api/v2/addresses/${token}`)) as { creator_address_hash?: string };
    if (!addr.creator_address_hash) return null;
    const creator = (await blockscoutFetch(`/api/v2/addresses/${addr.creator_address_hash}`)) as { is_contract?: boolean; name?: string };
    if (!creator.is_contract) return "an EOA (a wallet deployed it directly, no launchpad)";
    return creator.name ? `the ${creator.name} contract` : "a different, unnamed contract";
  } catch {
    return null;
  }
}
