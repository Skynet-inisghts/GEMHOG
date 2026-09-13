import type { Address } from "viem";
import { checkToken, type CheckOptions } from "./check.js";
import type { CertificateReport } from "./grade/types.js";
import { certTtlMs, coalesce, TtlCache } from "./web.js";

/**
 * One certificate store for every API route on an instance. The grade route
 * computes it, the card route reuses it seconds later — without this, one
 * page view cost two full chain reads for the same token.
 */

const certificates = new TtlCache<CertificateReport>(300);

/** The cached certificate if this instance has it; no reads either way. */
export function peekCertificate(token: Address): CertificateReport | undefined {
  return certificates.get(token.toLowerCase());
}

export async function getCertificate(token: Address, options?: CheckOptions): Promise<CertificateReport> {
  const key = token.toLowerCase();
  const hit = certificates.get(key);
  if (hit) return hit;
  const report = await coalesce(`cert:${key}`, () => checkToken(token, options));
  certificates.set(key, report, report.tooEarly ? 30_000 : certTtlMs(report.ageSec));
  return report;
}
