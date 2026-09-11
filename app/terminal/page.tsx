import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terminal · GEMHOG",
  description: "Ticker or contract address in, diamond-clarity certificate out. Arrives in 0.2.",
};

export default function TerminalPage() {
  return (
    <main className="stub-page">
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
      <div className="stub-main">
        <div className="stub-card">
          <p className="stub-tag">coming in 0.2</p>
          <h1>Terminal</h1>
          <p>
            Ticker or contract address in, certificate out: the early cohort, retention at six
            checkpoints, concentration, dev behaviour and the final grade. With an offline demo
            mode and share-as-image.
          </p>
          <div className="stub-cert">
            {"GRADE  "}<b>VVS1</b>{"   87 / 100\n"}
            {"cut 34/40 · clarity 16/20 · color 17/20 · carat 20/20\n"}
            {"sample shape · not live data"}
          </div>
          <p>
            Until then the same engine is reachable from the CLI: clone the repo and run
            pnpm demo for a marked synthetic walkthrough.
          </p>
          <div className="stub-actions">
            <Link className="cta-primary" href="/">Back to the landing</Link>
            <a className="cta-secondary" href="https://github.com/Skynet-inisghts/GEMHOG" target="_blank" rel="noreferrer">View source</a>
          </div>
        </div>
      </div>
    </main>
  );
}
