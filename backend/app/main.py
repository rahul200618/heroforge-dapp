"""HeroForge backend (FastAPI).

Run from inside backend/:
    uvicorn app.main:app --reload --port 8000

Read endpoints : /api/health, /api/config, /api/characters, /api/characters/{id}, /api/items, /api/events
Live updates   : /ws/events (WebSocket)
Custodial      : POST /api/match/complete, POST /api/items/grant  (X-API-Key required)
Design: docs/TECHNICAL.md
"""
import asyncio
import concurrent.futures
import contextlib
import logging
import secrets
import sqlite3
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from requests.exceptions import RequestException
from web3 import Web3

from . import db, indexer
from .chain import Chain, ChainError
from .config import get_settings
from .schemas import (CharacterOut, ConfigOut, EventOut, GrantItemIn, HealthOut, ItemOut,
                      MatchCompleteIn, TxOut)
from .ws import WsHub

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("heroforge")
settings = get_settings()
hub = WsHub()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db(settings.db_path).close()
    chain = Chain(settings.sepolia_rpc_url, settings.contract_address, settings.chain_id,
                  settings.game_master_private_key.get_secret_value())
    chain.assert_ready()
    if settings.start_block == 0 and settings.chain_id == 11155111:
        raise ChainError(
            "START_BLOCK is 0. Set it in backend/.env to the block your contract was deployed in "
            "(find it on Etherscan), otherwise indexing would scan millions of blocks."
        )
    if chain.account is None:
        log.warning("No GAME_MASTER_PRIVATE_KEY set: running read-only, POST endpoints will return 503")
    elif not chain.is_game_master():
        raise ChainError(
            f"Backend wallet {chain.account.address} is not the contract's game master "
            f"(it is {chain.game_master()}). Run contracts/scripts/set-game-master.js first."
        )
    app.state.chain = chain
    poller = asyncio.create_task(indexer.poll_loop(settings.db_path, chain, settings, hub))
    try:
        yield
    finally:
        poller.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await poller


app = FastAPI(title="HeroForge API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-API-Key"],
)


@app.exception_handler(RequestException)
async def rpc_error_handler(request: Request, exc: RequestException):
    log.warning("RPC error: %s", exc)
    return JSONResponse(status_code=502, content={"detail": "RPC provider unreachable or returned an error"})


@app.exception_handler(ChainError)
async def chain_error_handler(request: Request, exc: ChainError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


# ---- dependencies -------------------------------------------------------------------
def get_chain(request: Request) -> Chain:
    return request.app.state.chain


def get_conn():
    """One short-lived SQLite connection per request."""
    conn = db.connect(settings.db_path)
    try:
        yield conn
    finally:
        conn.close()


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    expected = settings.match_api_key.get_secret_value()
    if not expected or not x_api_key or not secrets.compare_digest(x_api_key.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def parse_address(value: str, name: str) -> str:
    if not Web3.is_address(value):
        raise HTTPException(status_code=422, detail=f"{name} must be a valid Ethereum address")
    return Web3.to_checksum_address(value)


# ---- read endpoints -----------------------------------------------------------------
@app.get("/api/health", response_model=HealthOut)
def health(chain: Chain = Depends(get_chain), conn: sqlite3.Connection = Depends(get_conn)):
    last = db.get_meta(conn, "last_processed_block")
    try:
        latest = chain.latest_block()
        gm = chain.is_game_master() if chain.account is not None else None
    except RequestException:
        latest, gm = None, None
    return {"status": "ok", "chainId": settings.chain_id, "latestBlock": latest,
            "lastProcessedBlock": int(last) if last is not None else None, "isGameMaster": gm}


@app.get("/api/config", response_model=ConfigOut)
def public_config(chain: Chain = Depends(get_chain)):
    return {"contract": chain.address, "chainId": settings.chain_id, **chain.constants()}


_cache: dict[str, tuple[float, list]] = {}
CACHE_TTL = 15.0  # seconds


@app.get("/api/characters", response_model=list[CharacterOut])
def list_characters(owner: str = Query(...), chain: Chain = Depends(get_chain),
                    conn: sqlite3.Connection = Depends(get_conn)):
    owner = parse_address(owner, "owner")
    cache_key = f"chars_{owner.lower()}"
    now = time.time()
    if cache_key in _cache and (now - _cache[cache_key][0]) < CACHE_TTL:
        return _cache[cache_key][1]

    rows = conn.execute(
        "SELECT token_id FROM tokens WHERE kind='character' AND LOWER(owner)=LOWER(?) ORDER BY token_id", (owner,)
    ).fetchall()
    token_ids = [r["token_id"] for r in rows]
    if not token_ids:
        return []
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(12, len(token_ids))) as ex:
        chars = list(ex.map(chain.character, token_ids))
    result = [c for c in chars if c is not None and c["owner"].lower() == owner.lower()]
    _cache[cache_key] = (now, result)
    return result


@app.get("/api/characters/{char_id}", response_model=CharacterOut)
def get_character(char_id: int, chain: Chain = Depends(get_chain)):
    if char_id < 1:
        raise HTTPException(status_code=422, detail="char_id must be a positive integer")
    character = chain.character(char_id)
    if character is None:
        raise HTTPException(status_code=404, detail="Character does not exist")
    return character


@app.get("/api/items", response_model=list[ItemOut])
def list_items(owner: str = Query(...), chain: Chain = Depends(get_chain),
               conn: sqlite3.Connection = Depends(get_conn)):
    owner = parse_address(owner, "owner")
    rows = conn.execute(
        "SELECT token_id FROM tokens WHERE kind='item' AND LOWER(owner)=LOWER(?) ORDER BY token_id", (owner,)
    ).fetchall()
    token_ids = [r["token_id"] for r in rows]
    if not token_ids:
        return []
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(12, len(token_ids))) as ex:
        items = list(ex.map(chain.item, token_ids))
    return [i for i in items if i is not None and i["owner"].lower() == owner.lower()]


