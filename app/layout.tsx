import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const tiny5 = localFont({
  src: "../assets/fonts/Tiny5-Regular.ttf",
  variable: "--font-display",
  weight: "400",
});

const jetbrainsMono = localFont({
  src: "../assets/fonts/JetBrainsMono[wght].ttf",
  variable: "--font-mono",
  weight: "100 800",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://gemhog.vercel.app"),
  title: "GEMHOG · Diamond-Hands Terminal",
  description:
    "Grade the hands before the bag. A browser and local CLI for grading holder retention of Pons V2 tokens on Robinhood Chain.",
  keywords: ["Robinhood Chain", "Pons V2", "holder retention", "diamond hands", "crypto"],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${tiny5.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
