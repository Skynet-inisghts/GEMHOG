"""SQLite state: who watches what, who wants alerts, what was already sent.

One file next to the bot (bot/state.db by default), three tiny tables. The
bot can restart at any moment and pick up exactly where it stopped.
"""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from typing import Iterator

DB_PATH = os.environ.get("GEMHOG_BOT_DB", os.path.join(os.path.dirname(__file__), "state.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS watches (
  chat_id INTEGER NOT NULL,
  token TEXT NOT NULL,
  symbol TEXT NOT NULL DEFAULT '',
  last_grade TEXT,
  last_score INTEGER,
  last_dev_sells INTEGER DEFAULT 0,
  PRIMARY KEY (chat_id, token)
);
CREATE TABLE IF NOT EXISTS alert_subs (
  chat_id INTEGER PRIMARY KEY,
  since TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sent_alerts (
  chat_id INTEGER NOT NULL,
  token TEXT NOT NULL,
  PRIMARY KEY (chat_id, token)
);
"""


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        conn.executescript(SCHEMA)
        yield conn
        conn.commit()
    finally:
        conn.close()


def add_watch(chat_id: int, token: str, symbol: str) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO watches (chat_id, token, symbol) VALUES (?, ?, ?)",
            (chat_id, token.lower(), symbol),
        )


def remove_watches(chat_id: int) -> int:
    with connect() as conn:
        return conn.execute("DELETE FROM watches WHERE chat_id = ?", (chat_id,)).rowcount


def list_watches() -> list[sqlite3.Row]:
    with connect() as conn:
        return conn.execute("SELECT * FROM watches").fetchall()


def update_watch(chat_id: int, token: str, grade: str, score: int, dev_sells: int) -> None:
    with connect() as conn:
        conn.execute(
            "UPDATE watches SET last_grade = ?, last_score = ?, last_dev_sells = ? WHERE chat_id = ? AND token = ?",
            (grade, score, dev_sells, chat_id, token.lower()),
        )


def set_alerts(chat_id: int, on: bool, since_iso: str) -> None:
    with connect() as conn:
        if on:
            conn.execute("INSERT OR REPLACE INTO alert_subs (chat_id, since) VALUES (?, ?)", (chat_id, since_iso))
        else:
            conn.execute("DELETE FROM alert_subs WHERE chat_id = ?", (chat_id,))


def alert_subscribers() -> list[sqlite3.Row]:
    with connect() as conn:
        return conn.execute("SELECT * FROM alert_subs").fetchall()


def mark_alert_sent(chat_id: int, token: str) -> bool:
    """True when this alert had not been sent to this chat before."""
    with connect() as conn:
        try:
            conn.execute("INSERT INTO sent_alerts (chat_id, token) VALUES (?, ?)", (chat_id, token.lower()))
            return True
        except sqlite3.IntegrityError:
            return False
