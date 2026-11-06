import { Interface, isError } from "ethers";
import { HEROFORGE_ABI } from "./abi";

const iface = new Interface(HEROFORGE_ABI);

const MESSAGES: Record<string, string> = {
  NotCharacterOwner: "You don't own this character.",
  NotItemOwner: "You don't own this item.",
  ItemAlreadyEquipped: "This item is already equipped.",
  ItemNotEquippedToCharacter: "This item isn't equipped to this character.",
  CharacterHasEquippedItems: "Unequip all items before transferring this character.",
  InsufficientXP: "You don't have enough XP. An upgrade costs 10.",
  StatCapReached: "This stat is already at the maximum of 100.",
  InvalidStat: "Unknown stat.",
  NotACharacter: "That token doesn't exist.",
  NotAnItem: "That token doesn't exist.",
  NotGameMaster: "Only the game master can do that.",
};

type AnyErr = { code?: number | string; revert?: { name?: string }; data?: unknown; info?: { error?: { code?: number; data?: unknown } } };

/** True when the user pressed Reject in MetaMask. */
export function isRejected(e: unknown): boolean {
  if (isError(e, "ACTION_REJECTED")) return true;
  const err = e as AnyErr;
  return err?.code === 4001 || err?.info?.error?.code === 4001;
}

/** Turn a failed transaction into a message a player can understand. */
export function friendlyError(e: unknown): string {
  const err = e as AnyErr;
  let name = err?.revert?.name;
  if (!name) {
    const raw = err?.data ?? err?.info?.error?.data;
    const hex = typeof raw === "string" ? raw : (raw as { data?: string } | undefined)?.data;
    if (typeof hex === "string" && hex.startsWith("0x")) {
      try { name = iface.parseError(hex)?.name; } catch { /* not one of our errors */ }
    }
  }
  if (name && MESSAGES[name]) return MESSAGES[name];
  const msg = e instanceof Error ? e.message : String(e);
  return `Transaction failed: ${msg.slice(0, 160)}`;
}

export { iface as heroForgeInterface };
