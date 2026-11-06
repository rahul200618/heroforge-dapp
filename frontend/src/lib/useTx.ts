"use client";

import type { ContractTransactionReceipt, ContractTransactionResponse } from "ethers";
import { useCallback, useState } from "react";
import { friendlyError, isRejected } from "./errors";

export type TxStatus = "idle" | "awaiting_signature" | "pending" | "confirmed" | "failed" | "rejected";
export interface TxState { status: TxStatus; message?: string; hash?: string }

/** Runs one transaction and tracks its state: awaiting_signature, pending, confirmed, failed or rejected. */
export function useTx() {
  const [state, setState] = useState<TxState>({ status: "idle" });

  const run = useCallback(async (send: () => Promise<ContractTransactionResponse>): Promise<ContractTransactionReceipt | null> => {
    setState({ status: "awaiting_signature", message: "Confirm the transaction in MetaMask..." });
    try {
      const tx = await send();
      setState({ status: "pending", hash: tx.hash, message: "Waiting for confirmation..." });
      const receipt = await tx.wait();
      if (receipt && receipt.status === 1) {
        setState({ status: "confirmed", hash: tx.hash, message: "Confirmed" });
        return receipt;
      }
      setState({ status: "failed", hash: tx.hash, message: "The transaction reverted on-chain." });
      return null;
    } catch (e) {
      if (isRejected(e)) setState({ status: "rejected", message: "You rejected the transaction in MetaMask. Nothing was sent." });
      else setState({ status: "failed", message: friendlyError(e) });
      return null;
    }
  }, []);

  const busy = state.status === "awaiting_signature" || state.status === "pending";
  return { state, run, busy };
}
