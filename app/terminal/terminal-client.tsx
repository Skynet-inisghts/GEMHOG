"use client";

import { useCallback, useEffect, useState } from "react";
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
  | { kind: "demo"; report: CertificateReport; text: string }
  | { kind: "cluster"; rows: ClusterRow[]; note: string };

const fmtAge = (sec: number): string => {
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`;
};

export default function TerminalClient() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Result>({ kind: "idle" });

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
    const report = demoReport();
    setResult({ kind: "demo", report, text: renderDemo(report) });
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
            <div className="term-sniffing">
              <div className="gemhog-dig" role="img" aria-label="The GEMHOG pig digging while the grade is computed" />
              <p><b>sniffing…</b> reading launch, cohort, transfers, holders and escrow</p>
            </div>
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
            <ReadableCertificate
              report={result.report}
              rawText={result.text}
              demo={result.kind === "demo"}
              cardSrc={cardSrc}
              onShare={() => void shareImage()}
              onCopyLink={result.kind === "report" ? () => void copyLink() : undefined}
              copied={copied}
            />
          )}
        </section>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------------ */
/* The readable certificate: the same numbers as the raw block, explained.  */

const GRADE_STORY: Record<ReturnType<typeof gradeTone>, string> = {
  vvs: "diamond hands: the first-minute buyers are holding tight",
  vs: "solid hands: most of the early cohort is still in",
  si: "slipping: the early cohort is thinning out",
  i: "dumped: the early buyers are gone",
};

const CHECKPOINT_ORDER = ["5m", "15m", "1h", "6h", "24h", "7d"] as const;

function ReadableCertificate({ report, rawText, demo, cardSrc, onShare, onCopyLink, copied }: {
  report: CertificateReport;
  rawText: string;
  demo: boolean;
  cardSrc: string | null;
  onShare: () => void;
  onCopyLink?: () => void;
  copied: boolean;
}) {
  const tone = gradeTone(report.grade);
  const held = CHECKPOINT_ORDER.filter((l) => report.cut.held[l] !== undefined)
    .map((l) => ({ label: l, pct: Math.round((report.cut.held[l] as number) * 100) }));

  if (report.tooEarly) {
    return (
      <div className="term-result">
        {demo && <div className="term-grade tone-faint"><b>DEMO</b><span>synthetic data</span></div>}
        <div className="cert-hero tone-faint">
          <b className="cert-grade-big">TOO EARLY</b>
          <p>
            ${report.symbol} is {Math.round(report.ageSec)} seconds old. The first checkpoint lands at 5 minutes;
            grade it again then. The card unlocks at the same moment.
          </p>
        </div>
        <details className="cert-raw"><summary>raw certificate</summary><pre>{rawText}</pre></details>
      </div>
    );
  }

  const components = [
    {
      key: "cut", name: "Cut", meaning: "retention", max: 40, score: report.cut.score,
      question: "Do the first-minute buyers still hold?",
      facts: [
        `${report.cut.cohort} wallets bought in the first minute (${report.cut.human} look human by the opening tax)`,
        `half-life: ${report.cut.halfLife === "not reached" ? "not reached yet" : report.cut.halfLife === "never" ? "never crossed" : `most of the cohort left by ${report.cut.halfLife}`}`,
      ],
      chips: held,
    },
    {
      key: "clarity", name: "Clarity", meaning: "concentration", max: 20, score: report.clarity.score,
      question: "Is the supply spread out, or in a few hands?",
      facts: [
        `top 10 wallets hold ${report.clarity.top10Pct.toFixed(1)}% of the supply`,
        report.clarity.bundleDeclared > 0
          ? `a declared bundle of ${report.clarity.bundleDeclared} wallets holds ${report.clarity.bundleHoldsPct.toFixed(1)}%`
          : "no declared bundle",
      ],
    },
    {
      key: "color", name: "Color", meaning: "dev behaviour", max: 20, score: report.color.score,
      question: "Is the dev still in the game?",
      facts: [
        report.color.devBoughtPct > 0 ? `dev bought ${report.color.devBoughtPct.toFixed(1)}% of the supply` : "dev did not buy their own token",
        report.color.devSells === 0 ? "dev has not sold" : `dev sold ${report.color.devSells === 1 ? "once" : `${report.color.devSells} times`}`,
        `${report.color.feeClaims24h} creator-fee claims in the first 24h`,
      ],
    },
    {
      key: "carat", name: "Carat", meaning: "weight", max: 20, score: report.carat.score,
      question: "Is anyone actually here?",
      facts: [
        `${report.carat.holders}${report.carat.holdersIsFloor ? "+" : ""} holders right now`,
        `the early cohort spent ${report.carat.cohortEth.toFixed(1)} ${report.carat.pairIsEth ? "ETH" : "quote"}`,
        `its top 3 buyers took ${Math.round(report.carat.top3Pct)}% of that`,
      ],
    },
  ];

  return (
    <div className="term-result">
      <div className="cert-layout">
        <div className="cert-main">
          {demo && <div className="term-grade tone-faint"><b>DEMO</b><span>synthetic data, the shape of a real certificate</span></div>}

          <div className={`cert-hero tone-${tone}`}>
            <div className="cert-hero-top">
              <b className="cert-grade-big">{report.grade}</b>
              <div className="cert-hero-score">
                <span className="cert-score">{report.score}<i>/100</i></span>
                <span className="cert-story">{GRADE_STORY[tone]}</span>
              </div>
            </div>
            <div className="cert-scale" aria-label={`Score ${report.score} of 100`}>
              <div className="cert-scale-zones"><i className="z-red" /><i className="z-yellow" /><i className="z-green" /></div>
              <span className="cert-scale-marker" style={{ left: `${Math.max(0, Math.min(100, report.score))}%` }} />
              <div className="cert-scale-labels"><span>1</span><span>35</span><span>70</span><span>100</span></div>
            </div>
            <p className="cert-hero-note">
              a grade on the diamond clarity scale, FL (flawless hands) down to I3 (everyone left).
              it measures the past, it does not predict.
            </p>
          </div>

          <div className="cert-grid">
            {components.map((c) => (
              <article key={c.key} className="cert-comp">
                <header>
                  <span className="cert-comp-name">{c.name}<i> · {c.meaning}</i></span>
                  <b>{c.score}<i>/{c.max}</i></b>
                </header>
                <div className="cert-bar"><i style={{ width: `${(c.score / c.max) * 100}%` }} /></div>
                <p className="cert-question">{c.question}</p>
                {c.chips && (
                  <div className="cert-chips" aria-label="Share of the cohort still holding at each checkpoint">
                    {c.chips.map((chip) => (
                      <span key={chip.label} className={chip.pct >= 50 ? "chip-good" : "chip-bad"}>
                        {chip.label}<b>{chip.pct}%</b>
                      </span>
                    ))}
                    {c.chips.length > 0 && <span className="cert-chip-note">% still holding</span>}
                  </div>
                )}
                <ul>
                  {c.facts.map((fact) => <li key={fact}>{fact}</li>)}
                </ul>
              </article>
            ))}
          </div>

          <details className="cert-raw">
            <summary>raw certificate, as the CLI prints it</summary>
            <pre>{rawText}</pre>
          </details>
        </div>

        {cardSrc && (
          <aside className="cert-side">
            <CardImage src={cardSrc} />
            <div className="term-tools">
              <button className="cta-secondary" onClick={onShare}>Download card</button>
              {onCopyLink && (
                <button className="cta-secondary" onClick={onCopyLink}>{copied ? "Link copied" : "Copy link"}</button>
              )}
            </div>
          </aside>
        )}
      </div>

      <span className="term-provenance">
        {demo
          ? "no network requests were made · reproduce locally: pnpm demo"
          : `block ${report.block} · observed ${report.observedAt.slice(0, 19).replace("T", " ")} UTC · ${report.rpcCalls} rpc calls · holders via ${report.holdersSource} · sources: robinhood rpc, pons api`}
      </span>
    </div>
  );
}


/** The share card with patience: the server may still be rendering it, so a
 *  failed load retries twice on its own before asking for a click. */
function CardImage({ src }: { src: string }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  // Give the server's warm render a head start so the first request lands on
  // the CDN copy instead of racing it.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setReady(true), 2_500);
    return () => clearTimeout(id);
  }, []);
  const url = attempt > 0 ? `${src}${src.includes("?") ? "&" : "?"}r=${attempt}` : src;
  if (!ready) return <div className="term-card"><div className="term-card-baking" aria-hidden="true" /></div>;
  if (failed) {
    return (
      <div className="term-card term-card-failed">
        <p>the card is still baking on the server</p>
        <button className="cta-secondary" onClick={() => { setFailed(false); setAttempt((a) => a + 1); }}>Retry card</button>
      </div>
    );
  }
  return (
    <div className="term-card">
      {/* eslint-disable-next-line @next/next/no-img-element -- generated at request time, next/image adds nothing */}
      <img
        key={url}
        src={url}
        alt="Share card for this certificate"
        loading="lazy"
        width={1080}
        height={1080}
        onError={() => {
          if (attempt < 5) setTimeout(() => setAttempt((a) => a + 1), 6000);
          else setFailed(true);
        }}
      />
    </div>
  );
}
