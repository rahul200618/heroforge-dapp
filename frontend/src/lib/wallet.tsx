"use client";

import { BrowserProvider, Contract, type Eip1193Provider } from "ethers";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { HEROFORGE_ABI } from "./abi";
import { config } from "./config";

type Ethereum = Eip1193Provider & {
  isMetaMask?: boolean;
  providers?: Ethereum[];
  on?: (event: string, cb: (arg: unknown) => void) => void;
  removeListener?: (event: string, cb: (arg: unknown) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Ethereum;
  }
}

function getEthereumProvider(): Ethereum | null {
  if (typeof window === "undefined") return null;
  const anyWin = window as unknown as { ethereum?: Ethereum };
  if (!anyWin.ethereum) return null;
  if (Array.isArray(anyWin.ethereum.providers)) {
    const mm = anyWin.ethereum.providers.find((p) => p.isMetaMask);
    if (mm) return mm;
  }
  return anyWin.ethereum;
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

  const syncState = useCallback((eth: Ethereum) => {
    setHasWallet(true);
    eth
      .request({ method: "eth_accounts" })
      .then((a: unknown) => setAccount((a as string[])[0]?.toLowerCase() ?? null))
      .catch(() => {});
    eth
      .request({ method: "eth_chainId" })
      .then((id: unknown) => setChainId(parseInt(id as string, 16)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const check = () => {
      const eth = getEthereumProvider();
      if (eth) {
        syncState(eth);
        return eth;
      }
      setHasWallet(false);
      return null;
    };

    const eth = check();

    // MetaMask or other extensions can inject asynchronously
    const onInit = () => check();
    window.addEventListener("ethereum#initialized", onInit, { once: true });
    const timer1 = setTimeout(check, 500);
    const timer2 = setTimeout(check, 1500);

    const onAccounts = (a: unknown) => {
      setAccount((a as string[])[0]?.toLowerCase() ?? null);
      setError(null);
    };
    const onChain = (id: unknown) => setChainId(parseInt(id as string, 16));

    if (eth) {
      eth.on?.("accountsChanged", onAccounts);
      eth.on?.("chainChanged", onChain);
    }

    return () => {
      window.removeEventListener("ethereum#initialized", onInit);
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (eth) {
        eth.removeListener?.("accountsChanged", onAccounts);
        eth.removeListener?.("chainChanged", onChain);
      }
    };
  }, [syncState]);

  const connect = useCallback(async () => {
    setError(null);
    const eth = getEthereumProvider();
    if (!eth) {
      setError("MetaMask was not found. Please install or enable MetaMask and refresh.");
      return;
    }
    try {
      const a = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      setAccount(a[0]?.toLowerCase() ?? null);
      setHasWallet(true);
      const id = (await eth.request({ method: "eth_chainId" })) as string;
      setChainId(parseInt(id, 16));
    } catch (e: unknown) {
      const err = e as { code?: number; message?: string };
      if (err.code === 4001) {
        setError("Connection request rejected in MetaMask.");
      } else if (err.code === -32002) {
        setError("A MetaMask request is already open. Please open your MetaMask extension icon to approve.");
      } else {
        setError(err.message || "Could not connect to MetaMask.");
      }
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    const eth = getEthereumProvider();
    if (!eth) return;
    const targetChainIdHex = "0x" + config.chainId.toString(16);
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetChainIdHex }],
      });
    } catch (e: unknown) {
      const err = e as { code?: number; message?: string };
      if (err.code === 4902) {
        // Sepolia network not yet added to user's MetaMask
        try {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: targetChainIdHex,
                chainName: "Sepolia test network",
                nativeCurrency: { name: "Sepolia Ether", symbol: "SEP", decimals: 18 },
                rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
                blockExplorerUrls: [config.etherscanBase],
              },
            ],
          });
        } catch (addErr: unknown) {
          setError((addErr as { message?: string })?.message || "Failed to add Sepolia network.");
        }
      } else if (err.code === 4001) {
        setError("Network switch rejected in MetaMask.");
      } else {
        setError(err.message || "Could not switch network. Switch to Sepolia in MetaMask.");
      }
    }
  }, []);

  const getContract = useCallback(async () => {
    const eth = getEthereumProvider();
    if (!eth) throw new Error("Wallet not found");
    const provider = new BrowserProvider(eth);
    const signer = await provider.getSigner();
    return new Contract(config.contractAddress, HEROFORGE_ABI, signer);
  }, []);

  const value = useMemo<WalletValue>(
    () => ({
      hasWallet,
      account,
      wrongNetwork: chainId !== null && chainId !== config.chainId,
      error,
      connect,
      switchNetwork,
      getContract,
    }),
    [hasWallet, account, chainId, error, connect, switchNetwork, getContract],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
