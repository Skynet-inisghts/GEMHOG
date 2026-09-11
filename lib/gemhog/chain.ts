import { createPublicClient, defineChain, type Address } from "viem";
import { endpoints, gatedHttp } from "./rpc.js";

/**
 * Robinhood Chain mainnet. Chain id 4663, ETH gas, Arbitrum stack, ~100 ms blocks.
 * Adapted from bodkin (MIT) — https://github.com/Phosphenq/bodkin
 */
export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" },
  },
  contracts: {
    // Canonical Multicall3. The "L2 Multicall" listed in the chain docs at
    // 0x2cAC2D89… is not aggregate3-compatible.
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" as Address },
  },
});

/**
 * Every address below was read from the live factory (`memeHook()`,
 * `feeEscrow()`, `launchDeployer()`) via bodkin. `gemhog doctor` re-checks the
 * factory-derived ones on every run; do not edit them by hand.
 */
export const ADDR = {
  ponsFactory: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e" as Address,
  ponsRouter: "0xe33E9E479dF8802cb0866d5d05258bEc4cF62948" as Address,
  ponsDeployer: "0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42" as Address,
  ponsEscrow: "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e" as Address,
  ponsHook: "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044" as Address,
  ponsLocker: "0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952" as Address,
  weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as Address,
} as const;

export const ZERO: Address = "0x0000000000000000000000000000000000000000";

export const CHAIN_ID = 4663;

const headers = { "user-agent": "gemhog/0.1" };

/** The endpoints in use, for status lines. */
export const httpUrl = (): string => endpoints.map((e) => e.label).join(" + ");

/**
 * Both clients share one gate (rpc.ts): a list of public endpoints with
 * capabilities, single requests, bounded concurrency, 429 handled by waiting or
 * moving on. Multicall3 still folds a dozen contract reads into one eth_call,
 * which is the kind of batching every endpoint accepts.
 */
export const publicClient = createPublicClient({ chain: robinhood, transport: gatedHttp({ headers, timeoutMs: 20_000, retries: 8 }) });

/** Same gate, shorter timeout: interactive paths would rather fail fast and re-poll. */
export const fastClient = createPublicClient({ chain: robinhood, transport: gatedHttp({ headers, timeoutMs: 10_000, retries: 3 }) });

export const explorer = {
  tx: (h: string) => `https://robinhoodchain.blockscout.com/tx/${h}`,
  address: (a: string) => `https://robinhoodchain.blockscout.com/address/${a}`,
  token: (a: string) => `https://robinhoodchain.blockscout.com/token/${a}`,
  pons: (a: string) => `https://www.ponsfamily.com/token/${a}`,
  dexscreener: (a: string) => `https://dexscreener.com/robinhood/${a}`,
};

export const SOURCES = {
  ponsApi: "https://api.ponsportal.fun",
  blockscout: "https://robinhoodchain.blockscout.com",
  dexscreener: "https://api.dexscreener.com",
} as const;
