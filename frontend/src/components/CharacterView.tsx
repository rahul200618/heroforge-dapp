"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getCharacter, getConfig, getItems } from "@/lib/api";
import { useBackendEvents, type EventMessage } from "@/lib/useEvents";
import { useTx } from "@/lib/useTx";
import { useWallet } from "@/lib/wallet";
import { short } from "@/lib/format";
import type { Character, Item } from "@/lib/types";
import { TxStatus } from "./Chrome";

const STATS = [
  { key: "strength" as const, name: "Strength", icon: "⚔️", color: "str", desc: "Increases attack damage & combat power" },
  { key: "speed" as const, name: "Speed", icon: "⚡", color: "spd", desc: "Increases evasion, initiative & dodge rate" },
  { key: "defence" as const, name: "Defence", icon: "🛡️", color: "def", desc: "Reduces incoming damage & fortifies armor" },
];

function getItemIcon(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("sword") || t.includes("blade") || t.includes("weapon")) return "⚔️";
  if (t.includes("shield")) return "🛡️";
  if (t.includes("helmet") || t.includes("helm") || t.includes("armor")) return "🪖";
  return "🎒";
}

export default function CharacterView({ id }: { id: number }) {
  const { account, wrongNetwork, getContract } = useWallet();
  const [c, setC] = useState<Character | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [limits, setLimits] = useState({ maxStat: 100, xpPerUpgrade: 10 });
  const [copiedOwner, setCopiedOwner] = useState(false);
  const { state, run, busy } = useTx();

  const load = useCallback(async () => {
    try {
      const ch = await getCharacter(id);
      setC(ch);
      setItems(await getItems(ch.owner));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load character");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    getConfig()
      .then((cfg) => setLimits({ maxStat: cfg.maxStat ?? 100, xpPerUpgrade: cfg.xpPerUpgrade ?? 10 }))
      .catch(() => {});
  }, []);

  useBackendEvents((ev: EventMessage) => {
    const d = ev.data as Record<string, unknown>;
    if (ev.event === "XPEarned" && Number(d.charId) === id) {
      setToast(`⚡ Gained +${d.amount} XP from match!`);
    } else if (ev.event === "StatUpgraded" && Number(d.charId) === id) {
      setToast(`🌟 Upgraded ${d.stat} to ${d.newValue}!`);
    } else if (ev.event === "ItemEquipped" && Number(d.charId) === id) {
      setToast(`⚔️ Equipped item #${d.itemId}`);
    } else if (ev.event === "ItemUnequipped" && Number(d.charId) === id) {
      setToast(`🛡️ Unequipped item #${d.itemId}`);
    }
    void load();
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  if (error && !c) {
    return (
      <section>
        <Link href="/" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", marginBottom: "1rem" }}>
          ← Back to Champions
        </Link>
        <div className="banner bad">{error}</div>
      </section>
    );
  }

  if (!c) {
    return (
      <section>
        <Link href="/" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", marginBottom: "1rem" }}>
          ← Back to Champions
        </Link>
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div className="pulse-dot" style={{ margin: "0 auto 1rem", width: "12px", height: "12px" }} />
          <p className="muted">Communing with Sepolia blockchain...</p>
        </div>
      </section>
    );
  }

  const isOwner = account !== null && account === c.owner.toLowerCase();
  const canAct = isOwner && !wrongNetwork && !busy;
  const equipped = c.equippedItemIds.map(
    (iid) => items.find((i) => i.id === iid) ?? { id: iid, itemType: "item", owner: c.owner, equippedTo: id },
  );
  const inventory = items.filter((i) => i.equippedTo === 0);

  const act = async (send: () => Promise<import("ethers").ContractTransactionResponse>) => {
    if (await run(send)) await load();
  };

  const copyOwner = () => {
    navigator.clipboard.writeText(c.owner);
    setCopiedOwner(true);
    setTimeout(() => setCopiedOwner(false), 2000);
  };

  return (
    <section>
      {toast && <div className="toast">{toast}</div>}

      <div style={{ marginBottom: "1.25rem" }}>
        <Link href="/" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.9rem" }}>
          ← Back to Champions
        </Link>
      </div>

      {/* Hero Banner */}
      <div className="hero-banner-card">
        <div className="hero-profile">
          <div className="hero-avatar">🗡️</div>
          <div className="hero-meta">
            <h1>
              <span>{c.name}</span>
              <span className="char-id-tag">#{c.id}</span>
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.4rem" }}>
              <span className="muted" style={{ fontSize: "0.85rem" }}>Owner:</span>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={copyOwner}
                title="Click to copy owner address"
                style={{ fontFamily: "ui-monospace, monospace" }}
              >
                <span>{short(c.owner)}</span>
                <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>{copiedOwner ? "✓ Copied" : "📋"}</span>
              </button>
              {isOwner && (
                <span className="badge ok" style={{ fontSize: "0.72rem" }}>
                  You Own This Hero
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="hero-xp-orb">
          <div className="hero-xp-val">✨ {c.xp}</div>
          <div className="hero-xp-lbl">Available XP</div>
        </div>
      </div>

      <TxStatus state={state} />

      {/* Stat Progression Dashboard */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#fff" }}>Stat Progression</h2>
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              Spend earned XP to permanently upgrade your attributes on-chain (costs {limits.xpPerUpgrade} XP per point)
            </span>
          </div>
          <span className="xp-gem" style={{ fontSize: "0.85rem", padding: "0.3rem 0.75rem" }}>
            Cost: {limits.xpPerUpgrade} XP
          </span>
        </div>

        <div>
          {STATS.map((s) => {
            const val = c[s.key];
            const pct = Math.min(100, Math.round((val / limits.maxStat) * 100));
            const hasEnoughXp = c.xp >= limits.xpPerUpgrade;
            const isMax = val >= limits.maxStat;

            let buttonText = `+1 ${s.name} (${limits.xpPerUpgrade} XP)`;
            let buttonDisabled = !canAct || !hasEnoughXp || isMax;
            let statusTooltip = "";

            if (!isOwner) {
              statusTooltip = "Read-only: only the NFT owner can upgrade stats";
            } else if (isMax) {
              buttonText = "Max Reached";
              statusTooltip = "Maximum stat cap reached (100)";
            } else if (!hasEnoughXp) {
              statusTooltip = `Need ${limits.xpPerUpgrade - c.xp} more XP`;
            }

            return (
              <div key={s.key} className="stat-row-detail">
                <div className="stat-detail-left">
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-label-group">
                    <span className="stat-label-title">{s.name}</span>
                    <span className="stat-label-sub">{s.desc}</span>
                  </div>
                </div>

                <div className="stat-detail-bar-wrap">
                  <div className="stat-track" style={{ height: "10px" }}>
                    <div className={`stat-fill ${s.color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span style={{ fontWeight: 700, minWidth: "3.5rem", fontSize: "0.95rem" }}>
                    {val} <span className="muted" style={{ fontSize: "0.75rem" }}>/ {limits.maxStat}</span>
                  </span>
                </div>

                <button
                  disabled={buttonDisabled}
                  title={statusTooltip}
                  onClick={() => act(async () => (await getContract()).spendXP(id, s.key))}
                >
                  <span>⬆️</span>
                  <span>{buttonText}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Equipment Armory */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#fff" }}>Equipped Gear</h2>
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              Active battle gear currently bound to this hero ({equipped.length} equipped)
            </span>
          </div>
        </div>

        {equipped.length > 0 && (
          <div className="banner lock">
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ fontSize: "1.2rem" }}>🔒</span>
              <div>
                <strong>Transfer Lock Active:</strong> This character NFT cannot be transferred while equipped with gear.
                Unequip all items before transferring to another wallet.
              </div>
            </div>
          </div>
        )}

        {equipped.length === 0 ? (
          <p className="muted" style={{ padding: "1rem 0", margin: 0 }}>
            No gear equipped. Equip items from your inventory below to arm your champion.
          </p>
        ) : (
          <div className="gear-grid">
            {equipped.map((i) => (
              <div key={i.id} className="gear-card">
                <div className="gear-info">
                  <div className="gear-icon">{getItemIcon(i.itemType)}</div>
                  <div className="gear-text">
                    <span className="gear-type">{i.itemType}</span>
                    <span className="gear-id">Item #{i.id}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  disabled={!canAct}
                  onClick={() => act(async () => (await getContract()).unequipItem(id, i.id))}
                >
                  Unequip
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inventory Bag */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#fff" }}>Inventory Armory</h2>
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              Unequipped loot items in your wallet ({inventory.length} available)
            </span>
          </div>
        </div>

        {inventory.length === 0 ? (
          <div style={{ padding: "1.5rem 0", textAlign: "center" }}>
            <span style={{ fontSize: "2rem" }}>🎒</span>
            <p className="muted" style={{ margin: "0.5rem 0 0" }}>
              No unequipped items in inventory. Win matches or call the game master service to loot items!
            </p>
          </div>
        ) : (
          <div className="gear-grid">
            {inventory.map((i) => (
              <div key={i.id} className="gear-card">
                <div className="gear-info">
                  <div className="gear-icon">{getItemIcon(i.itemType)}</div>
                  <div className="gear-text">
                    <span className="gear-type">{i.itemType}</span>
                    <span className="gear-id">Item #{i.id}</span>
                  </div>
                </div>
                <button
                  disabled={!canAct}
                  onClick={() => act(async () => (await getContract()).equipItem(id, i.id))}
                >
                  <span>⚔️</span>
                  <span>Equip</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
