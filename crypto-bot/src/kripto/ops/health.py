"""Health signals: what the bot records, and how they are read back.

The bot writes signals here on its way round the loop. The watchdog reads
them. The split matters: a process that can still write a heartbeat is not
necessarily a process that is still trading, so "is the process up" is the
one question this module deliberately does NOT answer.

Signals live in the same SQLite file as the risk state, which lets an
external observer open it **read-only** and be structurally incapable of
writing. That is a stronger guarantee than a rule saying the watchdog
must not write.
"""

from __future__ import annotations

import logging
import shutil
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

SIGNAL_SCHEMA = """
CREATE TABLE IF NOT EXISTS health_signals (
    name TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    observed_at TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS api_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at TEXT NOT NULL,
    ok INTEGER NOT NULL,
    endpoint TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_api_calls_time ON api_calls(occurred_at);
"""

# Signal names. Kept as constants so a typo cannot silently create a second,
# never-read signal.
LOOP_HEARTBEAT = "loop_heartbeat"
LAST_CANDLE_UPDATE = "last_candle_update"
LAST_CANDLE_OPEN = "last_candle_open"
LAST_ORDERBOOK_UPDATE = "last_orderbook_update"
LAST_RECONCILE = "last_reconcile"
EXCHANGE_TIME = "exchange_time"
LAST_NOTIFICATION_OK = "last_notification_ok"
NOTIFICATION_FAILING_SINCE = "notification_failing_since"


@dataclass(frozen=True)
class Signal:
    name: str
    value: str
    observed_at: datetime
    detail: str = ""

    def age_seconds(self, now: datetime) -> float:
        return (now - self.observed_at).total_seconds()


class HealthRecorder:
    """Bot-side writer. One per process."""

    def __init__(self, store):
        self.store = store
        self._conn = store._conn
        self._conn.executescript(SIGNAL_SCHEMA)

    def record(self, name: str, now: datetime, *, value: str = "", detail: str = "") -> None:
        with self.store._tx() as conn:
            conn.execute(
                "INSERT INTO health_signals(name, value, observed_at, detail) "
                "VALUES (?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET "
                "value=excluded.value, observed_at=excluded.observed_at, "
                "detail=excluded.detail",
                (name, value, now.isoformat(), detail),
            )

    def heartbeat(self, now: datetime, detail: str = "") -> None:
        """Called once per completed loop iteration.

        Deliberately at the END of the loop body: a heartbeat written at the
        start would keep ticking while the work inside the loop was hung.
        """
        self.record(LOOP_HEARTBEAT, now, detail=detail)

    def record_api_call(self, now: datetime, ok: bool, endpoint: str = "") -> None:
        with self.store._tx() as conn:
            conn.execute(
                "INSERT INTO api_calls(occurred_at, ok, endpoint) VALUES (?, ?, ?)",
                (now.isoformat(), 1 if ok else 0, endpoint),
            )

    def prune_api_calls(self, now: datetime, keep_seconds: float) -> None:
        cutoff = (now - timedelta(seconds=keep_seconds)).isoformat()
        with self.store._tx() as conn:
            conn.execute("DELETE FROM api_calls WHERE occurred_at < ?", (cutoff,))

    def record_notification_result(self, now: datetime, ok: bool) -> None:
        if ok:
            self.record(LAST_NOTIFICATION_OK, now)
            with self.store._tx() as conn:
                conn.execute(
                    "DELETE FROM health_signals WHERE name=?", (NOTIFICATION_FAILING_SINCE,)
                )
        else:
            existing = read_signal(self._conn, NOTIFICATION_FAILING_SINCE)
            if existing is None:
                self.record(NOTIFICATION_FAILING_SINCE, now)


def read_signal(conn: sqlite3.Connection, name: str) -> Signal | None:
    row = conn.execute(
        "SELECT * FROM health_signals WHERE name=?", (name,)
    ).fetchone()
    if row is None:
        return None
    return Signal(
        name=row["name"],
        value=row["value"],
        observed_at=datetime.fromisoformat(row["observed_at"]),
        detail=row["detail"],
    )


def api_error_rate(
    conn: sqlite3.Connection, now: datetime, window_seconds: float
) -> tuple[float, int]:
    """Error fraction over a rolling window, plus the sample size.

    The sample size is returned because a 100% error rate over two calls is
    not the same finding as 100% over two hundred, and a threshold applied
    without it produces alarms on the first two failures after a restart.
    """
    cutoff = (now - timedelta(seconds=window_seconds)).isoformat()
    row = conn.execute(
        "SELECT COUNT(*) AS total, SUM(CASE WHEN ok=0 THEN 1 ELSE 0 END) AS errors "
        "FROM api_calls WHERE occurred_at >= ?",
        (cutoff,),
    ).fetchone()
    total = int(row["total"] or 0)
    errors = int(row["errors"] or 0)
    if total == 0:
        return 0.0, 0
    return errors / total, total


def open_readonly(path: str | Path) -> sqlite3.Connection:
    """Open the state file so that writing is impossible, not merely forbidden.

    SQLite's ``mode=ro`` makes any INSERT/UPDATE/DELETE raise. That is what
    lets us say the observer cannot become a second order writer - it is
    enforced by the connection, not by our own good intentions.
    """
    uri = f"file:{Path(path).resolve()}?mode=ro"
    conn = sqlite3.connect(uri, uri=True, timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn


def free_disk_mb(path: str | Path) -> float:
    usage = shutil.disk_usage(Path(path).parent)
    return usage.free / (1024 * 1024)
