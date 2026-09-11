import { BURN_ADDRESSES, INFRA_ADDRESSES } from "../chain.js";
import type { Cohort, CohortWallet, GradeSource } from "./types.js";

/**
 * The early cohort: unique buy recipients in the first 60 seconds after
 * launch. A quiet launch widens to the first 20 buyers, but never past 10
 * minutes. The deployer, the fee recipient, infrastructure, and the declared
 * bundle (wallets exempted from the opening tax in the launch calldata) are
 * excluded: none of them are strangers choosing to hold.
 *
 * The opening tax splits the rest: ~99% of the buy burned means a bot raced
 * the first block, near zero means a wallet waited on purpose. Buyers at or
 * under 15% form the human subset, and it carries the score when at least 10
 * wallets strong — both counts are always printed.
 */

const HUMAN_TAX_BPS = 1500;
const EARLY_WINDOW_SEC = 60;
const EXPANDED_WINDOW_SEC = 600;
const EXPANDED_MIN = 20;

export function buildCohort(source: GradeSource): Cohort {
  const { launch, trades, secPerBlock } = source;
  const devAddresses = new Set([launch.deployer.toLowerCase(), launch.creatorFeeRecipient.toLowerCase()]);
  const bundle = new Set(launch.exemptions.map((a) => a.toLowerCase()));
  const excluded = { infra: 0, dev: 0, bundle: 0 };

  const firstBuys = new Map<string, CohortWallet>();
  for (const trade of trades) {
    if (trade.kind !== "buy") continue;
    const lagSec = (trade.block - launch.launchBlock) * secPerBlock;
    if (lagSec > EXPANDED_WINDOW_SEC) break;
    const key = trade.wallet.toLowerCase();
    if (firstBuys.has(key)) continue;
    if (INFRA_ADDRESSES.has(key) || BURN_ADDRESSES.has(key) || key === launch.curve.toLowerCase()) { excluded.infra++; continue; }
    if (devAddresses.has(key)) { excluded.dev++; continue; }
    if (bundle.has(key)) { excluded.bundle++; continue; }
    firstBuys.set(key, {
      wallet: trade.wallet,
      quoteInWei: trade.quoteWei,
      taxBps: trade.quoteWei > 0n ? Number((trade.taxWei * 10_000n) / trade.quoteWei) : 0,
      firstBuyBlock: trade.block,
    });
  }

  const ordered = [...firstBuys.values()].sort((a, b) => a.firstBuyBlock - b.firstBuyBlock);
  const withinFirstMinute = ordered.filter((w) => (w.firstBuyBlock - launch.launchBlock) * secPerBlock <= EARLY_WINDOW_SEC);

  let all: CohortWallet[];
  let windowSec: number;
  if (withinFirstMinute.length >= EXPANDED_MIN) {
    all = withinFirstMinute;
    windowSec = EARLY_WINDOW_SEC;
  } else {
    all = ordered.slice(0, Math.max(withinFirstMinute.length, Math.min(EXPANDED_MIN, ordered.length)));
    windowSec = all.length > withinFirstMinute.length ? EXPANDED_WINDOW_SEC : EARLY_WINDOW_SEC;
  }

  const human = all.filter((w) => w.taxBps <= HUMAN_TAX_BPS);
  return {
    all,
    human,
    scoredIsHuman: human.length >= 10,
    windowSec,
    excluded,
    bundleWallets: [...bundle],
  };
}
