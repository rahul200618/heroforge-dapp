import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ConnectButton, NetworkBanner } from "@/components/Chrome";
import { WalletProvider } from "@/lib/wallet";
import "./globals.css";

export const metadata: Metadata = {
  title: "HeroForge — GameFi NFT RPG",
  description: "Own your character. Own your progress. On-chain GameFi RPG on Sepolia testnet.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <header className="site-header">
            <Link href="/" className="brand">
              <div className="brand-crest">⚔️</div>
              <span className="brand-text">HeroForge</span>
            </Link>
            <nav>
              <Link href="/" className="nav-link">
                <span>🏰</span>
                <span>Champions</span>
              </Link>
              <Link href="/activity" className="nav-link">
                <span>📜</span>
                <span>Chronicle</span>
              </Link>
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
