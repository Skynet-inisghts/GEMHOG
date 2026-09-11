import { parseAbi, type Address } from "viem";
import { publicClient } from "../chain.js";

/**
 * The token's own logo, as pons stores it: `getTokenInfo()` on the token
 * contract returns an ipfs:// reference, served through the pons gateway.
 * Missing, huge or unreachable logos degrade to null and the card draws its
 * grey initial circle instead.
 * Gateway mapping adapted from bodkin (MIT) — https://github.com/Phosphenq/bodkin
 */

const infoAbi = parseAbi([
  "struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }",
  "function getTokenInfo() view returns (address tokenDeployer, string tokenLogo, string tokenDescription, Socials tokenSocials)",
]);

const MAX_BYTES = 2 * 1024 * 1024;

export function logoUrl(logo: string): string {
  if (!logo) return "";
  if (logo.startsWith("ipfs://")) return `https://www.ponsfamily.com/api/ipfs/content/${logo.slice(7)}?variant=card`;
  if (logo.startsWith("http://") || logo.startsWith("https://")) return logo;
  return "";
}

export async function fetchTokenLogo(token: Address): Promise<Buffer | null> {
  try {
    const info = await publicClient.readContract({ address: token, abi: infoAbi, functionName: "getTokenInfo" });
    const url = logoUrl(info[1]);
    if (!url) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return null;
    return bytes;
  } catch {
    return null;
  }
}
