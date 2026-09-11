"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { gradeTone } from "@/lib/gemhog/grade/grade";
import { exampleReceipt, renderExampleReceipt } from "@/lib/gemhog/receipt";

/**
 * Holder Check. The one rule that matters here: an injected wallet is asked
 * for exactly one thing, `eth_requestAccounts` — the public address. No
 * signatures, no approvals, no network switching, ever. CI greps for signing
 * primitives on every commit.
 */

interface EthereumProvider {
  request(args: { method: "eth_requestAccounts" }): Promise<string[]>;
}

interface HolderRow {
  token: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  pctOfSupply: number;
  grade: string | null;
  score: number | null;
  tooEarly?: boolean;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "rows"; wallet: string; rows: HolderRow[]; grading: boolean };

const AUTO_GRADE = 6;

const fmtBalance = (raw: string, decimals: number): string => {
  const v = Number(raw) / 10 ** decimals;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
};

export default function HoldersPage() {
  const [input, setInput] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [showExample, setShowExample] = useState(false);

  const gradeOne = useCallback(async (token: string): Promise<Partial<HolderRow>> => {
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) return { grade: "unreadable", score: null };
      return { grade: data.grade, score: data.tooEarly ? null : data.score, tooEarly: data.tooEarly };
    } catch {
      return { grade: "unreadable", score: null };
    }
  }, []);

  const gradeRows = useCallback(async (wallet: string, rows: HolderRow[], limit: number) => {
    const targets = rows.filter((r) => r.grade === null).slice(0, limit);
    for (const target of targets) {
      const patch = await gradeOne(target.token);
      setState((prev) => {
        if (prev.kind !== "rows" || prev.wallet !== wallet) return prev;
        return { ...prev, rows: prev.rows.map((r) => (r.token === target.token ? { ...r, ...patch } : r)) };
      });
    }
    setState((prev) => (prev.kind === "rows" && prev.wallet === wallet ? { ...prev, grading: false } : prev));
  }, [gradeOne]);

  const load = useCallback(async (wallet: string) => {
    const trimmed = wallet.trim();
    if (!trimmed) return;
    setShowExample(false);
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/holder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? `request failed (${res.status})` });
        return;
      }
      const rows: HolderRow[] = data.tokens.map((t: Omit<HolderRow, "grade" | "score">) => ({ ...t, grade: null, score: null }));
      if (!rows.length) {
        setState({ kind: "error", message: `no pons tokens on ${data.wallet}` });
        return;
      }
      setState({ kind: "rows", wallet: data.wallet, rows, grading: true });
      void gradeRows(data.wallet, rows, AUTO_GRADE);
    } catch {
      setState({ kind: "error", message: "network error; the API did not answer" });
    }
  }, [gradeRows]);

  const connect = useCallback(async () => {
    const ethereum = (window as { ethereum?: EthereumProvider }).ethereum;
    if (!ethereum) {
      setState({ kind: "error", message: "no injected wallet found in this browser; paste a public address instead" });
      return;
    }
    try {
      // The one and only wallet call this site ever makes.
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      if (accounts[0]) {
        setInput(accounts[0]);
        void load(accounts[0]);
      }
    } catch {
      setState({ kind: "error", message: "the wallet declined to share an address; paste one instead" });
    }
  }, [load]);

  const gradeSingle = useCallback((wallet: string, token: string) => {
    setState((prev) => {
      if (prev.kind !== "rows") return prev;
      return { ...prev, rows: prev.rows.map((r) => (r.token === token ? { ...r, grade: "…" } : r)) };
    });
    void gradeOne(token).then((patch) => {
      setState((prev) => {
        if (prev.kind !== "rows" || prev.wallet !== wallet) return prev;
        return { ...prev, rows: prev.rows.map((r) => (r.token === token ? { ...r, ...patch } : r)) };
      });
    });
  }, [gradeOne]);

  return (
    <main className="term-page">
      <header className="site-nav">
        <Link className="site-brand" href="/" aria-label="GEMHOG home">
          <Image src="/avatar-sniffer.png" width={30} height={30} alt="" />
          <b>GEMHOG</b>
          <span>holder check</span>
        </Link>
        <nav aria-label="Site navigation">
          <Link href="/terminal">Terminal</Link>
          <Link href="/">Home</Link>
        </nav>
      </header>

      <div className="term-layout">
        <aside className="term-side">
          <div className="term-pig">
            <Image src="/avatar-sitter.png" width={150} height={150} alt="GEMHOG pixel pig" />
          </div>
          <p>
            Every pons token in a wallet, each with its grade. Connecting shares one thing
            with this site: the public address. No signatures, no approvals, no network
            switching. That is the whole exchange.
          </p>
          <button className="cta-secondary term-demo" onClick={() => { setShowExample(true); setState({ kind: "idle" }); }}>
            View example receipt
          </button>
          <div className="term-safety">
            <span>only eth_requestAccounts, nothing else</span>
            <span>works with a pasted address too</span>
            <span>a grade is not financial advice</span>
          </div>
        </aside>

        <section className="term-main">
          <form className="term-form" onSubmit={(e) => { e.preventDefault(); void load(input); }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="paste a public address (0x…)"
              spellCheck={false}
              aria-label="Public EVM address"
            />
            <button className="cta-primary" type="submit" disabled={state.kind === "loading"}>
              {state.kind === "loading" ? "Reading wallet" : "Check holdings"}
            </button>
            <button className="cta-secondary" type="button" onClick={() => void connect()}>Connect</button>
          </form>

          {state.kind === "idle" && !showExample && (
            <div className="term-empty">
              <b>&gt;</b>
              <p>
                Paste any public address, or connect a wallet that shares only its address.
                The first {AUTO_GRADE} tokens grade automatically; the rest grade on demand,
                because each certificate replays that token&apos;s history.
              </p>
            </div>
          )}

          {showExample && (
            <div className="term-result">
              <div className="term-grade tone-faint"><b>EXAMPLE</b><span>synthetic numbers</span></div>
              <pre>{renderExampleReceipt(exampleReceipt())}</pre>
              <span className="term-provenance">the live $GEMHOG receipt activates at launch · until then the contract is TBA</span>
            </div>
          )}

          {state.kind === "loading" && (
            <div className="term-empty"><b className="term-blink">&gt;</b><p>listing the wallet&apos;s pons tokens…</p></div>
          )}

          {state.kind === "error" && <div className="term-error">{state.message}</div>}

          {state.kind === "rows" && (
            <div className="term-cluster">
              <p>
                {state.rows.length} pons token{state.rows.length === 1 ? "" : "s"} on {state.wallet.slice(0, 8)}…{state.wallet.slice(-6)}
                {state.grading ? " · grading the largest holdings…" : ""}
              </p>
              <table>
                <thead><tr><th>grade</th><th>symbol</th><th>balance</th><th>% supply</th><th>token</th></tr></thead>
                <tbody>
                  {state.rows.map((row) => (
                    <tr key={row.token}>
                      <td>
                        {row.grade === null ? (
                          <button className="term-grade-btn" onClick={() => gradeSingle(state.wallet, row.token)}>grade</button>
                        ) : row.grade === "…" ? (
                          <span className="term-blink">…</span>
                        ) : (
                          <b className={`term-grade-cell tone-${row.grade === "unreadable" || row.tooEarly ? "faint" : gradeTone(row.grade)}`}>
                            {row.grade}{row.score !== null ? ` ${row.score}` : ""}
                          </b>
                        )}
                      </td>
                      <td>${row.symbol}</td>
                      <td>{fmtBalance(row.balance, row.decimals)}</td>
                      <td>{row.pctOfSupply.toFixed(3)}%</td>
                      <td className="term-addr">
                        <Link href={`/terminal?token=${row.token}`}>{row.token}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="term-hint">a full certificate is one click away: open any token in the terminal</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
