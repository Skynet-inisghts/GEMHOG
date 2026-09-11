import Image from "next/image";
import Link from "next/link";
import { PROJECT_TOKEN, projectTokenLabel } from "@/lib/gemhog/project-token";

const REPO = "https://github.com/Skynet-inisghts/GEMHOG";

export default function Home() {
  return (
    <main className="landing">
      <header className="site-nav">
        <Link className="site-brand" href="/" aria-label="GEMHOG home">
          <Image src="/avatar-sniffer.png" width={30} height={30} alt="" />
          <b>GEMHOG</b>
          <span>pons v2 / chain 4663</span>
        </Link>
        <nav aria-label="Site navigation">
          <Link href="/terminal">Terminal</Link>
          <Link href="/holders">Holder check</Link>
          <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
          <Link className="nav-cta" href="/terminal">Open terminal</Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="hero-kicker"><b>v0.1</b> read-only terminal · robinhood chain 4663</p>
          <h1>GEMHOG</h1>
          <p className="hero-tagline">Grade the hands before the bag.</p>
          <p className="hero-deck">
            25,000 tokens launch on Pons every day. GEMHOG takes one, finds the buyers of its
            first minute and checks who is still holding at <b>5m, 15m, 1h, 6h, 24h and 7d</b>.
            The answer is a score out of 100 and a grade on the diamond clarity scale.
          </p>
          <div className="hero-actions">
            <Link className="cta-primary" href="/terminal">Open terminal</Link>
            <Link className="cta-secondary" href="/holders">Holder check</Link>
          </div>
          <div className="safety-row" aria-label="Safety boundaries">
            <span>no keys</span>
            <span>no signatures</span>
            <span>reads the chain, never writes</span>
          </div>
        </div>

        <div className="assay">
          <div className="assay-stage" aria-label="GEMHOG pig over a sample certificate">
            <div className="assay-head"><span>assay bench</span><b>sniffing for stones</b></div>
            <div className="assay-pig">
              <span className="assay-gem g1" aria-hidden="true">◆</span>
              <span className="assay-gem g2" aria-hidden="true">◇</span>
              <span className="assay-gem g3" aria-hidden="true">◆</span>
              <Image src="/sprite-sniffer.png" width={250} height={275} alt="GEMHOG pixel pig sniffing a diamond" priority />
            </div>
          </div>
          <div className="assay-cert" aria-label="Sample certificate shape">
            <div className="cert-grade"><b>VVS1</b><span>87 / 100</span></div>
            <div>cut 34/40 · clarity 16/20 · color 17/20 · carat 20/20</div>
            <div>early cohort 142 wallets · still holding 84% at 1h</div>
            <div className="cert-note">sample numbers · run a real check in the terminal</div>
          </div>
          <div className="grade-scale" aria-label="The clarity scale from FL to I3">
            <i className="gs-vvs">FL</i><i className="gs-vvs">IF</i><i className="gs-vvs">VVS1</i><i className="gs-vvs">VVS2</i>
            <i className="gs-vs">VS1</i><i className="gs-vs">VS2</i>
            <i className="gs-si">SI1</i><i className="gs-si">SI2</i>
            <i className="gs-i">I1</i><i className="gs-i">I2</i><i className="gs-i">I3</i>
          </div>
        </div>
      </section>

      <section className="statement">
        <span>The pig is the meme.</span><b>The certificate is the product.</b>
      </section>

      <section className="surfaces">
        <div className="surfaces-head">
          <h2>One engine, three doors</h2>
          <p>The browser, the CLI and the bot all read the same grading engine. Nothing signs, nothing trades.</p>
        </div>
        <div className="surface-grid">
          <article>
            <h3>Terminal</h3>
            <p>
              Paste a ticker or a contract address and read the certificate: how the early cohort
              held through six checkpoints, how concentrated the top wallets are, what the dev did,
              and whether anyone is actually there. Offline demo included, clearly marked.
            </p>
            <Link className="surface-link" href="/terminal">Open terminal</Link>
          </article>
          <article>
            <h3>Holder check</h3>
            <p>
              Paste any public address, or connect a wallet that shares only its address. Every
              pons token it holds comes back with a grade. No signatures, no approvals, no network
              switching: that promise is checked by CI on every commit.
            </p>
            <Link className="surface-link" href="/holders">Check a wallet</Link>
          </article>
          <article>
            <h3>CLI</h3>
            <p className="clone-block">
              <b>git clone</b> {REPO}.git{"\n"}
              <b>pnpm</b> install --frozen-lockfile{"\n"}
              <b>pnpm</b> demo
            </p>
            <p>
              Everything the site does, locally, plus hunt: the scanner that digs through a whole
              window of launches and keeps the stones. Hunt lives only in the CLI.
            </p>
            <a className="surface-link" href={REPO} target="_blank" rel="noreferrer">View source</a>
          </article>
        </div>
      </section>

      <section className="pulse">
        <span className="pulse-dot" aria-hidden="true" />
        <span>
          Launches graded <b>VS2 or better</b> in the last 6 hours: the live counter arrives with
          v0.4. The list itself lives in the CLI.
        </span>
        <small>pulse refreshes every 20 minutes once live</small>
      </section>

      <section className="token-rail">
        <b>{PROJECT_TOKEN.ticker}</b>
        <code>{projectTokenLabel()}</code>
        <small>
          {PROJECT_TOKEN.address
            ? "verify the contract on Pons and Blockscout before trading"
            : "contract address to be announced · Pons and Blockscout links go live at launch"}
        </small>
      </section>

      <footer className="site-footer">
        <span>GEMHOG v0.1.0 · MIT</span>
        <p>
          A grade is a measurement of past holder behaviour. It is not a prediction and not a
          proof that a token is safe.
        </p>
        <a href={REPO} target="_blank" rel="noreferrer">open source</a>
      </footer>
    </main>
  );
}
