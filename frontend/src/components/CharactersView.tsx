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

const FANTASY_NAMES = [
  "Aethelgard",
  "Shadowblade",
  "Valkyrie",
  "Ironclad",
  "Dragonheart",
  "Dawnseeker",
  "Frostbane",
  "Stormcaller",
  "Bloodfang",
  "Nightweaver",
  "Eldritch",
  "Silverhand",
];

const AVATARS = ["⚔️", "🛡️", "🏹", "🥷", "🧙‍♂️", "⚡", "🐉", "🐺"];

function getArchetype(c: Character): { name: string; icon: string } {
  if (c.strength > c.speed && c.strength > c.defence) return { name: "Warrior", icon: "⚔️" };
  if (c.speed > c.strength && c.speed > c.defence) return { name: "Rogue", icon: "🏹" };
  if (c.defence > c.strength && c.defence > c.speed) return { name: "Guardian", icon: "🛡️" };
  return { name: "Adventurer", icon: "✨" };
}

export default function CharactersView() {
  const { account, hasWallet, wrongNetwork, connect, getContract } = useWallet();
  const [chars, setChars] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const { state, run, busy } = useTx();

  const load = useCallback(async () => {
    if (!account) {
      setChars([]);
      setLoading(false);
      return;
    }
    try {
      const fresh = await getCharacters(account);
      setChars((old) =>
        [...fresh, ...old.filter((o) => o.owner.toLowerCase() === account && !fresh.some((f) => f.id === o.id))].sort(
          (a, b) => a.id - b.id,
        ),
      );
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load characters");
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    void load();
  }, [load]);

  useBackendEvents(() => {
    void load();
  });

  const randomizeName = () => {
    const random = FANTASY_NAMES[Math.floor(Math.random() * FANTASY_NAMES.length)];
    setName(random);
  };

  const mint = async () => {
    const receipt = await run(async () => (await getContract()).mintCharacter(name.trim()));
    if (!receipt) return;
    setName("");
    for (const log of receipt.logs) {
      try {
        const parsed = heroForgeInterface.parseLog({ topics: [...log.topics], data: log.data });
        if (parsed?.name === "CharacterMinted") {
          const c = await getCharacter(Number(parsed.args.tokenId));
          setChars((old) => [...old.filter((o) => o.id !== c.id), c].sort((a, b) => a.id - b.id));
        }
      } catch {
        /* log from another contract event */
      }
    }
  };

  const nameOk = name.trim().length >= 1 && name.trim().length <= 32;

  return (
    <section>
      <div className="page-header">
        <h1 className="page-title">Hero Sanctuary</h1>
        <p className="page-desc">
          Forge, inspect, and empower your on-chain RPG champions. Characters and equipment are ERC-721 NFTs.
        </p>
      </div>

      {!account ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏰</div>
          <h2 style={{ margin: "0 0 0.5rem", color: "#fff" }}>Connect Your Wallet</h2>
          <p className="muted" style={{ maxWidth: "420px", margin: "0 auto 1.5rem" }}>
            Connect MetaMask on Sepolia to view your roster of characters, spend XP, and equip items.
          </p>
          <button onClick={connect}>
            <span>🦊</span>
            <span>Connect MetaMask</span>
          </button>
        </div>
      ) : (
        <>
          {/* Minting Forge Card */}
          <div className="card" style={{ border: "1px solid rgba(245, 158, 11, 0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#fff", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span>🔥</span>
                  <span>Forge a New Hero</span>
                </h2>
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  Mints a new character NFT to your wallet with base stats (1 STR, 1 SPD, 1 DEF)
                </span>
              </div>
            </div>

            <div className="mint-box">
              <div className="mint-inputs">
                <input
                  value={name}
                  maxLength={32}
                  placeholder="Enter champion name (e.g. Valkyrie)"
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && nameOk && !busy && !wrongNetwork) void mint();
                  }}
                />
                <button type="button" className="dice-btn" onClick={randomizeName} title="Pick a random fantasy name">
                  <span>🎲</span>
                  <span>Random</span>
                </button>
                <button disabled={!nameOk || busy || wrongNetwork} onClick={mint}>
                  <span>⚡</span>
                  <span>{busy ? "Forging..." : "Mint Character"}</span>
                </button>
              </div>

              {name.trim() && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.85rem",
                    padding: "0.75rem 1rem",
                    background: "rgba(245, 158, 11, 0.08)",
                    borderRadius: "10px",
                    border: "1px dashed rgba(245, 158, 11, 0.3)",
                    fontSize: "0.88rem",
                  }}
                >
                  <span style={{ fontSize: "1.4rem" }}>✨</span>
                  <div>
                    Preview: Ready to forge <strong>{name.trim()}</strong> as a Novice Adventurer.
                  </div>
                </div>
              )}

              <TxStatus state={state} />
            </div>
          </div>

          {loadError && <div className="banner bad">{loadError}</div>}

          {/* Roster Grid */}
          <div style={{ marginTop: "2rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.35rem", color: "#fff" }}>
                My Champions <span className="muted">({loading ? "..." : chars.length})</span>
              </h2>
            </div>

            {loading ? (
              <div className="card" style={{ textAlign: "center", padding: "3rem 1rem" }}>
                <div className="pulse-dot" style={{ margin: "0 auto 1rem", width: "12px", height: "12px" }} />
                <h3 style={{ margin: "0 0 0.4rem", color: "#fff" }}>Summoning Champions...</h3>
                <p className="muted" style={{ margin: 0 }}>
                  Fetching your hero NFTs and progression stats from Sepolia.
                </p>
              </div>
            ) : chars.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🗡️</div>
                <h3 style={{ margin: "0 0 0.4rem", color: "#fff" }}>No Characters Found</h3>
                <p className="muted" style={{ margin: 0 }}>
                  You have not minted any characters yet. Use the Forge above to mint your first champion!
                </p>
              </div>
            ) : (
              <div className="grid">
                {chars.map((c) => {
                  const archetype = getArchetype(c);
                  const avatar = AVATARS[c.id % AVATARS.length];
                  const level = Math.floor((c.strength + c.speed + c.defence) / 3);

                  return (
                    <Link key={c.id} href={`/characters/${c.id}`} className="card link">
                      <div className="char-card-header">
                        <div className="char-title">
                          <span style={{ fontSize: "1.4rem" }}>{avatar}</span>
                          <span>{c.name}</span>
                          <span className="char-id-tag">#{c.id}</span>
                        </div>
                        <span className="char-class-badge">{archetype.name}</span>
                      </div>

                      {/* Stat Meters */}
                      <div className="stat-bars-mini">
                        <div className="stat-meter">
                          <span className="stat-name">STR</span>
                          <div className="stat-track">
                            <div className="stat-fill str" style={{ width: `${Math.min(100, c.strength)}%` }} />
                          </div>
                          <span className="stat-val">{c.strength}</span>
                        </div>
                        <div className="stat-meter">
                          <span className="stat-name">SPD</span>
                          <div className="stat-track">
                            <div className="stat-fill spd" style={{ width: `${Math.min(100, c.speed)}%` }} />
                          </div>
                          <span className="stat-val">{c.speed}</span>
                        </div>
                        <div className="stat-meter">
                          <span className="stat-name">DEF</span>
                          <div className="stat-track">
                            <div className="stat-fill def" style={{ width: `${Math.min(100, c.defence)}%` }} />
                          </div>
                          <span className="stat-val">{c.defence}</span>
                        </div>
                      </div>

                      <div className="char-card-footer">
                        <span className="xp-gem">✨ {c.xp} XP</span>
                        <span className="subtle" style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <span>🛡️ {c.equippedItemIds.length} equipped</span>
                          <span style={{ color: "var(--gold)", fontWeight: 700 }}>· View →</span>
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
