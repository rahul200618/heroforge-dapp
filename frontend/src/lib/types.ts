// Shapes of the backend responses. Keep in sync with docs/TECHNICAL.md, section 4.

export interface HealthResponse {
  status: string;
  chainId: number;
  lastProcessedBlock: number | null;
  isGameMaster: boolean | null;
}

export interface ConfigResponse {
  contract: string;
  chainId: number;
  maxStat?: number;
  xpPerUpgrade?: number;
}

export interface Character {
  id: number;
  name: string;
  owner: string;
  xp: number;
  strength: number;
  speed: number;
  defence: number;
  equippedItemIds: number[];
}

export interface Item {
  id: number;
  itemType: string;
  owner: string;
  equippedTo: number; // 0 = not equipped
}

export type ChainEventType =
  | "CharacterMinted"
  | "ItemMinted"
  | "ItemEquipped"
  | "ItemUnequipped"
  | "XPEarned"
  | "StatUpgraded";

export interface ChainEvent {
  type: ChainEventType;
  block: number;
  txHash: string;
  data: Record<string, unknown>;
}

export type WsMessage =
  | { type: "hello"; lastProcessedBlock: number }
  | { type: "event"; event: ChainEventType; block: number; txHash: string; data: Record<string, unknown> };
