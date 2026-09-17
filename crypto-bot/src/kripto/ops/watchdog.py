"""Read-only health monitoring.

The rule this module exists to enforce: **a running process is not a running
bot.** A loop can hang inside a network call, a data feed can go quiet, the
clock can drift, the disk can fill - and through all of it the process stays
up and a naive "is it alive" check stays green.

So none of the checks below look at the process. They look at evidence the
bot leaves behind while doing its work, and at how old that evidence is.

The same check functions serve two callers:

* **in-process**, so the bot can pause its own entries when it notices it is
  unhealthy, and
* **out-of-process**, where a separate observer opens the state file
  read-only and alerts a human - because the failure that matters most is
  the one where the bot itself is the broken thing.

The observer is never a second order writer and never holds a key. It cannot
write: its SQLite connection is opened in read-only mode.

A watchdog on the same host cannot report that the host died. That is a real
limitation, not a solved problem, and docs/RUNBOOK.md carries the dead-man
heartbeat option rather than this module pretending to cover it.
"""

from __future__ import annotations

import logging
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from enum import Enum
from pathlib import Path

from ..money import to_float
from .health import (
    EXCHANGE_TIME,
    LAST_CANDLE_OPEN,
    LAST_ORDERBOOK_UPDATE,
    LAST_RECONCILE,
    LOOP_HEARTBEAT,
    NOTIFICATION_FAILING_SINCE,
    api_error_rate,
    free_disk_mb,
    open_readonly,
    read_signal,
)

logger = logging.getLogger(__name__)

TIMEFRAME_SECONDS = {
    "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
    "1h": 3600, "2h": 7200, "4h": 14400, "8h": 28800, "12h": 43200, "1d": 86400,
}


class Level(str, Enum):
    OK = "OK"
    WARN = "WARN"
    CRITICAL = "CRITICAL"


class Action(str, Enum):
    NONE = "NONE"
    HALT_ENTRIES = "HALT_ENTRIES"
    OPERATOR_REQUIRED = "OPERATOR_REQUIRED"


@dataclass(frozen=True)
class Check:
    name: str
    level: Level
    message: str
    action: Action = Action.NONE
    measured: str = ""

    @property
    def healthy(self) -> bool:
        return self.level is Level.OK


@dataclass
class HealthReport:
    checks: list[Check] = field(default_factory=list)
    observed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def level(self) -> Level:
        if any(c.level is Level.CRITICAL for c in self.checks):
            return Level.CRITICAL
        if any(c.level is Level.WARN for c in self.checks):
            return Level.WARN
        return Level.OK

    @property
    def action(self) -> Action:
        if any(c.action is Action.OPERATOR_REQUIRED for c in self.checks):
            return Action.OPERATOR_REQUIRED
        if any(c.action is Action.HALT_ENTRIES for c in self.checks):
            return Action.HALT_ENTRIES
        return Action.NONE

    @property
    def failures(self) -> list[Check]:
        return [c for c in self.checks if not c.healthy]

    def as_dict(self) -> dict:
        return {
            "observed_at": self.observed_at.isoformat(),
            "level": self.level.value,
            "action": self.action.value,
            "checks": [
                {
                    "name": c.name, "level": c.level.value, "message": c.message,
                    "action": c.action.value, "measured": c.measured,
                }
                for c in self.checks
            ],
        }


# --------------------------------------------------------------------------
# Candle timing - the check that is easy to get wrong
# --------------------------------------------------------------------------


def expected_last_completed_open(now: datetime, timeframe: str) -> datetime:
    """Open time of the most recent candle that has definitely CLOSED.

    At any instant one candle is still forming. The newest usable candle is
    therefore the one before it:

        forming_open = floor(now / period)
        last_closed  = forming_open - period

    This is why candle freshness cannot be a simple "older than N minutes"
    rule. Just after a boundary the newest closed 4h candle legitimately
    opened more than four hours ago, and a naive age threshold would fire on
    every single boundary.
    """
    period = TIMEFRAME_SECONDS.get(timeframe)
    if period is None:
        raise ValueError(f"unsupported timeframe: {timeframe!r}")
    epoch = int(now.timestamp())
    forming_open = epoch - (epoch % period)
    return datetime.fromtimestamp(forming_open - period, tz=timezone.utc)


