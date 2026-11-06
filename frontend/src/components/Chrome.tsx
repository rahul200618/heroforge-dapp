"use client";

import { config } from "@/lib/config";
import { useWallet } from "@/lib/wallet";
import { short } from "@/lib/format";
import type { TxState } from "@/lib/useTx";

export function ConnectButton() {
  const { hasWallet, account, wrongNetwork, connect } = useWallet();
  if (!hasWallet) return <span className="muted">No wallet</span>;
  if (!account) return <button onClick={connect}>Connect wallet</button>;
  return (
    <span>
      <span className={wrongNetwork ? "badge bad" : "badge ok"}>{wrongNetwork ? "Wrong network" : "Sepolia"}</span>{" "}
      <code>{short(account)}</code>
    </span>
  );
}

export function NetworkBanner() {
  const { hasWallet, wrongNetwork, switchNetwork, error } = useWallet();
  if (!hasWallet) {
    return <div className="banner bad">MetaMask was not found. <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">Install it</a> to use HeroForge. You can still browse read-only.</div>;
  }
  if (wrongNetwork) {
    return (
      <div className="banner bad">
        Wrong network: HeroForge runs on Sepolia. Actions are disabled. <button onClick={switchNetwork}>Switch to Sepolia</button>
      </div>
    );
  }
  return error ? <div className="banner bad">{error}</div> : null;
}

export function TxStatus({ state }: { state: TxState }) {
  if (state.status === "idle") return null;
  const cls = state.status === "confirmed" ? "ok" : state.status === "failed" || state.status === "rejected" ? "bad" : "info";
  const label = { awaiting_signature: "Waiting for signature", pending: "Pending", confirmed: "Confirmed", failed: "Failed", rejected: "Rejected" }[state.status];
  return (
    <div className={`banner ${cls}`}>
      <strong>{label}.</strong> {state.message}{" "}
      {state.hash && <a href={`${config.etherscanBase}/tx/${state.hash}`} target="_blank" rel="noreferrer">View on Etherscan</a>}
    </div>
  );
}
