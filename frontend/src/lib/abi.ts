// Only what the browser calls, in human-readable form. Includes the contract's custom errors
// so reverts can be decoded into plain English.
export const HEROFORGE_ABI = [
  "function mintCharacter(string name) returns (uint256)",
  "function equipItem(uint256 charId, uint256 itemId)",
  "function unequipItem(uint256 charId, uint256 itemId)",
  "function spendXP(uint256 charId, string stat)",
  "event CharacterMinted(uint256 indexed tokenId, address indexed owner, string name)",
  "error NotGameMaster()",
  "error NotCharacterOwner()",
  "error NotItemOwner()",
  "error ItemAlreadyEquipped()",
  "error ItemNotEquippedToCharacter()",
  "error CharacterHasEquippedItems()",
  "error InsufficientXP()",
  "error InvalidStat()",
  "error StatCapReached()",
  "error NotACharacter()",
  "error NotAnItem()",
];
