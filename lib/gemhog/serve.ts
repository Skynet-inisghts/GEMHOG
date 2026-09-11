import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { isAddress, getAddress } from "viem";
import { checkToken, CheckError } from "./check.js";
import { readWalletTokens, WalletListError } from "./read/wallet.js";
import { loadAlerts, loadHunt } from "./state.js";
import { PROJECT_TOKEN } from "./project-token.js";

/**
 * `gemhog serve`: a local JSON API for the Telegram bot. Binds to 127.0.0.1
 * and nothing else — this is a private socket between two processes on one
 * machine, not a public API. The bot implements zero grading logic; every
 * answer it sends a user comes from here.
 */

export const DEFAULT_PORT = 4664;
const startedAt = Date.now();

const json = (res: ServerResponse, status: number, body: unknown): void => {
  const text = JSON.stringify(body, null, 1);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(text) });
  res.end(text);
};

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const [, route, param] = url.pathname.split("/");

  if (req.method !== "GET") return json(res, 405, { error: "GET only" });

  if (route === "health") {
    // Liveness of the serve process itself; source health lives in `gemhog doctor`.
    return json(res, 200, { ok: true, service: "gemhog-serve", uptimeSec: Math.round((Date.now() - startedAt) / 1000) });
  }

  if (route === "check" && param) {
    if (!isAddress(param)) return json(res, 400, { error: "pass a token contract address" });
    try {
      return json(res, 200, await checkToken(getAddress(param)));
    } catch (error) {
      if (error instanceof CheckError) return json(res, 404, { error: error.message });
      return json(res, 502, { error: "chain read failed" });
    }
  }

  if (route === "top") {
    const hunt = loadHunt();
    if (!hunt) return json(res, 200, { rows: [], note: "no hunt yet; run gemhog hunt (ideally with --follow) next to serve" });
    return json(res, 200, { ...hunt, rows: hunt.rows.slice(0, 10) });
  }

  if (route === "holders" && param) {
    if (!isAddress(param)) return json(res, 400, { error: "pass a public EVM address" });
    try {
      const tokens = await readWalletTokens(getAddress(param));
      return json(res, 200, {
        wallet: getAddress(param),
        tokens: tokens.map((t) => ({ ...t, balance: t.balance.toString() })),
        projectToken: PROJECT_TOKEN,
      });
    } catch (error) {
      if (error instanceof WalletListError) return json(res, 502, { error: error.message });
      return json(res, 502, { error: "wallet read failed" });
    }
  }

  if (route === "alerts") {
    return json(res, 200, { alerts: loadAlerts(url.searchParams.get("since") ?? undefined) });
  }

  return json(res, 404, { error: "routes: /check/:token /top /holders/:wallet /alerts?since= /health" });
}

export function startServe(port = DEFAULT_PORT): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      void handle(req, res).catch(() => json(res, 500, { error: "internal" }));
    });
    server.on("error", reject);
    // 127.0.0.1 by design: the bot is the only intended client.
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      const boundPort = typeof address === "object" && address ? address.port : port;
      resolve({ port: boundPort, close: () => server.close() });
    });
  });
}
