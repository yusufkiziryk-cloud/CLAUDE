"""Durable risk state: period baselines, locks, stop counters, reservations.

Design constraint from the architecture rules: this store is NOT a second
position ledger. Freqtrade owns trades and fills. What lives here is only
what freqtrade does not model:

* period baselines (calendar day / week) and the peak-equity watermark,
* entry locks and their unlock conditions,
* the consecutive-stop counter,
* **reservations** for entries that have been decided but not yet filled.

Reservations are the reason this is SQLite and not a JSON file. Two signals
firing in the same loop must not both spend the last of the risk budget, and
the only cheap way to get that right across a crash is a real transaction.

Open-position risk is always passed IN by the caller, derived from
freqtrade's own trade records, so the two ledgers can never disagree about
how many positions exist.
"""

from __future__ import annotations

import json
import logging
import os
import socket
import sqlite3
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from enum import Enum
from pathlib import Path
from typing import Iterator

from ..money import ZERO, dec

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 1


class BotState(str, Enum):
    """Coarse operating state. Names are ours; they are not freqtrade keys."""

    READY = "READY"
    ENTRY_PAUSED = "ENTRY_PAUSED"
    RECONCILING = "RECONCILING"
    RECOVERY_REQUIRED = "RECOVERY_REQUIRED"
    STOPPED = "STOPPED"

    @property
    def entries_allowed(self) -> bool:
        return self is BotState.READY

    @property
    def exits_managed(self) -> bool:
        """Exits keep running in every state except a full stop.

        An entry lock that also stopped stop-loss management would turn a
        risk control into a risk amplifier.
        """
        return self is not BotState.STOPPED


class LockKind(str, Enum):
    DAILY_LOSS = "DAILY_LOSS"
    WEEKLY_LOSS = "WEEKLY_LOSS"
    MAX_DRAWDOWN = "MAX_DRAWDOWN"
    CONSECUTIVE_STOPS = "CONSECUTIVE_STOPS"
    PAIR_COOLDOWN = "PAIR_COOLDOWN"
    DATA_QUALITY = "DATA_QUALITY"
    RECONCILIATION = "RECONCILIATION"
    OPERATOR = "OPERATOR"

    @property
    def requires_operator(self) -> bool:
        """Locks that time alone must never clear."""
        return self in (
            LockKind.MAX_DRAWDOWN,
            LockKind.RECONCILIATION,
            LockKind.OPERATOR,
        )


class ReservationState(str, Enum):
    PENDING = "PENDING"
    PARTIALLY_FILLED = "PARTIALLY_FILLED"
    FILLED = "FILLED"
    RELEASED = "RELEASED"
    UNKNOWN = "UNKNOWN"

    @property
    def holds_budget(self) -> bool:
        """States whose risk still counts against the portfolio budget.

        UNKNOWN holds budget on purpose: an order whose fate we cannot
        determine may yet turn out to be filled, and assuming otherwise is
        how a bot ends up over-exposed.
        """
        return self in (
            ReservationState.PENDING,
            ReservationState.PARTIALLY_FILLED,
            ReservationState.UNKNOWN,
        )


@dataclass(frozen=True)
class Lock:
    lock_id: str
    kind: LockKind
    reason: str
    created_at: datetime
    expires_at: datetime | None
    pair: str | None
    metadata: dict

    def is_active(self, now: datetime) -> bool:
        if self.kind.requires_operator:
            return True
        if self.expires_at is None:
            return True
        return now < self.expires_at


@dataclass(frozen=True)
class Reservation:
    intent_id: str
    pair: str
    amount_base: Decimal
    risk_quote: Decimal
    notional_quote: Decimal
    state: ReservationState
    filled_base: Decimal
    created_at: datetime
    updated_at: datetime

    @property
    def unfilled_base(self) -> Decimal:
        remaining = self.amount_base - self.filled_base
        return remaining if remaining > ZERO else ZERO


@dataclass(frozen=True)
class PeriodBaseline:
    period_type: str
    period_start: datetime
    starting_equity: Decimal
    net_external_flow: Decimal


class RiskStateError(RuntimeError):
    pass


def _pid_alive(pid: int) -> bool:
    """Is a process with this pid running on this host?"""
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def utc_day_start(now: datetime) -> datetime:
    return now.astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)


