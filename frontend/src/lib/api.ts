import { config } from "./config";
import type { ChainEvent, Character, ConfigResponse, HealthResponse, Item } from "./types";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${config.backendUrl}${path}`, { cache: "no-store" });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // body was not JSON; keep the status text
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  return (await res.json()) as T;
}

export const getHealth = () => getJson<HealthResponse>("/api/health");
export const getConfig = () => getJson<ConfigResponse>("/api/config");
export const getCharacters = (owner: string) =>
  getJson<Character[]>(`/api/characters?owner=${encodeURIComponent(owner)}`);
export const getCharacter = (id: number) => getJson<Character>(`/api/characters/${id}`);
export const getItems = (owner: string) => getJson<Item[]>(`/api/items?owner=${encodeURIComponent(owner)}`);
export const getEvents = (limit = 50) => getJson<ChainEvent[]>(`/api/events?limit=${limit}`);
