"""Everything that talks to the blockchain: reads, event topics, and game-master transactions."""
import json
import threading
from functools import cached_property
from pathlib import Path

from eth_account import Account
from eth_utils.abi import event_abi_to_log_topic
from web3 import Web3
from web3.exceptions import ContractLogicError

ABI_PATH = Path(__file__).parent / "abi" / "HeroForge.json"


class ChainError(RuntimeError):
    """A problem with the chain connection or the backend wallet (shown to the operator)."""


def load_abi(path: Path = ABI_PATH) -> list[dict]:
    if not path.exists():
        raise ChainError(
            f"ABI file not found: {path}. Compile the contract, then run `node contracts/scripts/export-abi.js`."
        )
    return json.loads(path.read_text(encoding="utf-8"))


class Chain:
    def __init__(self, rpc_url: str, contract_address: str, chain_id: int, private_key: str = "", abi=None):
        if not rpc_url:
            raise ChainError("SEPOLIA_RPC_URL is not set in backend/.env")
        if not Web3.is_address(contract_address):
            raise ChainError("CONTRACT_ADDRESS is missing or not a valid address")
        self.expected_chain_id = chain_id
        self.w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 20}))
        self.address = Web3.to_checksum_address(contract_address)
        self.abi = abi if abi is not None else load_abi()
        self.contract = self.w3.eth.contract(address=self.address, abi=self.abi)
        self.account = None
        if private_key:
            try:
                self.account = Account.from_key(private_key)
            except Exception as exc:
                raise ChainError("GAME_MASTER_PRIVATE_KEY is not a valid private key") from exc
        self._tx_lock = threading.Lock()  # one game-master transaction at a time (nonce safety)
        self._constants: dict | None = None

    # ---- start-up checks ------------------------------------------------------
    def assert_ready(self) -> None:
        if not self.w3.is_connected():
            raise ChainError("Cannot reach the RPC endpoint. Check SEPOLIA_RPC_URL.")
        actual = self.w3.eth.chain_id
        if actual != self.expected_chain_id:
            raise ChainError(f"RPC reports chain ID {actual} but CHAIN_ID is {self.expected_chain_id}")
        if not self.w3.eth.get_code(self.address):
            raise ChainError("No contract code at CONTRACT_ADDRESS on this network")

    # ---- reads ------------------------------------------------------------------
    @cached_property
    def event_topics(self) -> dict[bytes, str]:
        return {bytes(event_abi_to_log_topic(e)): e["name"] for e in self.abi if e.get("type") == "event"}

    def latest_block(self) -> int:
        return self.w3.eth.block_number

    def game_master(self) -> str:
        return self.contract.functions.gameMaster().call()

    def is_game_master(self) -> bool:
        return self.account is not None and self.game_master().lower() == self.account.address.lower()

    def is_character(self, token_id: int) -> bool:
        return bool(self.contract.functions.isCharacter(token_id).call())

    def owner_of(self, token_id: int) -> str | None:
        try:
            return self.contract.functions.ownerOf(token_id).call()
        except ContractLogicError:  # ERC721NonexistentToken
            return None

    def equipped_item_ids(self, char_id: int) -> list[int]:
        return [int(i) for i in self.contract.functions.getEquippedItems(char_id).call()]

    def character(self, char_id: int) -> dict | None:
        """Live character data from the chain, or None if this ID is not a character."""
        try:
            name, xp, strength, speed, defence = self.contract.functions.getCharacter(char_id).call()
            owner = self.owner_of(char_id)
            if not owner:
                return None
            return {
                "id": char_id, "name": name, "owner": owner, "xp": int(xp),
                "strength": int(strength), "speed": int(speed), "defence": int(defence),
                "equippedItemIds": self.equipped_item_ids(char_id),
            }
        except Exception:
            return None

    def item(self, item_id: int) -> dict | None:
        """Live item data from the chain, or None if this ID is not an item."""
        owner = self.owner_of(item_id)
        if owner is None or self.is_character(item_id):
            return None
        item_type, equipped_to = self.contract.functions.getItem(item_id).call()
        return {"id": item_id, "itemType": item_type, "owner": owner, "equippedTo": int(equipped_to)}

    def constants(self) -> dict:
        if self._constants is None:
            self._constants = {
                "maxStat": int(self.contract.functions.MAX_STAT().call()),
                "xpPerUpgrade": int(self.contract.functions.XP_PER_UPGRADE().call()),
            }
        return self._constants

    # ---- game-master transactions (custodial extension) ---------------------------
    def require_sendable(self, min_balance_eth: float) -> None:
        if self.account is None:
            raise ChainError("GAME_MASTER_PRIVATE_KEY is not configured on the backend")
        if not self.is_game_master():
            raise ChainError("The backend wallet is not the contract's game master")
        if self.w3.eth.get_balance(self.account.address) < Web3.to_wei(min_balance_eth, "ether"):
            raise ChainError("Backend wallet balance is below the minimum. Top it up from a faucet")

    def _send(self, fn) -> str:
        with self._tx_lock:
            nonce = self.w3.eth.get_transaction_count(self.account.address, "pending")
            tx = fn.build_transaction(
                {"from": self.account.address, "nonce": nonce, "chainId": self.expected_chain_id}
            )
            signed = self.account.sign_transaction(tx)
            return Web3.to_hex(self.w3.eth.send_raw_transaction(signed.raw_transaction))

    def send_earn_xp(self, char_id: int, amount: int) -> str:
        return self._send(self.contract.functions.earnXP(char_id, amount))

    def send_mint_item(self, to: str, item_type: str) -> str:
        return self._send(self.contract.functions.mintItem(Web3.to_checksum_address(to), item_type))
