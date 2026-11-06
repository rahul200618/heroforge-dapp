"""Event indexer: reads contract logs in block ranges and stores them in SQLite.

Feeds the token-owner index, the activity feed and the WebSocket broadcast
(docs/TECHNICAL.md, section 5).
"""
import asyncio
import json
import logging

from web3 import Web3

from . import db
from .chain import Chain

log = logging.getLogger("heroforge.indexer")

STORED_EVENTS = {"CharacterMinted", "ItemMinted", "ItemEquipped", "ItemUnequipped", "XPEarned", "StatUpgraded"}

UPSERT_OWNER = (
    "INSERT INTO tokens (token_id, kind, owner) VALUES (?, NULL, ?) "
    "ON CONFLICT(token_id) DO UPDATE SET owner = excluded.owner"
)
UPSERT_KIND = (
    "INSERT INTO tokens (token_id, kind, owner) VALUES (?, ?, ?) "
    "ON CONFLICT(token_id) DO UPDATE SET kind = excluded.kind"
)


def process_range(conn, chain: Chain, from_block: int, to_block: int) -> list[dict]:
    """Index logs in [from_block, to_block]. Everything, including the progress pointer,
    is written in ONE SQLite transaction. Returns only events that were new."""
    try:
        logs = chain.w3.eth.get_logs({"address": chain.address, "fromBlock": from_block, "toBlock": to_block})
    except Exception as exc:
        msg = str(exc)
        if "pruned history unavailable" in msg or "4444" in msg:
            log.warning("Block range [%d, %d] pruned by RPC node. Skipping.", from_block, to_block)
            db.set_meta(conn, "last_processed_block", str(to_block))
            return []
        raise
    logs = sorted(logs, key=lambda e: (e["blockNumber"], e["logIndex"]))
    new_events: list[dict] = []
    with conn:
        for entry in logs:
            if not entry["topics"]:
                continue
            name = chain.event_topics.get(bytes(entry["topics"][0]))
            if name is None:
                continue
            args = dict(getattr(chain.contract.events, name)().process_log(entry)["args"])

            if name == "Transfer":
                conn.execute(UPSERT_OWNER, (int(args["tokenId"]), args["to"]))
                continue
            if name == "CharacterMinted":
                conn.execute(UPSERT_KIND, (int(args["tokenId"]), "character", args["owner"]))
            elif name == "ItemMinted":
                conn.execute(UPSERT_KIND, (int(args["itemId"]), "item", args["owner"]))
            elif name == "GameMasterUpdated":
                log.warning("Game master changed from %s to %s", args["oldGameMaster"], args["newGameMaster"])
            if name not in STORED_EVENTS:
                continue

            tx_hash = Web3.to_hex(entry["transactionHash"])
            cur = conn.execute(
                "INSERT OR IGNORE INTO events (tx_hash, log_index, block, type, data) VALUES (?, ?, ?, ?, ?)",
                (tx_hash, entry["logIndex"], entry["blockNumber"], name, json.dumps(args)),
            )
            if cur.rowcount == 1:  # not seen before
                new_events.append(
                    {"type": name, "block": entry["blockNumber"], "txHash": tx_hash, "data": args}
                )
        db.set_meta(conn, "last_processed_block", str(to_block), commit=False)
    return new_events


def sync_once(conn, chain: Chain, start_block: int, chunk_blocks: int, margin: int) -> list[dict]:
    """Catch up from the last processed block to (latest - margin), in small chunks."""
    head = chain.latest_block() - margin
    last = db.get_meta(conn, "last_processed_block")
    cur = int(last) + 1 if last is not None else start_block
    new_events: list[dict] = []
    while cur <= head:
        end = min(cur + chunk_blocks - 1, head)
        new_events += process_range(conn, chain, cur, end)
        cur = end + 1
    return new_events


def run_sync(db_path: str, chain: Chain, settings) -> list[dict]:
    conn = db.connect(db_path)
    try:
        events = sync_once(conn, chain, settings.start_block, settings.log_chunk_blocks, settings.reorg_margin_blocks)
        with conn:  # mark grants and matches confirmed once their event has been indexed
            conn.execute(
                "UPDATE matches SET status='confirmed' WHERE status='submitted' "
                "AND tx_hash IN (SELECT tx_hash FROM events WHERE type='XPEarned')"
            )
            conn.execute(
                "UPDATE grants SET status='confirmed' WHERE status='submitted' "
                "AND tx_hash IN (SELECT tx_hash FROM events WHERE type='ItemMinted')"
            )
        return events
    finally:
        conn.close()


async def poll_loop(db_path: str, chain: Chain, settings, hub=None) -> None:
    while True:
        try:
            events = await asyncio.to_thread(run_sync, db_path, chain, settings)
            if hub is not None:
                for ev in events:
                    await hub.broadcast(
                        {"type": "event", "event": ev["type"], "block": ev["block"],
                         "txHash": ev["txHash"], "data": ev["data"]}
                    )
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Event sync failed; will retry")
        await asyncio.sleep(settings.poll_interval_seconds)
