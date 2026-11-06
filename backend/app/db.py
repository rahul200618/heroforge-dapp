"""SQLite storage. Schema follows docs/TECHNICAL.md, section 5."""
import os
import sqlite3

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens (
    token_id INTEGER PRIMARY KEY,
    kind     TEXT,              -- 'character' or 'item'
    owner    TEXT
);
CREATE INDEX IF NOT EXISTS idx_tokens_owner ON tokens (owner);

CREATE TABLE IF NOT EXISTS events (
    tx_hash   TEXT    NOT NULL,
    log_index INTEGER NOT NULL,
    block     INTEGER NOT NULL,
    type      TEXT    NOT NULL,
    data      TEXT    NOT NULL, -- JSON
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_events_block ON events (block DESC, log_index DESC);

CREATE TABLE IF NOT EXISTS matches (
    match_id   TEXT PRIMARY KEY,
    char_id    INTEGER NOT NULL,
    xp         INTEGER NOT NULL,
    tx_hash    TEXT,
    status     TEXT NOT NULL,   -- pending | submitted | confirmed | failed
    error      TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grants (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    to_address TEXT NOT NULL,
    item_type  TEXT NOT NULL,
    tx_hash    TEXT,
    status     TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


def connect(path: str) -> sqlite3.Connection:
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    # One short-lived connection per request or task. FastAPI runs sync endpoints in a
    # thread pool, so the connection must be allowed to cross threads.
    conn = sqlite3.connect(path, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(path: str) -> sqlite3.Connection:
    conn = connect(path)
    conn.execute("PRAGMA journal_mode=WAL")  # readers do not block the event poller's writes
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


def get_meta(conn: sqlite3.Connection, key: str, default: str | None = None) -> str | None:
    row = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def set_meta(conn: sqlite3.Connection, key: str, value: str, commit: bool = True) -> None:
    conn.execute(
        "INSERT INTO meta (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )
    if commit:
        conn.commit()
