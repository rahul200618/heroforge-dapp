import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "HeroForge",
  description: "Own your character. Own your progress.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">HeroForge</Link>
          <nav>
            <Link href="/">Characters</Link>
            <Link href="/activity">Activity</Link>
          </nav>
          <span className="spacer" />
          {/* TODO: Connect wallet button and network indicator (docs/SCOPE.md, shared header) */}
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
