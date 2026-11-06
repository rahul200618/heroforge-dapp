"use client";

import { useCallback, useEffect, useState } from "react";
import { getCharacter, getConfig, getItems } from "@/lib/api";
import { useBackendEvents, type EventMessage } from "@/lib/useEvents";
import { useTx } from "@/lib/useTx";
import { useWallet } from "@/lib/wallet";
import type { Character, Item } from "@/lib/types";
import { TxStatus } from "./Chrome";

const STATS = ["strength", "speed", "defence"] as const;

export default function CharacterView({ id }: { id: number }) {
  const { account, wrongNetwork, getContract } = useWallet();
  const [c, setC] = useState<Character | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [limits, setLimits] = useState({ maxStat: 100, xpPerUpgrade: 10 });
  const { state, run, busy } = useTx();

  const load = useCallback(async () => {
    try {
      const ch = await getCharacter(id);
      setC(ch);
      setItems(await getItems(ch.owner));
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load character"); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { getConfig().then((cfg) => setLimits({ maxStat: cfg.maxStat ?? 100, xpPerUpgrade: cfg.xpPerUpgrade ?? 10 })).catch(() => {}); }, []);

  useBackendEvents((ev: EventMessage) => {
    const d = ev.data as Record<string, unknown>;
    if (ev.event === "XPEarned" && Number(d.charId) === id) setToast(`+${d.amount} XP`);
    void load(); // simplest correct behaviour: refetch live data from the backend
  });
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);

  if (error && !c) return <section><h1>Character #{id}</h1><div className="banner bad">{error}</div></section>;
  if (!c) return <section><h1>Character #{id}</h1><p className="muted">Loading...</p></section>;

  const isOwner = account !== null && account === c.owner.toLowerCase();
  const canAct = isOwner && !wrongNetwork && !busy;
  const equipped = c.equippedItemIds.map((iid) => items.find((i) => i.id === iid) ?? { id: iid, itemType: "item", owner: c.owner, equippedTo: id });
  const inventory = items.filter((i) => i.equippedTo === 0);

  const act = async (send: () => Promise<import("ethers").ContractTransactionResponse>) => {
    if (await run(send)) await load();
  };

  const upgradeHint = (stat: (typeof STATS)[number]) =>
    !isOwner ? "Only the owner can upgrade" : c.xp < limits.xpPerUpgrade ? `Needs ${limits.xpPerUpgrade} XP` : c[stat] >= limits.maxStat ? "Already at the maximum" : "";

  return (
    <section>
      {toast && <div className="toast">{toast}</div>}
      <h1>{c.name} <span className="muted">#{c.id}</span></h1>
      <p className="muted">Owner: <code>{c.owner}</code>{!isOwner && " (read-only: this is not your character)"}</p>
      <TxStatus state={state} />

      <div className="card">
        <h2>Stats <span className="muted">· XP {c.xp}</span></h2>
        {STATS.map((s) => {
          const hint = upgradeHint(s);
          return (
            <div key={s} className="row">
              <span className="label">{s}</span><span>{c[s]} / {limits.maxStat}</span>
              <button disabled={!canAct || hint !== ""} title={hint} onClick={() => act(async () => (await getContract()).spendXP(id, s))}>
                Upgrade ({limits.xpPerUpgrade} XP)
              </button>
              {hint && <span className="muted">{hint}</span>}
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2>Equipped items</h2>
        {equipped.length > 0 && <div className="banner info">Locked: this character cannot be transferred while items are equipped.</div>}
        {equipped.length === 0 && <p className="muted">Nothing equipped.</p>}
        {equipped.map((i) => (
          <div key={i.id} className="row"><span>{i.itemType} <span className="muted">#{i.id}</span></span>
            <button disabled={!canAct} onClick={() => act(async () => (await getContract()).unequipItem(id, i.id))}>Unequip</button></div>
        ))}
      </div>

      <div className="card">
        <h2>Inventory</h2>
        {inventory.length === 0 && <p className="muted">No unequipped items.</p>}
        {inventory.map((i) => (
          <div key={i.id} className="row"><span>{i.itemType} <span className="muted">#{i.id}</span></span>
            <button disabled={!canAct} onClick={() => act(async () => (await getContract()).equipItem(id, i.id))}>Equip</button></div>
        ))}
      </div>
    </section>
  );
}
