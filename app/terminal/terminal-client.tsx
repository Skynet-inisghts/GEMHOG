"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { renderCertificate } from "@/lib/gemhog/certificate";
import { gradeTone } from "@/lib/gemhog/grade/grade";
import type { CertificateReport } from "@/lib/gemhog/grade/types";
import { demoReport, renderDemo } from "@/lib/gemhog/demo";

interface ClusterRow {
  token: string;
  symbol: string;
  ageSec: number;
  phase: string;
  holders: string;
}

type Result =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "report"; report: CertificateReport; text: string }
  | { kind: "demo"; text: string }
  | { kind: "cluster"; rows: ClusterRow[]; note: string };

const fmtAge = (sec: number): string => {
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`;
};

export default function TerminalClient() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Result>({ kind: "idle" });
  const preRef = useRef<HTMLPreElement>(null);

  const run = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setResult({ kind: "loading" });
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ kind: "error", message: data.error ?? `request failed (${res.status})` });
      } else if (data.cluster) {
        setResult({ kind: "cluster", rows: data.cluster, note: data.note ?? "" });
      } else {
        setResult({ kind: "report", report: data, text: renderCertificate(data) });
      }
    } catch {
      setResult({ kind: "error", message: "network error; the API did not answer" });
    }
  }, []);

  const showDemo = useCallback(() => {
    setResult({ kind: "demo", text: renderDemo(demoReport()) });
  }, []);

  // /terminal?token=0x… deep-links straight into a check (used by /holders rows).
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) return;
    const id = setTimeout(() => {
      setInput(token);
      void run(token);
    }, 0);
    return () => clearTimeout(id);
  }, [run]);

  const cardSrc =
    result.kind === "report" && !result.report.tooEarly
      ? `/api/card?token=${result.report.token}`
      : result.kind === "demo"
        ? "/api/card?demo=1"
        : null;

  const shareImage = useCallback(async () => {
    if (!cardSrc) return;
    try {
      const res = await fetch(cardSrc);
      if (!res.ok) return;
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = result.kind === "report"
        ? `gemhog-${result.report.symbol.toUpperCase()}-${result.report.score}.png`
        : "gemhog-demo-card.png";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { /* the card image itself stays on screen */ }
  }, [cardSrc, result]);

  const [copied, setCopied] = useState(false);
  const copyLink = useCallback(async () => {
    if (result.kind !== "report") return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/terminal?token=${result.report.token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard can be blocked; the URL bar still has the link */ }
  }, [result]);

  return (
    <main className="term-page">
      <header className="site-nav">
        <Link className="site-brand" href="/" aria-label="GEMHOG home">
          <Image src="/avatar-sniffer.png" width={30} height={30} alt="" />
          <b>GEMHOG</b>
          <span>terminal</span>
        </Link>
        <nav aria-label="Site navigation">
          <Link href="/holders">Holder check</Link>
          <Link href="/">Home</Link>
        </nav>
      </header>

      <div className="term-layout">
        <aside className="term-side">
          <div className="term-pig">
            <Image src="/sprite-sniffer.png" width={170} height={187} alt="GEMHOG pixel pig" />
          </div>
          <p>
            Paste a Pons V2 contract address, or a ticker. The engine finds the buyers of the
            first minute and reports who is still holding.
          </p>
          <button className="cta-secondary term-demo" onClick={showDemo}>Offline demo</button>
          <div className="term-safety">
            <span>reads public state only</span>
            <span>no wallet, no signatures</span>
            <span>a grade is not financial advice</span>
          </div>
        </aside>

        <section className="term-main">
          <form
            className="term-form"
            onSubmit={(e) => { e.preventDefault(); void run(input); }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="0x contract address or ticker"
              spellCheck={false}
              aria-label="Token contract address or ticker"
            />
            <button className="cta-primary" type="submit" disabled={result.kind === "loading"}>
              {result.kind === "loading" ? "Reading the chain" : "Grade it"}
            </button>
          </form>

          {result.kind === "idle" && (
            <div className="term-empty">
              <b>&gt;</b>
              <p>
                A certificate takes a few seconds on a fresh token and up to a minute on a
                week-old one: the engine replays every transfer since launch. Try the offline
                demo to see the shape instantly.
              </p>
            </div>
          )}

          {result.kind === "loading" && (
            <div className="term-empty"><b className="term-blink">&gt;</b><p>reading launch, cohort, transfers, holders and escrow…</p></div>
          )}

          {result.kind === "error" && <div className="term-error">{result.message}</div>}

          {result.kind === "cluster" && (
            <div className="term-cluster">
              <p>{result.note}</p>
              <table>
                <thead><tr><th>symbol</th><th>age</th><th>phase</th><th>holders</th><th>token</th></tr></thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.token} onClick={() => { setInput(row.token); void run(row.token); }}>
                      <td>${row.symbol}</td><td>{fmtAge(row.ageSec)}</td><td>{row.phase}</td><td>{row.holders}</td>
                      <td className="term-addr">{row.token}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="term-hint">pick a row to grade that launch</p>
            </div>
          )}

          {(result.kind === "report" || result.kind === "demo") && (
            <div className="term-result">
              {result.kind === "report" ? (
                <div className={`term-grade tone-${gradeTone(result.report.grade)}`}>
                  <b>{result.report.grade}</b>
                  {!result.report.tooEarly && <span>{result.report.score} / 100</span>}
                </div>
              ) : (
                <div className="term-grade tone-faint"><b>DEMO</b><span>synthetic data</span></div>
              )}
              <pre ref={preRef}>{result.text}</pre>
              {result.kind === "report" && result.report.tooEarly && (
                <p className="term-hint">card unlocks at 5m</p>
              )}
              {cardSrc && (
                <div className="term-card">
                  {/* eslint-disable-next-line @next/next/no-img-element -- generated at request time, next/image adds nothing */}
                  <img src={cardSrc} alt="Share card for this certificate" loading="lazy" width={540} height={540} />
                </div>
              )}
              <div className="term-tools">
                {cardSrc && <button className="cta-secondary" onClick={() => void shareImage()}>Share as image</button>}
                {result.kind === "report" && (
                  <button className="cta-secondary" onClick={() => void copyLink()}>{copied ? "Link copied" : "Copy link"}</button>
                )}
                {result.kind === "report" ? (
                  <span className="term-provenance">
                    block {result.report.block} · observed {result.report.observedAt.slice(0, 19).replace("T", " ")} UTC ·{" "}
                    {result.report.rpcCalls} rpc calls · holders via {result.report.holdersSource} · sources: robinhood rpc, pons api
                  </span>
                ) : (
                  <span className="term-provenance">no network requests were made · reproduce locally: pnpm demo</span>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
