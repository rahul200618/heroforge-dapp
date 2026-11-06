"use client";

import { useEffect, useRef, useState } from "react";
import { config } from "./config";
import type { WsMessage } from "./types";

export type EventMessage = Extract<WsMessage, { type: "event" }>;

/** Subscribes to the backend WebSocket, reconnecting with backoff. Returns whether it is live. */
export function useBackendEvents(onEvent: (msg: EventMessage) => void): boolean {
  const [live, setLive] = useState(false);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let stopped = false;
    let delay = 1000;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const open = () => {
      ws = new WebSocket(config.wsUrl);
      ws.onopen = () => { setLive(true); delay = 1000; };
      ws.onmessage = (m) => {
        try {
          const msg = JSON.parse(m.data as string) as WsMessage;
          if (msg.type === "event") handler.current(msg);
        } catch { /* ignore malformed messages */ }
      };
      ws.onclose = () => {
        setLive(false);
        if (!stopped) { timer = setTimeout(open, delay); delay = Math.min(delay * 2, 10000); }
      };
      ws.onerror = () => ws?.close();
    };
    open();
    return () => { stopped = true; if (timer) clearTimeout(timer); ws?.close(); };
  }, []);

  return live;
}
