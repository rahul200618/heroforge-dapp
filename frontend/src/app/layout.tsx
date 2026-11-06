import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ConnectButton, NetworkBanner } from "@/components/Chrome";
import { WalletProvider } from "@/lib/wallet";
import "./globals.css";

export const metadata: Metadata = {
  title: "HeroForge",
  description: "Own your character. Own your progress.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <header className="site-header">
            <Link href="/" className="brand">HeroForge</Link>
            <nav>
              <Link href="/">Characters</Link>
              <Link href="/activity">Activity</Link>
            </nav>
            <span className="spacer" />
            <ConnectButton />
          </header>
          <main className="container">
            <NetworkBanner />
            {children}
          </main>
        </WalletProvider>
      </body>
    </html>
  );
}