@app.get("/api/events", response_model=list[EventOut])
def recent_events(limit: int = Query(50, ge=1, le=200), conn: sqlite3.Connection = Depends(get_conn)):
    import json
    rows = conn.execute(
        "SELECT type, block, tx_hash, data FROM events ORDER BY block DESC, log_index DESC LIMIT ?", (limit,)
    ).fetchall()
    return [{"type": r["type"], "block": r["block"], "txHash": r["tx_hash"], "data": json.loads(r["data"])}
            for r in rows]


@app.websocket("/ws/events")
async def ws_events(ws: WebSocket):
    conn = db.connect(settings.db_path)
    try:
        last = db.get_meta(conn, "last_processed_block")
    finally:
        conn.close()
    await hub.connect(ws, {"type": "hello", "lastProcessedBlock": int(last) if last is not None else None})
    try:
        while True:
            await ws.receive_text()  # keep the socket open; clients send nothing
    except WebSocketDisconnect:
        hub.disconnect(ws)


# ---- custodial extension: the backend signs with the game-master key ----------------
@app.post("/api/match/complete", response_model=TxOut, dependencies=[Depends(require_api_key)])
def complete_match(body: MatchCompleteIn, chain: Chain = Depends(get_chain),
                   conn: sqlite3.Connection = Depends(get_conn)):
    if body.xp > settings.max_xp_per_match:
        raise HTTPException(status_code=422, detail=f"xp must be between 1 and {settings.max_xp_per_match}")
    chain.require_sendable(settings.min_gas_balance_eth)
    if not chain.is_character(body.charId):
        raise HTTPException(status_code=404, detail="Character does not exist")

    try:  # the PRIMARY KEY makes a duplicate matchId fail even under concurrent requests
        conn.execute(
            "INSERT INTO matches (match_id, char_id, xp, tx_hash, status, error, created_at) "
            "VALUES (?, ?, ?, NULL, 'pending', NULL, ?)", (body.matchId, body.charId, body.xp, _now()))
        conn.commit()
    except sqlite3.IntegrityError:
        retry = conn.execute(
            "UPDATE matches SET char_id=?, xp=?, tx_hash=NULL, status='pending', error=NULL "
            "WHERE match_id=? AND status='failed'", (body.charId, body.xp, body.matchId))
        conn.commit()
        if retry.rowcount == 0:
            raise HTTPException(status_code=409, detail="matchId already used")

    try:
        tx_hash = chain.send_earn_xp(body.charId, body.xp)
    except Exception as exc:
        log.exception("earnXP failed for match %s", body.matchId)
        conn.execute("UPDATE matches SET status='failed', error=? WHERE match_id=?", (str(exc)[:300], body.matchId))
        conn.commit()
        raise HTTPException(status_code=502, detail="Transaction could not be sent") from exc
    conn.execute("UPDATE matches SET tx_hash=?, status='submitted' WHERE match_id=? AND status='pending'",
                 (tx_hash, body.matchId))
    conn.commit()
    return {"status": "submitted", "matchId": body.matchId, "txHash": tx_hash}


@app.post("/api/items/grant", response_model=TxOut, dependencies=[Depends(require_api_key)])
def grant_item(body: GrantItemIn, chain: Chain = Depends(get_chain),
               conn: sqlite3.Connection = Depends(get_conn)):
    to = parse_address(body.to, "to")
    if body.itemType not in settings.item_types:
        raise HTTPException(status_code=422, detail=f"itemType must be one of: {', '.join(settings.item_types)}")
    chain.require_sendable(settings.min_gas_balance_eth)

    cur = conn.execute("INSERT INTO grants (to_address, item_type, tx_hash, status, created_at) "
                       "VALUES (?, ?, NULL, 'pending', ?)", (to, body.itemType, _now()))
    conn.commit()
    grant_id = cur.lastrowid
    try:
        tx_hash = chain.send_mint_item(to, body.itemType)
    except Exception as exc:
        log.exception("mintItem failed")
        conn.execute("UPDATE grants SET status='failed' WHERE id=?", (grant_id,))
        conn.commit()
        raise HTTPException(status_code=502, detail="Transaction could not be sent") from exc
    conn.execute("UPDATE grants SET tx_hash=?, status='submitted' WHERE id=? AND status='pending'", (tx_hash, grant_id))
    conn.commit()
    return {"status": "submitted", "txHash": tx_hash}
