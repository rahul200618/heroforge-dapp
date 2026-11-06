"use client";

import { BrowserProvider, Contract, type Eip1193Provider } from "ethers";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { HEROFORGE_ABI } from "./abi";
import { config } from "./config";

type Ethereum = Eip1193Provider & {
  on?: (event: string, cb: (arg: unknown) => void) => void;
  removeListener?: (event: string, cb: (arg: unknown) => void) => void;
};
declare global {
  interface Window { ethereum?: Ethereum }
}

interface WalletValue {
  hasWallet: boolean;
  account: string | null; // lowercase address
  wrongNetwork: boolean;
  error: string | null;
  connect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  getContract: () => Promise<Contract>;
}

const WalletContext = createContext<WalletValue | null>(null);

export function useWallet(): WalletValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [hasWallet, setHasWallet] = useState(true);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) { setHasWallet(false); return; }
    eth.request({ method: "eth_accounts" }).then((a: string[]) => setAccount(a[0]?.toLowerCase() ?? null)).catch(() => {});
    eth.request({ method: "eth_chainId" }).then((id: string) => setChainId(parseInt(id, 16))).catch(() => {});
    const onAccounts = (a: unknown) => { setAccount((a as string[])[0]?.toLowerCase() ?? null); setError(null); };
    const onChain = (id: unknown) => setChainId(parseInt(id as string, 16));
    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => { eth.removeListener?.("accountsChanged", onAccounts); eth.removeListener?.("chainChanged", onChain); };
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    try {
      const a = (await window.ethereum!.request({ method: "eth_requestAccounts" })) as string[];
      setAccount(a[0]?.toLowerCase() ?? null);
    } catch (e) {
      const code = (e as { code?: number }).code;
      setError(code === 4001 ? "Connection request rejected." : code === -32002 ? "A MetaMask request is already open. Check the MetaMask window." : "Could not connect to MetaMask.");
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    try {
      await window.ethereum!.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x" + config.chainId.toString(16) }] });
    } catch (e) {
      setError((e as { code?: number }).code === 4001 ? "Network switch rejected." : "Could not switch network. Switch it in MetaMask.");
    }
  }, []);

  const getContract = useCallback(async () => {
    const provider = new BrowserProvider(window.ethereum!);
    const signer = await provider.getSigner();
    return new Contract(config.contractAddress, HEROFORGE_ABI, signer);
  }, []);

  const value = useMemo<WalletValue>(
    () => ({ hasWallet, account, wrongNetwork: chainId !== null && chainId !== config.chainId, error, connect, switchNetwork, getContract }),
    [hasWallet, account, chainId, error, connect, switchNetwork, getContract],
  );
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
