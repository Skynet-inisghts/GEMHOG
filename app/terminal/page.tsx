import type { Metadata } from "next";
import { isAddress } from "viem";
import TerminalClient from "./terminal-client";

/**
 * The server wrapper exists for one thing: a shared /terminal?token=… link
 * unfurls into that token's live share card on X and Telegram.
 */
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ token?: string }> }): Promise<Metadata> {
  const { token } = await searchParams;
  if (!token || !isAddress(token)) {
    return { title: "Terminal · GEMHOG", description: "Ticker or contract address in, diamond-clarity certificate out." };
  }
  const card = `/api/card?token=${token}`;
  return {
    title: "Terminal · GEMHOG",
    description: "A live diamond-clarity certificate: early cohort, retention, concentration, dev behaviour.",
    openGraph: { images: [{ url: card, width: 1080, height: 1080 }] },
    twitter: { card: "summary_large_image", images: [card] },
  };
}

export default function TerminalPage() {
  return <TerminalClient />;
}
