import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Holder Check · GEMHOG",
  description: "Every pons token in a public wallet, each with a grade. Arrives in 0.3.",
};

export default function HoldersPage() {
  return (
    <main className="stub-page">
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
      <div className="stub-main">
        <div className="stub-card">
          <p className="stub-tag">coming in 0.3</p>
          <h1>Holder check</h1>
          <p>
            Paste any public address, or connect a wallet that shares only its address, and read
            every pons token it holds with a grade next to each. Plus a holder receipt for the
            official $GEMHOG once it is live.
          </p>
          <p>
            The boundary is already fixed: the page will request one thing from an injected
            wallet, the public address. No signatures, no approvals, no network switching. CI
            fails the build if a signing primitive ever appears in this repository.
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
