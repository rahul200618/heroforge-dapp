"""Settings, read from environment variables or backend/.env.

Run the backend from inside backend/ so the relative .env path resolves.
Variable names match docs/TECHNICAL.md, section 10.
"""
from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    sepolia_rpc_url: str = ""
    contract_address: str = ""
    chain_id: int = 11155111
    start_block: int = 0

    # Secrets: SecretStr keeps them out of logs and repr output.
    game_master_private_key: SecretStr = SecretStr("")
    match_api_key: SecretStr = SecretStr("")

    max_xp_per_match: int = 100
    item_types_allowed: str = "sword,shield,helmet"
    poll_interval_seconds: int = 5
    log_chunk_blocks: int = 1000
    reorg_margin_blocks: int = 1  # stay this many blocks behind the head when indexing
    min_gas_balance_eth: float = 0.01
    cors_origin: str = "http://localhost:3000"
    db_path: str = "./data/heroforge.db"

    @property
    def item_types(self) -> list[str]:
        return [t.strip() for t in self.item_types_allowed.split(",") if t.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
