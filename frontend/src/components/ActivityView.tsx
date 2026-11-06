"use client";

import { useEffect, useState } from "react";
import { config } from "@/lib/config";
import { getEvents } from "@/lib/api";
import { describe } from "@/lib/format";
import { useBackendEvents } from "@/lib/useEvents";
import type { ChainEvent } from "@/lib/types";

export default function ActivityView() {
  const [events, setEvents] = useState<ChainEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getEvents(50).then(setEvents).catch((e) => setError(e instanceof Error ? e.message : "Could not load events")); }, []);
  const live = useBackendEvents((m) =>
    setEvents((old) => (old.some((e) => e.txHash === m.txHash && JSON.stringify(e.data) === JSON.stringify(m.data)) ? old
      : [{ type: m.event, block: m.block, txHash: m.txHash, data: m.data }, ...old].slice(0, 100))));

  return (
    <section>
      <h1>Activity <span className={live ? "badge ok" : "badge bad"}>{live ? "Live" : "Reconnecting..."}</span></h1>
      {error && <div className="banner bad">{error}</div>}
      {events.length === 0 && !error && <p className="muted">No events yet.</p>}
      {events.map((e) => (
        <div key={`${e.txHash}-${e.type}-${JSON.stringify(e.data)}`} className="row">
          <span>{describe(e)}</span>
          <span className="muted">block {e.block} · <a href={`${config.etherscanBase}/tx/${e.txHash}`} target="_blank" rel="noreferrer">tx</a></span>
        </div>
      ))}
    </section>
  );
}
