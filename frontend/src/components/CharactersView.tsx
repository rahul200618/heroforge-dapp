"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getCharacter, getCharacters } from "@/lib/api";
import { heroForgeInterface } from "@/lib/errors";
import { useBackendEvents } from "@/lib/useEvents";
import { useTx } from "@/lib/useTx";
import { useWallet } from "@/lib/wallet";
import type { Character } from "@/lib/types";
import { TxStatus } from "./Chrome";

export default function CharactersView() {
  const { account, hasWallet, wrongNetwork, connect, getContract } = useWallet();
  const [chars, setChars] = useState<Character[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const { state, run, busy } = useTx();

  const load = useCallback(async () => {
    if (!account) { setChars([]); return; }
    try {
      const fresh = await getCharacters(account);
      // keep characters we already know about (the owner index can lag a few seconds behind the chain)
      setChars((old) => [...fresh, ...old.filter((o) => o.owner.toLowerCase() === account && !fresh.some((f) => f.id === o.id))].sort((a, b) => a.id - b.id));
      setLoadError(null);
    } catch (e) { setLoadError(e instanceof Error ? e.message : "Could not load characters"); }
  }, [account]);

  useEffect(() => { void load(); }, [load]);
  useBackendEvents(() => { void load(); });

  const mint = async () => {
    const receipt = await run(async () => (await getContract()).mintCharacter(name.trim()));
    if (!receipt) return;
    setName("");
    for (const log of receipt.logs) {
      try {
        const parsed = heroForgeInterface.parseLog({ topics: [...log.topics], data: log.data });
        if (parsed?.name === "CharacterMinted") {
          const c = await getCharacter(Number(parsed.args.tokenId)); // read straight from the chain: shows at once
          setChars((old) => [...old.filter((o) => o.id !== c.id), c].sort((a, b) => a.id - b.id));
        }
      } catch { /* log from another contract event */ }
    }
  };

  const nameOk = name.trim().length >= 1 && name.trim().length <= 32;
  return (
    <section>
      <h1>My characters</h1>
      {!account ? (
        <p>{hasWallet ? <>Connect your wallet to see your characters. <button onClick={connect}>Connect wallet</button></> : "Install MetaMask to use HeroForge."}</p>
      ) : (
        <>
          <div className="card">
            <h2>Mint a character</h2>
            <input value={name} maxLength={32} placeholder="Character name (1-32 characters)" onChange={(e) => setName(e.target.value)} />{" "}
            <button disabled={!nameOk || busy || wrongNetwork} onClick={mint}>Mint character</button>
            <TxStatus state={state} />
          </div>
          {loadError && <div className="banner bad">{loadError}</div>}
          {chars.length === 0 ? <p className="muted">You have no characters yet.</p> : (
            <div className="grid">
              {chars.map((c) => (
                <Link key={c.id} href={`/characters/${c.id}`} className="card link">
                  <strong>{c.name}</strong> <span className="muted">#{c.id}</span>
                  <div>STR {c.strength} · SPD {c.speed} · DEF {c.defence}</div>
                  <div>XP {c.xp} · {c.equippedItemIds.length} item(s) equipped</div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