def utc_week_start(now: datetime) -> datetime:
    """Monday 00:00 UTC of the week containing ``now``."""
    day = utc_day_start(now)
    return day - timedelta(days=day.weekday())


_SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bot_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    state TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS periods (
    period_type TEXT NOT NULL,
    period_start TEXT NOT NULL,
    starting_equity TEXT NOT NULL,
    net_external_flow TEXT NOT NULL DEFAULT '0',
    created_at TEXT NOT NULL,
    PRIMARY KEY (period_type, period_start)
);
CREATE TABLE IF NOT EXISTS peak_equity (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    value TEXT NOT NULL,
    observed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS locks (
    lock_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    reason TEXT NOT NULL,
    pair TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    cleared_at TEXT,
    metadata TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS reservations (
    intent_id TEXT PRIMARY KEY,
    pair TEXT NOT NULL,
    amount_base TEXT NOT NULL,
    risk_quote TEXT NOT NULL,
    notional_quote TEXT NOT NULL,
    state TEXT NOT NULL,
    filled_base TEXT NOT NULL DEFAULT '0',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    release_reason TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS stop_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    counted INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS entry_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    decided_at TEXT NOT NULL,
    pair TEXT NOT NULL,
    intent_id TEXT NOT NULL,
    allowed INTEGER NOT NULL,
    code TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    amount_base TEXT NOT NULL DEFAULT '0',
    binding_cap TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_decisions_time ON entry_decisions(decided_at);
CREATE TABLE IF NOT EXISTS writer_lock (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    owner TEXT NOT NULL,
    host TEXT NOT NULL,
    pid INTEGER NOT NULL,
    acquired_at TEXT NOT NULL,
    heartbeat_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pending_entries (
    intent_id TEXT PRIMARY KEY,
    pair TEXT NOT NULL,
    amount_base TEXT NOT NULL,
    entry_price TEXT NOT NULL,
    stop_price TEXT NOT NULL,
    atr TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pending_pair ON pending_entries(pair, created_at);
CREATE INDEX IF NOT EXISTS idx_res_state ON reservations(state);
CREATE INDEX IF NOT EXISTS idx_locks_cleared ON locks(cleared_at);
"""


class RiskStore:
    """SQLite-backed risk state.

    Every mutating method runs inside ``BEGIN IMMEDIATE`` so that concurrent
    writers serialise rather than interleave.
    """

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self.path), isolation_level=None, timeout=30.0)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA synchronous=FULL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._conn.executescript(_SCHEMA)
        self._ensure_version()
        self._tx_depth = 0

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> RiskStore:
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    # -- plumbing ----------------------------------------------------------

    @contextmanager
    def _tx(self) -> Iterator[sqlite3.Connection]:
        """One ``BEGIN IMMEDIATE`` per outermost call; nested calls join it.

        Re-entrancy is what lets an order-state change and its budget
        release commit TOGETHER (``OrderLedger._apply``) instead of as two
        transactions with a crash window between them - the audit found the
        second transaction could fail and leave a terminal order holding
        budget forever.
        """
        if self._tx_depth > 0:
            self._tx_depth += 1
            try:
                yield self._conn
            finally:
                self._tx_depth -= 1
            return

        self._conn.execute("BEGIN IMMEDIATE")
        self._tx_depth = 1
        try:
            yield self._conn
        except BaseException:
            self._tx_depth = 0
            # SQLite rolls back on its own for SQLITE_FULL, IOERR and friends.
            # An explicit ROLLBACK after that raises "no transaction is
            # active" from inside this handler and would REPLACE the real
            # error (found by T18 disk-full injection). Roll back only what
            # is still open; the original exception propagates either way.
            if self._conn.in_transaction:
                self._conn.execute("ROLLBACK")
            raise
        self._tx_depth = 0
        self._conn.execute("COMMIT")

    def _ensure_version(self) -> None:
        row = self._conn.execute("SELECT value FROM meta WHERE key='schema_version'").fetchone()
        if row is None:
            self._conn.execute(
                "INSERT INTO meta(key, value) VALUES ('schema_version', ?)",
                (str(SCHEMA_VERSION),),
            )
        elif int(row["value"]) != SCHEMA_VERSION:
            raise RiskStateError(
                f"risk state schema version {row['value']} != {SCHEMA_VERSION}; "
                "refusing to run against an unknown state file"
            )

    # -- bot state ---------------------------------------------------------

    def get_state(self) -> BotState:
        row = self._conn.execute("SELECT state FROM bot_state WHERE id=1").fetchone()
        if row is None:
            # A fresh store has never reconciled with the exchange.
            return BotState.RECONCILING
        return BotState(row["state"])

    def set_state(self, state: BotState, reason: str, now: datetime) -> None:
        with self._tx() as conn:
            conn.execute(
                "INSERT INTO bot_state(id, state, reason, updated_at) VALUES (1, ?, ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET state=excluded.state, reason=excluded.reason, "
                "updated_at=excluded.updated_at",
                (state.value, reason, now.isoformat()),
            )

    # -- period baselines --------------------------------------------------

    def get_period(self, period_type: str, period_start: datetime) -> PeriodBaseline | None:
        row = self._conn.execute(
            "SELECT * FROM periods WHERE period_type=? AND period_start=?",
            (period_type, period_start.isoformat()),
        ).fetchone()
        if row is None:
            return None
        return PeriodBaseline(
            period_type=row["period_type"],
            period_start=datetime.fromisoformat(row["period_start"]),
            starting_equity=dec(row["starting_equity"]),
            net_external_flow=dec(row["net_external_flow"]),
        )

    def open_period(
        self, period_type: str, period_start: datetime, equity: Decimal, now: datetime
    ) -> PeriodBaseline:
        """Record the equity a period started with. Never overwrites.

        The no-overwrite rule is what stops a restart mid-period from adopting
        the current (already reduced) balance as the new baseline and quietly
        erasing the day's loss.
        """
        with self._tx() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO periods"
                "(period_type, period_start, starting_equity, net_external_flow, created_at) "
                "VALUES (?, ?, ?, '0', ?)",
                (period_type, period_start.isoformat(), str(equity), now.isoformat()),
            )
        baseline = self.get_period(period_type, period_start)
        assert baseline is not None
        return baseline

    def record_external_flow(
        self, period_type: str, period_start: datetime, amount: Decimal
    ) -> None:
        """External deposits/withdrawals, so the loss metric is not fooled."""
        with self._tx() as conn:
            conn.execute(
                "UPDATE periods SET net_external_flow = CAST("
                "  (CAST(net_external_flow AS REAL) + ?) AS TEXT) "
                "WHERE period_type=? AND period_start=?",
                (float(amount), period_type, period_start.isoformat()),
            )

    # -- peak equity -------------------------------------------------------

    def get_peak_equity(self) -> Decimal | None:
        row = self._conn.execute("SELECT value FROM peak_equity WHERE id=1").fetchone()
        return dec(row["value"]) if row else None

    def update_peak_equity(self, equity: Decimal, now: datetime) -> Decimal:
        """Raise the watermark. It never falls, so drawdown is measured from
        the true high rather than from wherever the bot was last restarted."""
        with self._tx() as conn:
            row = conn.execute("SELECT value FROM peak_equity WHERE id=1").fetchone()
            current = dec(row["value"]) if row else None
            if current is None or equity > current:
                conn.execute(
                    "INSERT INTO peak_equity(id, value, observed_at) VALUES (1, ?, ?) "
                    "ON CONFLICT(id) DO UPDATE SET value=excluded.value, "
                    "observed_at=excluded.observed_at",
                    (str(equity), now.isoformat()),
                )
                current = equity
        return current

    # -- locks -------------------------------------------------------------

    def add_lock(
        self,
        kind: LockKind,
        reason: str,
        now: datetime,
        *,
        expires_at: datetime | None = None,
        pair: str | None = None,
        metadata: dict | None = None,
    ) -> str:
        lock_id = str(uuid.uuid4())
        with self._tx() as conn:
            conn.execute(
                "INSERT INTO locks(lock_id, kind, reason, pair, created_at, expires_at, metadata) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    lock_id,
                    kind.value,
                    reason,
                    pair,
                    now.isoformat(),
                    expires_at.isoformat() if expires_at else None,
                    json.dumps(metadata or {}),
                ),
            )
        logger.warning("risk lock added: %s (%s) pair=%s", kind.value, reason, pair)
        return lock_id

    def active_locks(self, now: datetime, *, pair: str | None = None) -> list[Lock]:
        rows = self._conn.execute(
            "SELECT * FROM locks WHERE cleared_at IS NULL ORDER BY created_at"
        ).fetchall()
        locks = []
        for row in rows:
            lock = Lock(
                lock_id=row["lock_id"],
                kind=LockKind(row["kind"]),
                reason=row["reason"],
                created_at=datetime.fromisoformat(row["created_at"]),
                expires_at=(
                    datetime.fromisoformat(row["expires_at"]) if row["expires_at"] else None
                ),
                pair=row["pair"],
                metadata=json.loads(row["metadata"]),
            )
            if not lock.is_active(now):
                continue
            if lock.pair is not None and pair is not None and lock.pair != pair:
                continue
            locks.append(lock)
        return locks

    def clear_lock(self, lock_id: str, now: datetime, operator_ack: bool = False) -> None:
        row = self._conn.execute(
            "SELECT kind FROM locks WHERE lock_id=? AND cleared_at IS NULL", (lock_id,)
        ).fetchone()
        if row is None:
            return
        kind = LockKind(row["kind"])
        if kind.requires_operator and not operator_ack:
            raise RiskStateError(
                f"lock {kind.value} requires explicit operator acknowledgement; "
                "time alone does not clear it"
            )
        with self._tx() as conn:
            conn.execute(
                "UPDATE locks SET cleared_at=? WHERE lock_id=?", (now.isoformat(), lock_id)
            )

    # -- consecutive stops -------------------------------------------------

    def record_stop(self, pair: str, now: datetime) -> int:
        with self._tx() as conn:
            conn.execute(
                "INSERT INTO stop_events(pair, occurred_at) VALUES (?, ?)",
                (pair, now.isoformat()),
            )
        return self.consecutive_stops()

    def consecutive_stops(self) -> int:
        row = self._conn.execute(
            "SELECT COUNT(*) AS n FROM stop_events WHERE counted=1"
        ).fetchone()
        return int(row["n"])

    def reset_stop_counter(self, now: datetime) -> None:
        """Called after a profitable exit, per the documented sequencing."""
        with self._tx() as conn:
            conn.execute("UPDATE stop_events SET counted=0 WHERE counted=1")

    # -- entry decisions ---------------------------------------------------

    def record_entry_decision(
        self,
        *,
        now: datetime,
        pair: str,
        intent_id: str,
        allowed: bool,
        code: str,
        reason: str = "",
        amount_base: Decimal | None = None,
        binding_cap: str = "",
    ) -> None:
        """Log every entry decision, accepted AND refused.

        Refusals are the more interesting half. A week with two trades and
        four hundred refusals is a completely different system from a week
        with two trades and four signals, and only the recorded reasons can
        tell those apart. Keeping them only in the log file means they are
        gone the first time logs rotate.
        """
        with self._tx() as conn:
            conn.execute(
                "INSERT INTO entry_decisions(decided_at, pair, intent_id, allowed, code, "
                "reason, amount_base, binding_cap) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    now.isoformat(), pair, intent_id, 1 if allowed else 0, code,
                    reason[:500], str(amount_base or ZERO), binding_cap,
                ),
            )

    def entry_decisions_between(
        self, start: datetime, end: datetime
    ) -> list[dict]:
        rows = self._conn.execute(
            "SELECT * FROM entry_decisions WHERE decided_at >= ? AND decided_at < ? "
            "ORDER BY decided_at",
            (start.isoformat(), end.isoformat()),
        ).fetchall()
        return [dict(r) for r in rows]

    def locks_between(self, start: datetime, end: datetime) -> list[dict]:
        rows = self._conn.execute(
            "SELECT * FROM locks WHERE created_at >= ? AND created_at < ? ORDER BY created_at",
            (start.isoformat(), end.isoformat()),
        ).fetchall()
        return [dict(r) for r in rows]

    # -- single writer -----------------------------------------------------

    def acquire_writer_lock(
        self,
        owner: str,
        now: datetime,
        *,
        lease_seconds: float = 300.0,
        force: bool = False,
    ) -> tuple[bool, str]:
        """Claim the right to be the only order writer for this account.

        One bot, one account, one writer. A second instance pointed at the
        same state file is refused, because two writers would each size
        positions against a budget the other is also spending.

        IMPORTANT AND DELIBERATELY NOT HIDDEN: this is a lock on a *file*. It
        stops a second process on this machine. It does NOT stop a second
        process on another machine pointed at the same exchange account -
        nothing here can. V1 is therefore limited to a single host, and the
        runbook says so.

        A lease that has stopped being renewed for ``lease_seconds`` is
        treated as abandoned and may be taken over, because otherwise a
        crashed process would lock the account out forever.
        """
        host = socket.gethostname()
        pid = os.getpid()
        with self._tx() as conn:
            row = conn.execute("SELECT * FROM writer_lock WHERE id=1").fetchone()
            if row is not None and not force:
                if row["owner"] == owner:
                    conn.execute(
                        "UPDATE writer_lock SET heartbeat_at=? WHERE id=1", (now.isoformat(),)
                    )
                    return True, "already held by this owner; lease renewed"

                last_beat = datetime.fromisoformat(row["heartbeat_at"])
                age = (now - last_beat).total_seconds()
                if row["host"] == host and not _pid_alive(int(row["pid"])):
                    # A crashed process on THIS host cannot be a second writer.
                    # Without this, a systemd restart 30s after a crash was
                    # refused for the rest of the 300s lease, and five such
                    # refusals hit StartLimitBurst - the bot stayed down.
                    logger.warning(
                        "taking over a writer lock left by pid %s on this host, which "
                        "is no longer running (last heartbeat %.0fs ago)",
                        row["pid"], age,
                    )
                elif age < lease_seconds:
                    return False, (
                        f"another instance holds the writer lock: owner={row['owner']} "
                        f"host={row['host']} pid={row['pid']}, last heartbeat {age:.0f}s ago. "
                        "Refusing to become a second order writer for the same account."
                    )
                logger.warning(
                    "taking over a writer lock abandoned %.0fs ago by %s (pid %s on %s)",
                    age, row["owner"], row["pid"], row["host"],
                )

            conn.execute(
                "INSERT INTO writer_lock(id, owner, host, pid, acquired_at, heartbeat_at) "
                "VALUES (1, ?, ?, ?, ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET owner=excluded.owner, host=excluded.host, "
                "pid=excluded.pid, acquired_at=excluded.acquired_at, "
                "heartbeat_at=excluded.heartbeat_at",
                (owner, host, pid, now.isoformat(), now.isoformat()),
            )
        return True, "writer lock acquired"

    def heartbeat_writer_lock(self, owner: str, now: datetime) -> bool:
        """Renew the lease. Returns False if this owner no longer holds it."""
        with self._tx() as conn:
            row = conn.execute("SELECT owner FROM writer_lock WHERE id=1").fetchone()
            if row is None or row["owner"] != owner:
                return False
            conn.execute("UPDATE writer_lock SET heartbeat_at=? WHERE id=1", (now.isoformat(),))
        return True

    def release_writer_lock(self, owner: str) -> None:
        with self._tx() as conn:
            conn.execute("DELETE FROM writer_lock WHERE id=1 AND owner=?", (owner,))

    def writer_lock_holder(self) -> dict | None:
        row = self._conn.execute("SELECT * FROM writer_lock WHERE id=1").fetchone()
        return dict(row) if row else None

    # -- reservations ------------------------------------------------------

    def reserved_risk(self) -> Decimal:
        """Risk held by reservations that have not been resolved."""
        total = ZERO
        for row in self._conn.execute("SELECT * FROM reservations").fetchall():
            state = ReservationState(row["state"])
            if not state.holds_budget:
                continue
            total += dec(row["risk_quote"])
        return total

    def reserved_notional(self, pair: str | None = None) -> Decimal:
        total = ZERO
        for row in self._conn.execute("SELECT * FROM reservations").fetchall():
            if not ReservationState(row["state"]).holds_budget:
                continue
            if pair is not None and row["pair"] != pair:
                continue
            total += dec(row["notional_quote"])
        return total

    def open_reservations(self) -> list[Reservation]:
        rows = self._conn.execute("SELECT * FROM reservations").fetchall()
        return [self._row_to_reservation(r) for r in rows if ReservationState(r["state"]).holds_budget]

    def get_reservation(self, intent_id: str) -> Reservation | None:
        row = self._conn.execute(
            "SELECT * FROM reservations WHERE intent_id=?", (intent_id,)
        ).fetchone()
        return self._row_to_reservation(row) if row else None

    @staticmethod
    def _row_to_reservation(row: sqlite3.Row) -> Reservation:
        return Reservation(
            intent_id=row["intent_id"],
            pair=row["pair"],
            amount_base=dec(row["amount_base"]),
            risk_quote=dec(row["risk_quote"]),
            notional_quote=dec(row["notional_quote"]),
            state=ReservationState(row["state"]),
            filled_base=dec(row["filled_base"]),
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )

    def try_reserve(
        self,
        *,
        intent_id: str,
        pair: str,
        amount_base: Decimal,
        risk_quote: Decimal,
        notional_quote: Decimal,
        risk_budget_remaining: Decimal,
        notional_budget_remaining: Decimal,
        max_concurrent: int,
        existing_positions: int,
        now: datetime,
    ) -> tuple[bool, str]:
        """Atomically take budget for one entry intent.

        The budget check and the insert happen inside one immediate
        transaction, which is what makes two simultaneous signals mutually
        exclusive instead of merely unlikely to collide.
        """
        if amount_base <= ZERO:
            return False, "amount_base must be positive"

        with self._tx() as conn:
            existing = conn.execute(
                "SELECT intent_id FROM reservations WHERE intent_id=?", (intent_id,)
            ).fetchone()
            if existing is not None:
                # Idempotent: replaying the same intent must not double-book.
                return False, f"intent {intent_id} already reserved"

            held_risk = ZERO
            held_notional = ZERO
            held_count = 0
            for row in conn.execute("SELECT * FROM reservations").fetchall():
                if not ReservationState(row["state"]).holds_budget:
                    continue
                held_risk += dec(row["risk_quote"])
                held_notional += dec(row["notional_quote"])
                held_count += 1

            if held_count + existing_positions >= max_concurrent:
                return False, (
                    f"position slots exhausted: {existing_positions} open + "
                    f"{held_count} pending >= {max_concurrent}"
                )
            if held_risk + risk_quote > risk_budget_remaining:
                return False, (
                    f"portfolio risk budget exhausted: held {held_risk} + "
                    f"requested {risk_quote} > available {risk_budget_remaining}"
                )
            if held_notional + notional_quote > notional_budget_remaining:
                return False, (
                    f"portfolio notional budget exhausted: held {held_notional} + "
                    f"requested {notional_quote} > available {notional_budget_remaining}"
                )

            conn.execute(
                "INSERT INTO reservations(intent_id, pair, amount_base, risk_quote, "
                "notional_quote, state, filled_base, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, '0', ?, ?)",
                (
                    intent_id,
                    pair,
                    str(amount_base),
                    str(risk_quote),
                    str(notional_quote),
                    ReservationState.PENDING.value,
                    now.isoformat(),
                    now.isoformat(),
                ),
            )
        return True, "reserved"

    def record_partial_fill(
        self, intent_id: str, filled_base: Decimal, now: datetime, *, complete: bool = False
    ) -> None:
        """Move the filled share of an intent from reservation into position.

        The unfilled remainder stays reserved. It is released only when the
        exchange has CONFIRMED the cancellation, never when a cancel request
        was merely sent.

        ``complete=True`` says the framework reports the entry order DONE:
        the reservation becomes FILLED even if the filled amount is one
        exchange step below what was reserved. Precision truncation on the
        order amount is not an unfilled remainder, and treating it as one
        left reservations PENDING forever (audit finding: after three such
        entries the bot refused every further entry for the life of the
        state file).
        """
        with self._tx() as conn:
            row = conn.execute(
                "SELECT * FROM reservations WHERE intent_id=?", (intent_id,)
            ).fetchone()
            if row is None:
                raise RiskStateError(f"unknown reservation {intent_id}")
            amount = dec(row["amount_base"])
            already = dec(row["filled_base"])
            new_filled = filled_base
            if new_filled < already:
                # Out-of-order or duplicated event: never move backwards.
                logger.warning(
                    "ignoring out-of-order fill for %s: %s < %s", intent_id, new_filled, already
                )
                return
            if new_filled > amount:
                raise RiskStateError(
                    f"fill {new_filled} exceeds reserved amount {amount} for {intent_id}"
                )
            state = (
                ReservationState.FILLED
                if new_filled >= amount or complete
                else ReservationState.PARTIALLY_FILLED
            )
            conn.execute(
                "UPDATE reservations SET filled_base=?, state=?, updated_at=? WHERE intent_id=?",
                (str(new_filled), state.value, now.isoformat(), intent_id),
            )
            if state is ReservationState.FILLED:
                conn.execute("DELETE FROM pending_entries WHERE intent_id=?", (intent_id,))

    def release(self, intent_id: str, reason: str, now: datetime) -> None:
        """Release an intent's remaining budget after a CONFIRMED resolution."""
        with self._tx() as conn:
            conn.execute(
                "UPDATE reservations SET state=?, updated_at=?, release_reason=? "
                "WHERE intent_id=?",
                (ReservationState.RELEASED.value, now.isoformat(), reason, intent_id),
            )
            conn.execute("DELETE FROM pending_entries WHERE intent_id=?", (intent_id,))

    # -- approved entries awaiting a fill -----------------------------------

    def put_pending_entry(
        self,
        *,
        intent_id: str,
        pair: str,
        amount_base: Decimal,
        entry_price: Decimal,
        stop_price: Decimal,
        atr: Decimal,
        now: datetime,
    ) -> None:
        """Persist an approved entry's stop BEFORE the order goes out.

        The strategy used to keep this in a process-level dict, so a restart
        between order send and fill lost the approved stop and the position
        ran on the -15% backstop. Durable here, keyed by pair as well as
        intent, it survives the restart and is found by ``order_filled``
        even when the intent stamp differs between callbacks.
        """
        with self._tx() as conn:
            conn.execute(
                "INSERT INTO pending_entries(intent_id, pair, amount_base, entry_price, "
                "stop_price, atr, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) "
                "ON CONFLICT(intent_id) DO UPDATE SET pair=excluded.pair, "
                "amount_base=excluded.amount_base, entry_price=excluded.entry_price, "
                "stop_price=excluded.stop_price, atr=excluded.atr, created_at=excluded.created_at",
                (
                    intent_id, pair, str(amount_base), str(entry_price), str(stop_price),
                    str(atr), now.isoformat(),
                ),
            )

    def get_pending_entry(self, pair: str) -> dict | None:
        """The newest approved-but-unfilled entry for a pair, or None."""
        row = self._conn.execute(
            "SELECT * FROM pending_entries WHERE pair=? ORDER BY created_at DESC LIMIT 1",
            (pair,),
        ).fetchone()
        return self._pending_row(row) if row else None

    def get_pending_entry_by_intent(self, intent_id: str) -> dict | None:
        row = self._conn.execute(
            "SELECT * FROM pending_entries WHERE intent_id=?", (intent_id,)
        ).fetchone()
        return self._pending_row(row) if row else None

    def pending_entries(self) -> list[dict]:
        rows = self._conn.execute(
            "SELECT * FROM pending_entries ORDER BY created_at"
        ).fetchall()
        return [self._pending_row(r) for r in rows]

    def delete_pending_entry(self, intent_id: str) -> None:
        with self._tx() as conn:
            conn.execute("DELETE FROM pending_entries WHERE intent_id=?", (intent_id,))

    @staticmethod
    def _pending_row(row: sqlite3.Row) -> dict:
        return {
            "intent_id": row["intent_id"],
            "pair": row["pair"],
            "amount": dec(row["amount_base"]),
            "entry_price": dec(row["entry_price"]),
            "stop_price": dec(row["stop_price"]),
            "atr": dec(row["atr"]),
            "created_at": datetime.fromisoformat(row["created_at"]),
        }

    def mark_unknown(self, intent_id: str, reason: str, now: datetime) -> None:
        """An order whose outcome could not be determined.

        Budget stays held. This is the deliberate conservative choice: an
        UNKNOWN order might be live on the exchange.
        """
        with self._tx() as conn:
            conn.execute(
                "UPDATE reservations SET state=?, updated_at=?, release_reason=? "
                "WHERE intent_id=?",
                (ReservationState.UNKNOWN.value, now.isoformat(), reason, intent_id),
            )