def check_candle_freshness(
    *, last_candle_open: datetime | None, now: datetime, timeframe: str
) -> Check:
    expected = expected_last_completed_open(now, timeframe)
    if last_candle_open is None:
        return Check(
            "candle_freshness", Level.CRITICAL,
            "no candle data has ever been recorded",
            Action.HALT_ENTRIES,
        )

    missing = int((expected - last_candle_open).total_seconds() // TIMEFRAME_SECONDS[timeframe])
    measured = (
        f"have {last_candle_open.isoformat()}, expected {expected.isoformat()} "
        f"({missing} candle(s) behind)"
    )
    if missing <= 0:
        return Check("candle_freshness", Level.OK, "candle data is current", measured=measured)
    if missing == 1:
        return Check(
            "candle_freshness", Level.WARN,
            "one candle behind; the feed may be catching up",
            Action.NONE, measured,
        )
    return Check(
        "candle_freshness", Level.CRITICAL,
        f"{missing} candles behind - signals would be computed on stale data",
        Action.HALT_ENTRIES, measured,
    )


def check_orderbook_freshness(
    *, last_update: datetime | None, now: datetime, max_age_seconds: float
) -> Check:
    """Book staleness, on its own clock.

    Deliberately separate from candle freshness. A 4h candle is allowed to be
    hours old; a book snapshot is not. Sharing one threshold between them
    would mean either constant false alarms or a blind spot.
    """
    if last_update is None:
        return Check(
            "orderbook_freshness", Level.CRITICAL,
            "no order book snapshot has been taken; the liquidity gate has nothing to read",
            Action.HALT_ENTRIES,
        )
    age = (now - last_update).total_seconds()
    measured = f"{age:.0f}s old (limit {max_age_seconds:.0f}s)"
    if age <= max_age_seconds:
        return Check("orderbook_freshness", Level.OK, "book snapshot is current", measured=measured)
    return Check(
        "orderbook_freshness", Level.CRITICAL,
        "order book snapshot is stale; spread and depth gates cannot be trusted",
        Action.HALT_ENTRIES, measured,
    )


# --------------------------------------------------------------------------
# The rest of the checks
# --------------------------------------------------------------------------


def check_loop_heartbeat(
    *, last_beat: datetime | None, now: datetime, interval_seconds: float, tolerance: float
) -> Check:
    """Is the trading loop still going round?

    This is the check that catches the case a process-liveness probe cannot:
    the process is up, the port answers, the container is healthy - and the
    loop has been stuck inside one call for an hour.
    """
    if last_beat is None:
        return Check(
            "loop_heartbeat", Level.CRITICAL,
            "the loop has never completed an iteration",
            Action.HALT_ENTRIES,
        )
    age = (now - last_beat).total_seconds()
    limit = interval_seconds * tolerance
    measured = f"{age:.0f}s since the last completed loop (limit {limit:.0f}s)"
    if age <= interval_seconds:
        return Check("loop_heartbeat", Level.OK, "loop is running", measured=measured)
    if age <= limit:
        return Check(
            "loop_heartbeat", Level.WARN, "loop is slower than its interval",
            Action.NONE, measured,
        )
    return Check(
        "loop_heartbeat", Level.CRITICAL,
        "the loop has stopped completing iterations. The process may still be "
        "alive; that is not the same thing. With no exchange-side stop, an open "
        "position is currently unmanaged.",
        Action.OPERATOR_REQUIRED, measured,
    )


def check_reconcile_age(
    *, last_reconcile: datetime | None, now: datetime, max_age_seconds: float
) -> Check:
    if last_reconcile is None:
        return Check(
            "reconcile_age", Level.CRITICAL,
            "no successful reconciliation has ever been recorded",
            Action.HALT_ENTRIES,
        )
    age = (now - last_reconcile).total_seconds()
    measured = f"{age:.0f}s since the last reconciliation (limit {max_age_seconds:.0f}s)"
    if age <= max_age_seconds:
        return Check("reconcile_age", Level.OK, "records agree with the venue", measured=measured)
    return Check(
        "reconcile_age", Level.CRITICAL,
        "records have not been reconciled with the venue recently",
        Action.HALT_ENTRIES, measured,
    )


def check_clock_skew(
    *,
    exchange_time: datetime | None,
    sampled_at: datetime | None,
    now: datetime,
    max_skew_seconds: float,
    max_sample_age_seconds: float = 3600.0,
) -> Check:
    """Compare the two clocks AT THE MOMENT THE SAMPLE WAS TAKEN.

    The subtle bug this signature prevents: comparing a stored exchange
    timestamp against the CURRENT local time measures how old the sample is,
    not how far the clocks are apart. A ten-minute-old sample then looks like
    a ten-minute skew and halts trading for no reason. (Observed: a real
    0.1s skew reported as 93s.)

    Sample age is a separate question, handled separately.
    """
    if exchange_time is None or sampled_at is None:
        return Check(
            "clock_skew", Level.WARN,
            "exchange time has not been sampled; skew is unknown",
            Action.NONE,
        )

    sample_age = (now - sampled_at).total_seconds()
    skew = abs((sampled_at - exchange_time).total_seconds())
    measured = (
        f"{skew:.1f}s skew (limit {max_skew_seconds:.1f}s), "
        f"sample {sample_age:.0f}s old"
    )

    if sample_age > max_sample_age_seconds:
        return Check(
            "clock_skew", Level.WARN,
            "the clock comparison is too old to rely on; skew is effectively unknown",
            Action.NONE, measured,
        )
    if skew <= max_skew_seconds:
        return Check("clock_skew", Level.OK, "clocks agree", measured=measured)
    return Check(
        "clock_skew", Level.CRITICAL,
        "local and exchange clocks disagree; candle boundaries and order "
        "timestamps cannot be trusted",
        Action.HALT_ENTRIES, measured,
    )


def check_api_errors(
    *, rate: float, sample_size: int, max_rate: float, min_sample: int = 10
) -> Check:
    measured = f"{rate:.0%} of {sample_size} call(s) failed (limit {max_rate:.0%})"
    if sample_size < min_sample:
        return Check(
            "api_error_rate", Level.OK,
            f"too few calls to judge ({sample_size} < {min_sample})",
            measured=measured,
        )
    if rate <= max_rate:
        return Check("api_error_rate", Level.OK, "API is responding normally", measured=measured)
    return Check(
        "api_error_rate", Level.CRITICAL,
        "the exchange API is failing too often to act on its answers",
        Action.HALT_ENTRIES, measured,
    )


def check_pending_orders(
    *, oldest_pending: datetime | None, now: datetime, max_age_seconds: float, count: int = 0
) -> Check:
    if oldest_pending is None:
        return Check("pending_orders", Level.OK, "no pending orders", measured="0 pending")
    age = (now - oldest_pending).total_seconds()
    measured = f"{count} pending, oldest {age:.0f}s (limit {max_age_seconds:.0f}s)"
    if age <= max_age_seconds:
        return Check("pending_orders", Level.OK, "pending orders are within age", measured=measured)
    return Check(
        "pending_orders", Level.WARN,
        "an order has been pending longer than expected; it may be unresolved",
        Action.NONE, measured,
    )


def check_storage(*, free_mb: float, min_free_mb: float, db_readable: bool) -> Check:
    measured = f"{free_mb:.0f}MB free (minimum {min_free_mb:.0f}MB)"
    if not db_readable:
        return Check(
            "storage", Level.CRITICAL,
            "the state database could not be read; nothing it reports can be trusted",
            Action.OPERATOR_REQUIRED, measured,
        )
    if free_mb < min_free_mb:
        return Check(
            "storage", Level.CRITICAL,
            "not enough free disk to guarantee a durable write; new entries must stop "
            "before the ledger becomes unreliable",
            Action.HALT_ENTRIES, measured,
        )
    return Check("storage", Level.OK, "storage is healthy", measured=measured)


def check_notifications(
    *, failing_since: datetime | None, now: datetime, halt_after_seconds: float
) -> Check:
    """Notification health NEVER blocks trading; it only reports.

    A broken Telegram connection must not stop stop-loss management. What a
    long outage does mean is that nobody is watching, which is its own risk -
    hence a halt on ENTRIES only, after a configured period.
    """
    if failing_since is None:
        return Check("notifications", Level.OK, "notifications are working", measured="ok")
    outage = (now - failing_since).total_seconds()
    measured = f"failing for {outage:.0f}s (entry halt after {halt_after_seconds:.0f}s)"
    if outage < halt_after_seconds:
        return Check(
            "notifications", Level.WARN,
            "notifications are failing; trading is unaffected",
            Action.NONE, measured,
        )
    return Check(
        "notifications", Level.CRITICAL,
        "notifications have been failing long enough that nobody would see a "
        "problem; entries stop, exits continue",
        Action.HALT_ENTRIES, measured,
    )


# --------------------------------------------------------------------------
# Runner
# --------------------------------------------------------------------------


class Watchdog:
    """Runs every check against a state file it cannot write to."""

    def __init__(self, state_path: str | Path, policy, *, timeframe: str = "4h"):
        self.state_path = Path(state_path)
        self.policy = policy
        self.timeframe = timeframe

    def _signal_time(self, conn, name: str) -> datetime | None:
        signal = read_signal(conn, name)
        return signal.observed_at if signal else None

    def run(self, now: datetime | None = None) -> HealthReport:
        now = now or datetime.now(timezone.utc)
        ops = self.policy.operations
        report = HealthReport(observed_at=now)

        try:
            conn = open_readonly(self.state_path)
        except sqlite3.Error as exc:
            report.checks.append(
                check_storage(
                    free_mb=free_disk_mb(self.state_path),
                    min_free_mb=to_float(ops["min_free_disk_mb"]),
                    db_readable=False,
                )
            )
            report.checks.append(
                Check("state_file", Level.CRITICAL, f"cannot open state: {exc}",
                      Action.OPERATOR_REQUIRED)
            )
            return report

        try:
            report.checks.append(
                check_loop_heartbeat(
                    last_beat=self._signal_time(conn, LOOP_HEARTBEAT),
                    now=now,
                    interval_seconds=to_float(ops["heartbeat_interval_seconds"]),
                    tolerance=to_float(ops["heartbeat_miss_tolerance"]),
                )
            )

            candle_signal = read_signal(conn, LAST_CANDLE_OPEN)
            last_open = (
                datetime.fromisoformat(candle_signal.value)
                if candle_signal and candle_signal.value
                else None
            )
            report.checks.append(
                check_candle_freshness(
                    last_candle_open=last_open, now=now, timeframe=self.timeframe
                )
            )
            report.checks.append(
                check_orderbook_freshness(
                    last_update=self._signal_time(conn, LAST_ORDERBOOK_UPDATE),
                    now=now,
                    max_age_seconds=to_float(ops["max_orderbook_age_seconds"]),
                )
            )
            report.checks.append(
                check_reconcile_age(
                    last_reconcile=self._signal_time(conn, LAST_RECONCILE),
                    now=now,
                    max_age_seconds=to_float(ops["max_reconcile_age_seconds"]),
                )
            )

            exchange_signal = read_signal(conn, EXCHANGE_TIME)
            exchange_time = (
                datetime.fromisoformat(exchange_signal.value)
                if exchange_signal and exchange_signal.value
                else None
            )
            report.checks.append(
                check_clock_skew(
                    exchange_time=exchange_time,
                    sampled_at=exchange_signal.observed_at if exchange_signal else None,
                    now=now,
                    max_skew_seconds=to_float(ops["max_clock_skew_seconds"]),
                    max_sample_age_seconds=to_float(ops["max_reconcile_age_seconds"]) * 4,
                )
            )

            rate, sample = api_error_rate(
                conn, now, to_float(ops["api_error_window_seconds"])
            )
            report.checks.append(
                check_api_errors(
                    rate=rate, sample_size=sample, max_rate=to_float(ops["max_api_error_rate"])
                )
            )

            oldest, count = self._oldest_pending(conn)
            report.checks.append(
                check_pending_orders(
                    oldest_pending=oldest, now=now,
                    max_age_seconds=to_float(ops["max_pending_order_age_seconds"]),
                    count=count,
                )
            )

            report.checks.append(
                check_storage(
                    free_mb=free_disk_mb(self.state_path),
                    min_free_mb=to_float(ops["min_free_disk_mb"]),
                    db_readable=True,
                )
            )
            report.checks.append(
                check_notifications(
                    failing_since=self._signal_time(conn, NOTIFICATION_FAILING_SINCE),
                    now=now,
                    halt_after_seconds=to_float(ops["notification_outage_entry_halt_seconds"]),
                )
            )
        finally:
            conn.close()

        return report

    @staticmethod
    def _oldest_pending(conn) -> tuple[datetime | None, int]:
        try:
            rows = conn.execute(
                "SELECT created_at FROM orders WHERE state IN "
                "('SUBMITTED','ACCEPTED','PARTIALLY_FILLED','CANCEL_REQUESTED','UNKNOWN') "
                "ORDER BY created_at"
            ).fetchall()
        except sqlite3.Error:
            return None, 0
        if not rows:
            return None, 0
        return datetime.fromisoformat(rows[0]["created_at"]), len(rows)
