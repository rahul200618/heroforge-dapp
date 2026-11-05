"""HeroForge backend (FastAPI).

Run from inside backend/:
    uvicorn app.main:app --reload --port 8000

Build order (each step is a testable milestone for the progress demo):
  1. chain.py   : web3.py connection, ABI, read helpers (getCharacter, getItem, ...)
  2. GET /api/characters, /api/characters/{id}, /api/items, /api/config (with constants)
  3. indexer.py : event poller, token-owner index, WebSocket /ws/events
  4. POST /api/match/complete and /api/items/grant (custodial extension)
  5. Start-up check: gameMaster() must equal the backend wallet address
See docs/TECHNICAL.md for the full design.
"""
import sqlite3
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import db
from .config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db(settings.db_path).close()  # create tables on first run
    # TODO: connect web3, assert chain id, verify gameMaster() == backend address, start poller
    yield


def get_conn():
    """One short-lived SQLite connection per request."""
    conn = db.connect(settings.db_path)
    try:
        yield conn
    finally:
        conn.close()


app = FastAPI(title="HeroForge API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-API-Key"],
)


@app.get("/api/health")
def health(conn: sqlite3.Connection = Depends(get_conn)):
    last = db.get_meta(conn, "last_processed_block")
    return {
        "status": "ok",
        "chainId": settings.chain_id,
        "lastProcessedBlock": int(last) if last is not None else None,
        "isGameMaster": None,  # TODO: set once the start-up check exists
    }


@app.get("/api/config")
def public_config():
    # TODO: add maxStat and xpPerUpgrade, read from the contract
    return {"contract": settings.contract_address, "chainId": settings.chain_id}
