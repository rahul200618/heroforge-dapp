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
  { key: "strength" as const, name: "Strength", icon: "⚔️", color: "str", desc: "Attack power, physical damage & weapon scaling" },
  { key: "speed" as const, name: "Speed", icon: "⚡", color: "spd", desc: "Combat initiative, dodge rate & movement velocity" },
  { key: "defence" as const, name: "Defence", icon: "🛡️", color: "def", desc: "Damage mitigation, armor toughness & survivability" },
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
        <div className="card" style={{ textAlign: "center", padding: "3.5rem" }}>
          <div className="pulse-dot" style={{ margin: "0 auto 1.2rem", width: "14px", height: "14px" }} />
          <p className="muted" style={{ fontSize: "1rem" }}>Communing with Sepolia blockchain...</p>
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
  const level = Math.floor((c.strength + c.speed + c.defence) / 3);

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

      <div style={{ marginBottom: "1.4rem" }}>
        <Link href="/" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.95rem", fontWeight: 600 }}>
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
              <span className="char-level-badge" style={{ fontSize: "0.85rem", padding: "0.25rem 0.75rem" }}>
                LVL {level}
              </span>
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
              <span className="muted" style={{ fontSize: "0.88rem" }}>Owner:</span>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={copyOwner}
                title="Click to copy full owner address"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <span>{short(c.owner)}</span>
                <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>{copiedOwner ? "✓ Copied" : "📋"}</span>
              </button>
              {isOwner ? (
                <span className="badge ok">
                  You Own This Hero
                </span>
              ) : (
                <span className="badge bad">
                  Read Only
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="hero-xp-orb">
          <div className="hero-xp-val">✨ {c.xp}</div>
          <div className="hero-xp-lbl">Experience Points</div>
        </div>
      </div>

      <TxStatus state={state} />

      {/* Stat Progression Dashboard */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.4rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.35rem", color: "#fff" }}>Stat Progression</h2>
            <span className="muted" style={{ fontSize: "0.88rem" }}>
              Spend earned XP to permanently upgrade your hero attributes on-chain ({limits.xpPerUpgrade} XP per point)
            </span>
          </div>
          <span className="xp-gem" style={{ fontSize: "0.88rem", padding: "0.35rem 0.85rem" }}>
            Cost: {limits.xpPerUpgrade} XP / point
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
                  <div className="stat-track" style={{ height: "11px" }}>
                    <div className={`stat-fill ${s.color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span style={{ fontWeight: 800, minWidth: "4rem", fontSize: "1rem", fontFamily: "var(--font-mono)" }}>
                    {val} <span className="muted" style={{ fontSize: "0.78rem" }}>/ {limits.maxStat}</span>
                  </span>
                </div>

                <button
                  className="btn-upgrade"
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

      {/* Equipment Armory (3-Slot Layout) */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.35rem", color: "#fff" }}>Battle Armory</h2>
            <span className="muted" style={{ fontSize: "0.88rem" }}>
              Equipped gear bound to this champion ({equipped.length} items equipped)
            </span>
          </div>
        </div>

        {equipped.length > 0 && (
          <div className="banner lock">
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "1.35rem" }}>🔒</span>
              <div>
                <strong>Transfer Lock Active:</strong> This character NFT is bound to its equipped gear and cannot be transferred.
                Unequip all items before transferring to another address.
              </div>
            </div>
          </div>
        )}

        <div className="armory-slots">
          {/* Main Hand / Weapon Slot */}
          {(() => {
            const weapon = equipped.find((i) => i.itemType.toLowerCase().includes("sword") || i.itemType.toLowerCase().includes("weapon"));
            return (
              <div className={`armory-slot-box ${weapon ? "equipped" : ""}`}>
                <div className="slot-header">
                  <span>Main Hand</span>
                  <span>{weapon ? "Equipped" : "Empty"}</span>
                </div>
                <div className="slot-body">
                  <div className="slot-icon">{weapon ? getItemIcon(weapon.itemType) : "⚔️"}</div>
                  <div style={{ flex: 1 }}>
                    {weapon ? (
                      <div>
                        <div style={{ fontWeight: 700, color: "#fff" }}>{weapon.itemType}</div>
                        <div className="subtle" style={{ fontSize: "0.78rem", fontFamily: "var(--font-mono)" }}>Item #{weapon.id}</div>
                      </div>
                    ) : (
                      <div className="muted" style={{ fontSize: "0.88rem" }}>No Weapon Equipped</div>
                    )}
                  </div>
                </div>
                {weapon && (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={!canAct}
                    onClick={() => act(async () => (await getContract()).unequipItem(id, weapon.id))}
                    style={{ alignSelf: "flex-start", marginTop: "0.4rem" }}
                  >
                    Unequip
                  </button>
                )}
              </div>
            );
          })()}

          {/* Off Hand / Shield Slot */}
          {(() => {
            const shield = equipped.find((i) => i.itemType.toLowerCase().includes("shield"));
            return (
              <div className={`armory-slot-box ${shield ? "equipped" : ""}`}>
                <div className="slot-header">
                  <span>Off Hand</span>
                  <span>{shield ? "Equipped" : "Empty"}</span>
                </div>
                <div className="slot-body">
                  <div className="slot-icon">{shield ? getItemIcon(shield.itemType) : "🛡️"}</div>
                  <div style={{ flex: 1 }}>
                    {shield ? (
                      <div>
                        <div style={{ fontWeight: 700, color: "#fff" }}>{shield.itemType}</div>
                        <div className="subtle" style={{ fontSize: "0.78rem", fontFamily: "var(--font-mono)" }}>Item #{shield.id}</div>
                      </div>
                    ) : (
                      <div className="muted" style={{ fontSize: "0.88rem" }}>No Shield Equipped</div>
                    )}
                  </div>
                </div>
                {shield && (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={!canAct}
                    onClick={() => act(async () => (await getContract()).unequipItem(id, shield.id))}
                    style={{ alignSelf: "flex-start", marginTop: "0.4rem" }}
                  >
                    Unequip
                  </button>
                )}
              </div>
            );
          })()}

          {/* Headgear / Helmet Slot */}
          {(() => {
            const helmet = equipped.find((i) => i.itemType.toLowerCase().includes("helmet") || i.itemType.toLowerCase().includes("helm"));
            return (
              <div className={`armory-slot-box ${helmet ? "equipped" : ""}`}>
                <div className="slot-header">
                  <span>Headgear</span>
                  <span>{helmet ? "Equipped" : "Empty"}</span>
                </div>
                <div className="slot-body">
                  <div className="slot-icon">{helmet ? getItemIcon(helmet.itemType) : "🪖"}</div>
                  <div style={{ flex: 1 }}>
                    {helmet ? (
                      <div>
                        <div style={{ fontWeight: 700, color: "#fff" }}>{helmet.itemType}</div>
                        <div className="subtle" style={{ fontSize: "0.78rem", fontFamily: "var(--font-mono)" }}>Item #{helmet.id}</div>
                      </div>
                    ) : (
                      <div className="muted" style={{ fontSize: "0.88rem" }}>No Helmet Equipped</div>
                    )}
                  </div>
                </div>
                {helmet && (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={!canAct}
                    onClick={() => act(async () => (await getContract()).unequipItem(id, helmet.id))}
                    style={{ alignSelf: "flex-start", marginTop: "0.4rem" }}
                  >
                    Unequip
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Inventory Bag */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.35rem", color: "#fff" }}>Inventory Sack</h2>
            <span className="muted" style={{ fontSize: "0.88rem" }}>
              Unequipped loot items in your wallet ({inventory.length} available)
            </span>
          </div>
        </div>

        {inventory.length === 0 ? (
          <div style={{ padding: "2rem 0", textAlign: "center" }}>
            <span style={{ fontSize: "2.5rem" }}>🎒</span>
            <p className="muted" style={{ margin: "0.6rem 0 0", fontSize: "0.95rem" }}>
              No loot items currently in your sack. Win matches or call the game server to drop items!
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
