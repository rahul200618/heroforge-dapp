"use client";

import { useEffect, useState } from "react";
import { config } from "@/lib/config";
import { getEvents } from "@/lib/api";
import { describe } from "@/lib/format";
import { useBackendEvents } from "@/lib/useEvents";
import type { ChainEvent } from "@/lib/types";

function getEventIcon(type: string): string {
  switch (type) {
    case "CharacterMinted":
      return "✨";
    case "ItemMinted":
      return "🎁";
    case "ItemEquipped":
      return "⚔️";
    case "ItemUnequipped":
      return "🔓";
    case "XPEarned":
      return "⚡";
    case "StatUpgraded":
      return "🌟";
    default:
      return "📜";
  }
}

export default function ActivityView() {
  const [events, setEvents] = useState<ChainEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  useEffect(() => {
    getEvents(50)
      .then(setEvents)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load events"));
  }, []);

  const live = useBackendEvents((m) =>
    setEvents((old) =>
      old.some((e) => e.txHash === m.txHash && JSON.stringify(e.data) === JSON.stringify(m.data))
        ? old
        : [{ type: m.event, block: m.block, txHash: m.txHash, data: m.data }, ...old].slice(0, 100),
    ),
  );

  const filteredEvents = events.filter((e) => {
    if (filter === "CHARS") return e.type === "CharacterMinted";
    if (filter === "ITEMS") return e.type.includes("Item");
    if (filter === "XP") return e.type === "XPEarned" || e.type === "StatUpgraded";
    return true;
  });

  return (
    <section>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 className="page-title">On-Chain Activity</h1>
            <p className="page-desc">Real-time chronicle of events indexed directly from the Sepolia smart contract.</p>
          </div>
          <span className={live ? "badge ok" : "badge bad"} style={{ fontSize: "0.85rem", padding: "0.35rem 0.85rem" }}>
            <span className="pulse-dot" />
            <span>{live ? "Live WebSocket Connected" : "Connecting..."}</span>
          </span>
        </div>
      </div>

      {error && <div className="banner bad">{error}</div>}

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {[
          { id: "ALL", label: `All Events (${events.length})` },
          { id: "CHARS", label: "Characters" },
          { id: "ITEMS", label: "Items & Gear" },
          { id: "XP", label: "XP & Upgrades" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={filter === tab.id ? "btn-sm" : "btn-secondary btn-sm"}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: "0.5rem 1.25rem" }}>
        {filteredEvents.length === 0 && !error && (
          <div style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
            <span style={{ fontSize: "2rem" }}>📜</span>
            <p className="muted" style={{ margin: "0.5rem 0 0" }}>
              No events found for this filter.
            </p>
          </div>
        )}

        {filteredEvents.map((e) => (
          <div key={`${e.txHash}-${e.type}-${JSON.stringify(e.data)}`} className="row">
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flex: 1 }}>
              <div
                style={{
                  width: "2.2rem",
                  height: "2.2rem",
                  borderRadius: "8px",
                  background: "rgba(255, 255, 255, 0.05)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                {getEventIcon(e.type)}
              </div>
              <div>
                <div style={{ fontWeight: 600, color: "#fff", fontSize: "0.95rem" }}>{describe(e)}</div>
                <div className="subtle" style={{ fontSize: "0.78rem", marginTop: "0.15rem" }}>
                  Block #{e.block}
                </div>
              </div>
            </div>

            <div>
              <a
                href={`${config.etherscanBase}/tx/${e.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.78rem" }}
              >
                <span>Etherscan</span>
                <span style={{ opacity: 0.6 }}>↗</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
