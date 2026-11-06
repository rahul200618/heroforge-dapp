"""Request and response models (field names match docs/TECHNICAL.md, section 4)."""
from typing import Any

from pydantic import BaseModel, Field


class HealthOut(BaseModel):
    status: str
    chainId: int
    latestBlock: int | None
    lastProcessedBlock: int | None
    isGameMaster: bool | None


class ConfigOut(BaseModel):
    contract: str
    chainId: int
    maxStat: int
    xpPerUpgrade: int


class CharacterOut(BaseModel):
    id: int
    name: str
    owner: str
    xp: int
    strength: int
    speed: int
    defence: int
    equippedItemIds: list[int]


class ItemOut(BaseModel):
    id: int
    itemType: str
    owner: str
    equippedTo: int


class EventOut(BaseModel):
    type: str
    block: int
    txHash: str
    data: dict[str, Any]


class MatchCompleteIn(BaseModel):
    matchId: str = Field(pattern=r"^[A-Za-z0-9_-]{1,64}$")
    charId: int = Field(ge=1)
    xp: int = Field(ge=1)


class GrantItemIn(BaseModel):
    to: str
    itemType: str = Field(min_length=1, max_length=32)


class TxOut(BaseModel):
    status: str
    txHash: str
    matchId: str | None = None
