import { ADDR, CHAIN_ID, publicClient, SOURCES } from "./chain.js";
import { factoryAbi } from "./abi/pons.js";
import { endpoints, rpcCallCount } from "./rpc.js";
import { bps, lpad, pad } from "./fmt.js";

/**
 * `gemhog doctor`: prove every source this tool reads is reachable and that
 * the pons addresses baked into chain.ts still match the live factory. All
 * reads, no writes; a red line here means grades cannot be trusted yet.
 */

/** A graduated Pons V2 token used as a public probe target. Not the GEMHOG contract. */
export const EXAMPLE_TOKEN = "0xac79255f6f404eba14f316e8669d76573a2d7b1e";

export interface DoctorCheck {
  name: string;
  ok: boolean;
  latencyMs: number;
  detail: string;
}

export interface DoctorReport {
  ok: boolean;
  chainId: number;
  checks: DoctorCheck[];
  rpcCalls: number;
  ms: number;
  observedAt: string;
}

async function timed(name: string, run: () => Promise<{ ok: boolean; detail: string }>): Promise<DoctorCheck> {
  const started = Date.now();
  try {
    const { ok, detail } = await run();
    return { name, ok, latencyMs: Date.now() - started, detail };
  } catch (e) {
    return { name, ok: false, latencyMs: Date.now() - started, detail: (e as Error).message.split("\n")[0].slice(0, 120) };
  }
}

/** One raw eth_chainId against a single endpoint, outside the gate, so each endpoint is measured alone. */
async function probeEndpoint(url: string): Promise<{ ok: boolean; detail: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "gemhog/0.1" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    signal: AbortSignal.timeout(12_000),
  });
  const data = (await res.json()) as { result?: string };
  const id = data.result ? parseInt(data.result, 16) : 0;
  return { ok: res.ok && id === CHAIN_ID, detail: `eth_chainId ${id || "unreadable"}` };
}

async function probeJson(url: string, accept: (data: unknown) => boolean, detail: (data: unknown) => string): Promise<{ ok: boolean; detail: string }> {
  const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "gemhog/0.1" }, signal: AbortSignal.timeout(12_000) });
  const data: unknown = JSON.parse(await res.text());
  return { ok: res.ok && accept(data), detail: detail(data) };
}

/** Blockscout goes through its own gate: x-api-key auth, 5 req/s spacing, challenge detection. */
async function probeBlockscout(): Promise<{ ok: boolean; detail: string }> {
  const { blockscoutFetch, blockscoutKey } = await import("./blockscout.js");
  try {
    const data = (await blockscoutFetch(`/api/v2/tokens/${EXAMPLE_TOKEN}`)) as { symbol?: string };
    const keyNote = blockscoutKey() ? " (keyed)" : "";
    return { ok: typeof data.symbol === "string", detail: `knows $${data.symbol ?? "?"}${keyNote}` };
  } catch (e) {
    return { ok: false, detail: (e as Error).message.slice(0, 120) };
  }
}

/**
 * The factory itself is the authority on the escrow, hook and deployer
 * addresses: one multicall compares chain.ts against `feeEscrow()`,
 * `memeHook()`, `launchDeployer()` and reads the opening-tax parameters.
 */
async function probeFactory(): Promise<DoctorCheck[]> {
  const f = { address: ADDR.ponsFactory, abi: factoryAbi } as const;
  const started = Date.now();
  const r = await publicClient.multicall({
    allowFailure: true,
    contracts: [
      { ...f, functionName: "feeEscrow" },
      { ...f, functionName: "memeHook" },
      { ...f, functionName: "launchDeployer" },
      { ...f, functionName: "snipeTaxStartBps" },
      { ...f, functionName: "snipeTaxSeconds" },
      { ...f, functionName: "launchEnabled" },
    ],
  });
  const latencyMs = Date.now() - started;
  const val = <T,>(i: number): T | null => (r[i].status === "success" ? (r[i].result as T) : null);
  const addressCheck = (name: string, i: number, expected: string): DoctorCheck => {
    const got = val<string>(i);
    const ok = got !== null && got.toLowerCase() === expected.toLowerCase();
    return { name, ok, latencyMs, detail: got ? `factory says ${got}${ok ? "" : `, chain.ts says ${expected}`}` : "unreadable" };
  };
  const taxStart = val<bigint>(3);
  const taxSeconds = val<bigint>(4);
  const enabled = val<boolean>(5);
  return [
    addressCheck("factory.feeEscrow", 0, ADDR.ponsEscrow),
    addressCheck("factory.memeHook", 1, ADDR.ponsHook),
    addressCheck("factory.launchDeployer", 2, ADDR.ponsDeployer),
    {
      name: "opening tax",
      ok: taxStart !== null && taxSeconds !== null,
      latencyMs,
      detail: taxStart !== null && taxSeconds !== null
        ? `starts at ${bps(taxStart)}, decays over ${taxSeconds}s, launches ${enabled ? "enabled" : "disabled"}`
        : "snipeTaxStartBps / snipeTaxSeconds unreadable",
    },
  ];
}

export async function runDoctor(): Promise<DoctorReport> {
  const started = Date.now();
  const callsBefore = rpcCallCount();
  const [endpointChecks, factoryChecks, ponsApi, blockscout, dexscreener] = await Promise.all([
    Promise.all(endpoints.map((e) => timed(`rpc ${e.label}${e.logs ? " (logs)" : ""}`, () => probeEndpoint(e.url)))),
    probeFactory().catch((e: Error) => [{ name: "pons factory", ok: false, latencyMs: 0, detail: e.message.split("\n")[0].slice(0, 120) }]),
    timed("pons api", () => probeJson(`${SOURCES.ponsApi}/health`, (d) => (d as { ok?: boolean }).ok === true, () => "health ok")),
    timed("blockscout", () => probeBlockscout()),
    timed("dexscreener", () => probeJson(`${SOURCES.dexscreener}/latest/dex/tokens/${EXAMPLE_TOKEN}`, (d) => Array.isArray((d as { pairs?: unknown }).pairs), (d) => `${((d as { pairs?: unknown[] }).pairs ?? []).length} pairs for the example token`)),
  ]);
  const checks = [...endpointChecks, ...factoryChecks, ponsApi, blockscout, dexscreener];
  return {
    ok: checks.every((c) => c.ok),
    chainId: CHAIN_ID,
    checks,
    rpcCalls: rpcCallCount() - callsBefore,
    ms: Date.now() - started,
    observedAt: new Date().toISOString(),
  };
}

export function renderDoctor(report: DoctorReport, markdown = false): string {
  const rows = report.checks.map((c) =>
    `${pad(c.ok ? "OK" : "FAIL", 6)}${pad(c.name, 26)}${lpad(`${c.latencyMs}ms`, 8)}   ${c.detail}`,
  );
  const footer = `source  live · robinhood chain ${report.chainId} · ${report.rpcCalls} rpc calls · ${(report.ms / 1000).toFixed(1)}s · ${report.observedAt.slice(0, 16).replace("T", " ")} UTC`;
  const body = [...rows, "", footer].join("\n");
  return markdown ? ["```text", body, "```"].join("\n") : body;
}
