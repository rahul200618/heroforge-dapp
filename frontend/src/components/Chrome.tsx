"use client";

import { config } from "@/lib/config";
import { useWallet } from "@/lib/wallet";
import { short } from "@/lib/format";
import type { TxState } from "@/lib/useTx";
import { useState } from "react";

export function ConnectButton() {
  const { account, wrongNetwork, connect } = useWallet();
  const [copied, setCopied] = useState(false);

  if (!account) {
    return (
      <button onClick={connect}>
        <span>🦊</span>
        <span>Connect Wallet</span>
      </button>
    );
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(account);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <span className={wrongNetwork ? "badge bad" : "badge ok"}>
        <span className="pulse-dot" />
        {wrongNetwork ? "Wrong Network" : "Sepolia"}
      </span>
      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={copyAddress}
        title="Click to copy full address"
        style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.02em" }}
      >
        <span>{short(account)}</span>
        <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>{copied ? "✓ Copied" : "📋"}</span>
      </button>
    </div>
  );
}

export function NetworkBanner() {
  const { hasWallet, wrongNetwork, switchNetwork, error } = useWallet();

  if (error) {
    return (
      <div className="banner bad">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!hasWallet) {
    return (
      <div className="banner bad">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>🦊</span>
          <span>
            MetaMask extension was not detected.{" "}
            <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
              Install MetaMask
            </a>{" "}
            to play with your own characters and items.
          </span>
        </div>
      </div>
    );
  }

  if (wrongNetwork) {
    return (
      <div className="banner bad">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>⚠️</span>
          <span>
            <strong>Wrong Network:</strong> HeroForge operates on Sepolia testnet.
          </span>
        </div>
        <button className="btn-sm" onClick={switchNetwork}>
          Switch to Sepolia
        </button>
      </div>
    );
  }

  return null;
}

export function TxStatus({ state }: { state: TxState }) {
  if (state.status === "idle") return null;

  const isPending = state.status === "awaiting_signature" || state.status === "pending";
  const isOk = state.status === "confirmed";
  const cls = isOk ? "ok" : isPending ? "info" : "bad";

  const icons = {
    awaiting_signature: "✍️",
    pending: "⏳",
    confirmed: "🎉",
    failed: "❌",
    rejected: "🚫",
  };

  const labels = {
    awaiting_signature: "Waiting for Signature in MetaMask",
    pending: "Transaction Confirming on Sepolia",
    confirmed: "Confirmed on Blockchain",
    failed: "Transaction Failed",
    rejected: "Transaction Rejected",
  };

  return (
    <div className={`banner ${cls}`}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <span>{icons[state.status]}</span>
        <div>
          <strong>{labels[state.status]}:</strong> {state.message}
        </div>
      </div>
      {state.hash && (
        <a
          href={`${config.etherscanBase}/tx/${state.hash}`}
          target="_blank"
          rel="noreferrer"
          style={{ textDecoration: "underline", fontSize: "0.85rem", whiteSpace: "nowrap" }}
        >
          View on Etherscan ↗
        </a>
      )}
    </div>
  );
}
