import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { marked } from "marked";
// The docs are the repository's own markdown, bundled at build time.
import methodology from "@/docs/METHODOLOGY.md";
import commands from "@/docs/COMMANDS.md";
import architecture from "@/docs/ARCHITECTURE.md";
import testing from "@/docs/TESTING.md";
import bot from "@/docs/BOT.md";

export const metadata: Metadata = {
  title: "Docs · GEMHOG",
  description: "Methodology, commands, architecture, testing and the bot: the repository docs, rendered.",
};

const SECTIONS = [
  { slug: "methodology", title: "Methodology", source: methodology },
  { slug: "commands", title: "Commands", source: commands },
  { slug: "architecture", title: "Architecture", source: architecture },
  { slug: "testing", title: "Testing", source: testing },
  { slug: "bot", title: "The bot", source: bot },
];

export default function DocsPage() {
  return (
    <main className="docs-page">
      <header className="site-nav">
        <Link className="site-brand" href="/" aria-label="GEMHOG home">
          <Image src="/avatar-sniffer.png" width={30} height={30} alt="" />
          <b>GEMHOG</b>
          <span>docs</span>
        </Link>
        <nav aria-label="Site navigation">
          <Link href="/terminal">Terminal</Link>
          <Link href="/holders">Holder check</Link>
          <Link href="/">Home</Link>
        </nav>
      </header>
      <div className="docs-shell">
        <aside className="docs-rail" aria-label="Document list">
          <span>the repository docs, rendered</span>
          {SECTIONS.map((s) => (
            <a key={s.slug} href={`#${s.slug}`}>{s.title}</a>
          ))}
          <a href="https://github.com/Skynet-inisghts/GEMHOG" target="_blank" rel="noreferrer">source on GitHub</a>
        </aside>
        <div className="docs-main">
          {SECTIONS.map((s) => (
            <section key={s.slug} id={s.slug} className="docs-section">
              <div dangerouslySetInnerHTML={{ __html: marked.parse(s.source as string, { async: false }) }} />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
