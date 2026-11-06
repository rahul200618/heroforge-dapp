import type { ChainEvent } from "./types";

export const short = (a: unknown) => (typeof a === "string" ? `${a.slice(0, 6)}...${a.slice(-4)}` : String(a));

export function describe(ev: Pick<ChainEvent, "type" | "data">): string {
  const d = ev.data as Record<string, unknown>;
  switch (ev.type) {
    case "CharacterMinted": return `Character #${d.tokenId} "${d.name}" was minted by ${short(d.owner)}`;
    case "ItemMinted": return `Item #${d.itemId} (${d.itemType}) was given to ${short(d.owner)}`;
    case "ItemEquipped": return `Item #${d.itemId} was equipped to character #${d.charId}`;
    case "ItemUnequipped": return `Item #${d.itemId} was removed from character #${d.charId}`;
    case "XPEarned": return `Character #${d.charId} earned ${d.amount} XP (total ${d.newTotal})`;
    case "StatUpgraded": return `Character #${d.charId} upgraded ${d.stat}: ${d.oldValue} to ${d.newValue}`;
    default: return ev.type;
  }
}
