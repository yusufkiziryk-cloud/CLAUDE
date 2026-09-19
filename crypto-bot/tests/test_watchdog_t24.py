"""T24 - no Telegram, a notification outage, and a process that is alive
while its loop is frozen.

The central claim under test: liveness of the PROCESS proves nothing. Every
check here is built to fail on a bot that is technically running and
practically dead.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone

import pytest

from kripto.money import dec
from kripto.ops.health import (
    EXCHANGE_TIME,
    LAST_CANDLE_OPEN,
    LAST_ORDERBOOK_UPDATE,
    LAST_RECONCILE,
    HealthRecorder,
    api_error_rate,
    open_readonly,
)
from kripto.ops.notifier import Notifier, format_health
from kripto.ops.watchdog import (
    Action,
    Level,
    Watchdog,
    check_api_errors,
    check_candle_freshness,
    check_clock_skew,
    check_loop_heartbeat,
    check_notifications,
    check_orderbook_freshness,
    check_reconcile_age,
    check_storage,
    expected_last_completed_open,
)
from kripto.policy import load_policy
from kripto.risk.state import BotState, RiskStore

NOW = datetime(2026, 9, 17, 12, 30, tzinfo=timezone.utc)


@pytest.fixture
def policy():
    return load_policy("config/policy.yaml")


@pytest.fixture
def state(tmp_path):
    path = tmp_path / "risk_state.sqlite"
    store = RiskStore(path)
    store.set_state(BotState.READY, "test", NOW)
    recorder = HealthRecorder(store)
    yield store, recorder, path
    store.close()


def make_healthy(recorder, now=NOW, timeframe="4h"):
    """Write the signals a healthy bot would have just written."""
    recorder.heartbeat(now)
    recorder.record(
        LAST_CANDLE_OPEN, now, value=expected_last_completed_open(now, timeframe).isoformat()
    )
    recorder.record(LAST_ORDERBOOK_UPDATE, now)
    recorder.record(LAST_RECONCILE, now)
    recorder.record(EXCHANGE_TIME, now, value=now.isoformat())
    for _ in range(20):
        recorder.record_api_call(now, ok=True)


# --------------------------------------------------------------------------
# The headline case: alive but frozen
# --------------------------------------------------------------------------


def test_t24_a_healthy_bot_reports_ok(state, policy):
    store, recorder, path = state
    make_healthy(recorder)

    report = Watchdog(path, policy).run(now=NOW)

    assert report.level is Level.OK, [c.message for c in report.failures]
    assert report.action is Action.NONE


def test_t24_process_alive_but_loop_frozen_is_detected(state, policy):
    """The process is up and the database is being read fine. The loop simply
    stopped going round twenty minutes ago."""
    store, recorder, path = state
    make_healthy(recorder)
    frozen_for = timedelta(minutes=20)

    report = Watchdog(path, policy).run(now=NOW + frozen_for)

    heartbeat = next(c for c in report.checks if c.name == "loop_heartbeat")
    assert heartbeat.level is Level.CRITICAL
    assert heartbeat.action is Action.OPERATOR_REQUIRED
    assert report.level is Level.CRITICAL


def test_t24_the_frozen_loop_message_names_the_real_danger(state, policy):
    store, recorder, path = state
    make_healthy(recorder)

    report = Watchdog(path, policy).run(now=NOW + timedelta(minutes=20))
    heartbeat = next(c for c in report.checks if c.name == "loop_heartbeat")

    # With no exchange-side stop, a frozen loop means an unmanaged position.
    assert "not the same thing" in heartbeat.message
    assert "unmanaged" in heartbeat.message


def test_t24_a_never_started_loop_is_critical(state, policy):
    store, recorder, path = state
    # No heartbeat has ever been written.
    report = Watchdog(path, policy).run(now=NOW)

    heartbeat = next(c for c in report.checks if c.name == "loop_heartbeat")
    assert heartbeat.level is Level.CRITICAL


def test_t24_heartbeat_tolerance_allows_a_slow_loop_without_alarming():
    beat = NOW - timedelta(seconds=90)

    check = check_loop_heartbeat(
        last_beat=beat, now=NOW, interval_seconds=60, tolerance=5
    )

    assert check.level is Level.WARN
    assert check.action is Action.NONE


# --------------------------------------------------------------------------
# Candle age vs book staleness - two different clocks
# --------------------------------------------------------------------------


@pytest.mark.parametrize("minutes_past_boundary", [1, 60, 120, 239])
def test_t24_a_naturally_old_4h_candle_is_not_an_alarm(minutes_past_boundary):
    """A completed 4h candle is legitimately 4-8 hours old. A naive age
    threshold would fire at every boundary; this must not."""
    now = datetime(2026, 9, 17, 4, 0, tzinfo=timezone.utc) + timedelta(
        minutes=minutes_past_boundary
    )
    last_open = expected_last_completed_open(now, "4h")

    check = check_candle_freshness(last_candle_open=last_open, now=now, timeframe="4h")

    age_hours = (now - last_open).total_seconds() / 3600
    assert 4.0 <= age_hours < 8.1, f"test setup wrong: {age_hours}h"
    assert check.level is Level.OK, f"false alarm at {age_hours:.1f}h candle age"


def test_t24_one_missed_candle_warns_but_does_not_halt():
    now = datetime(2026, 9, 17, 12, 30, tzinfo=timezone.utc)
    behind = expected_last_completed_open(now, "4h") - timedelta(hours=4)

    check = check_candle_freshness(last_candle_open=behind, now=now, timeframe="4h")

    assert check.level is Level.WARN
    assert check.action is Action.NONE


def test_t24_several_missed_candles_halt_entries():
    now = datetime(2026, 9, 17, 12, 30, tzinfo=timezone.utc)
    behind = expected_last_completed_open(now, "4h") - timedelta(hours=12)

    check = check_candle_freshness(last_candle_open=behind, now=now, timeframe="4h")

    assert check.level is Level.CRITICAL
    assert check.action is Action.HALT_ENTRIES
    assert "3 candles behind" in check.message


def test_t24_a_stale_order_book_is_critical_even_when_candles_are_fine(state, policy):
    """The trap: candle data is perfectly current, so a single "data age"
    check would report healthy while the liquidity gate reads a book from
    twenty minutes ago."""
    store, recorder, path = state
    make_healthy(recorder)
    later = NOW + timedelta(minutes=20)
    recorder.heartbeat(later)
    recorder.record(
        LAST_CANDLE_OPEN, later, value=expected_last_completed_open(later, "4h").isoformat()
    )
    recorder.record(LAST_RECONCILE, later)
    recorder.record(EXCHANGE_TIME, later, value=later.isoformat())
    # LAST_ORDERBOOK_UPDATE deliberately left at NOW.

    report = Watchdog(path, policy).run(now=later)

    assert next(c for c in report.checks if c.name == "candle_freshness").level is Level.OK
    book = next(c for c in report.checks if c.name == "orderbook_freshness")
    assert book.level is Level.CRITICAL
    assert book.action is Action.HALT_ENTRIES


def test_t24_book_and_candle_thresholds_are_independent():
    now = NOW
    # 90 seconds is fine for a candle, far too old for a book.
    assert check_orderbook_freshness(
        last_update=now - timedelta(seconds=90), now=now, max_age_seconds=60
    ).level is Level.CRITICAL
    assert check_candle_freshness(
        last_candle_open=expected_last_completed_open(now, "4h"), now=now, timeframe="4h"
    ).level is Level.OK


# --------------------------------------------------------------------------
# The remaining checks
# --------------------------------------------------------------------------


def test_t24_clock_skew_is_detected():
    assert check_clock_skew(
        exchange_time=NOW - timedelta(seconds=30), sampled_at=NOW, now=NOW, max_skew_seconds=5
    ).level is Level.CRITICAL
    assert check_clock_skew(
        exchange_time=NOW - timedelta(seconds=2), sampled_at=NOW, now=NOW, max_skew_seconds=5
    ).level is Level.OK


def test_t24_sample_age_is_not_mistaken_for_clock_skew():
    """Regression: an end-to-end run reported a real 0.1s skew as 93s,
    because the stored exchange timestamp was compared against the CURRENT
    local time instead of the local time when the sample was taken. That
    turns every slightly stale sample into a trading halt."""
    sampled_at = NOW
    exchange_time = NOW - timedelta(seconds=0.1)  # clocks essentially agree
    much_later = NOW + timedelta(seconds=93)

    check = check_clock_skew(
        exchange_time=exchange_time, sampled_at=sampled_at, now=much_later, max_skew_seconds=5
    )

    assert check.level is Level.OK, f"sample age leaked into the skew: {check.measured}"
    assert "93s old" in check.measured, "sample age should still be reported, just not as skew"


def test_t24_a_very_old_clock_sample_is_treated_as_unknown_not_as_agreement():
    check = check_clock_skew(
        exchange_time=NOW, sampled_at=NOW, now=NOW + timedelta(days=1),
        max_skew_seconds=5, max_sample_age_seconds=3600,
    )

    assert check.level is Level.WARN
    assert check.action is Action.NONE
    assert "too old" in check.message


def test_t24_unknown_exchange_time_warns_rather_than_claiming_health():
    check = check_clock_skew(
        exchange_time=None, sampled_at=None, now=NOW, max_skew_seconds=5
    )

    assert check.level is Level.WARN
    assert "unknown" in check.message


def test_t24_stale_reconciliation_halts_entries():
    assert check_reconcile_age(
        last_reconcile=NOW - timedelta(hours=2), now=NOW, max_age_seconds=900
    ).action is Action.HALT_ENTRIES


def test_t24_api_error_rate_needs_a_sample_before_it_alarms():
    """Two failures right after a restart are not an outage."""
    quiet = check_api_errors(rate=1.0, sample_size=2, max_rate=0.25)
    loud = check_api_errors(rate=0.5, sample_size=100, max_rate=0.25)

    assert quiet.level is Level.OK
    assert loud.level is Level.CRITICAL
    assert loud.action is Action.HALT_ENTRIES


def test_t24_api_error_rate_is_measured_over_a_window(state):
    store, recorder, path = state
    old = NOW - timedelta(hours=1)
    for _ in range(50):
        recorder.record_api_call(old, ok=False)   # long ago, outside the window
    for _ in range(20):
        recorder.record_api_call(NOW, ok=True)

    rate, sample = api_error_rate(store._conn, NOW, window_seconds=300)

    assert sample == 20
    assert rate == 0.0


def test_t24_low_disk_halts_entries():
    check = check_storage(free_mb=10, min_free_mb=200, db_readable=True)

    assert check.level is Level.CRITICAL
    assert check.action is Action.HALT_ENTRIES
    assert "durable write" in check.message


def test_t24_unreadable_database_requires_an_operator():
    check = check_storage(free_mb=5000, min_free_mb=200, db_readable=False)

    assert check.action is Action.OPERATOR_REQUIRED


def test_t24_a_missing_state_file_is_reported_not_crashed(tmp_path, policy):
    report = Watchdog(tmp_path / "does-not-exist.sqlite", policy).run(now=NOW)

    assert report.level is Level.CRITICAL
    assert report.action is Action.OPERATOR_REQUIRED


# --------------------------------------------------------------------------
# The observer must be incapable of writing
# --------------------------------------------------------------------------


def test_t24_the_watchdog_connection_cannot_write(state):
    """Read-only by construction, not by convention."""
    store, recorder, path = state
    make_healthy(recorder)
    conn = open_readonly(path)

    with pytest.raises(sqlite3.OperationalError):
        conn.execute("UPDATE bot_state SET state='READY' WHERE id=1")
    with pytest.raises(sqlite3.OperationalError):
        conn.execute(
            "INSERT INTO health_signals(name, value, observed_at) VALUES ('x','y','z')"
        )
    conn.close()


def test_t24_running_the_watchdog_does_not_modify_the_state(state, policy):
    """Compared on CONTENT through a fresh connection, not on the main file's
    bytes: under WAL a committed write lands in the -wal file and leaves the
    main file byte-identical, so the old byte comparison could not see a
    writing watchdog at all (audit finding)."""
    store, recorder, path = state
    make_healthy(recorder)

    def dump() -> str:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        try:
            return "\n".join(conn.iterdump())
        finally:
            conn.close()

    wal = path.with_name(path.name + "-wal")
    before = dump()
    wal_before = wal.stat().st_size if wal.exists() else 0

    Watchdog(path, policy).run(now=NOW)

    assert dump() == before
    assert (wal.stat().st_size if wal.exists() else 0) == wal_before


def test_t24_the_content_comparison_would_catch_a_writing_observer(state, policy):
    """The guard above must be able to fail: a write through another
    connection changes the dump even though the main file is unchanged."""
    store, recorder, path = state
    make_healthy(recorder)

    def dump() -> str:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        try:
            return "\n".join(conn.iterdump())
        finally:
            conn.close()

    before_bytes = path.read_bytes()
    before = dump()
    store.set_state(BotState.STOPPED, "a writing observer", NOW)
    assert path.read_bytes() == before_bytes, "WAL keeps the main file unchanged - the old check was blind"
    assert dump() != before


# --------------------------------------------------------------------------
# Notifications: optional, bounded, and never in the way
# --------------------------------------------------------------------------


def test_t24_no_transport_means_notifications_are_simply_off():
    notifier = Notifier(transport=None)

    assert notifier.enabled is False
    assert notifier.send("anything", NOW) is False
    assert notifier.failed == 0


def test_t24_a_failing_transport_never_raises():
    def dead(_text):
        raise ConnectionError("telegram unreachable")

    notifier = Notifier(transport=dead)

    assert notifier.send("alert", NOW) is False
    assert notifier.failed == 1


def test_t24_a_transport_that_hangs_up_repeatedly_does_not_grow_without_bound():
    def dead(_text):
        raise TimeoutError("no route")

    notifier = Notifier(transport=dead, max_queue=10)
    for i in range(200):
        notifier.send(f"message {i}", NOW)

    assert len(notifier.queue) <= 10
    assert notifier.dropped > 0


def test_t24_messages_are_redacted_before_delivery():
    sent = []
    notifier = Notifier(transport=sent.append)
    secret = "0x" + "ab" * 32

    notifier.send(f"submitting with privateKey={secret}", NOW)

    assert secret not in sent[0]


def test_t24_notification_outage_is_recorded_as_a_health_signal(state):
    store, recorder, path = state

    def dead(_text):
        raise ConnectionError("down")

    notifier = Notifier(transport=dead, recorder=recorder)
    notifier.send("alert", NOW)

    from kripto.ops.health import NOTIFICATION_FAILING_SINCE, read_signal

    assert read_signal(store._conn, NOTIFICATION_FAILING_SINCE) is not None


def test_t24_a_short_notification_outage_does_not_stop_trading():
    check = check_notifications(
        failing_since=NOW - timedelta(minutes=5), now=NOW, halt_after_seconds=3600
    )

    assert check.level is Level.WARN
    assert check.action is Action.NONE
    assert "trading is unaffected" in check.message


def test_t24_a_long_notification_outage_halts_entries_but_not_exits():
    check = check_notifications(
        failing_since=NOW - timedelta(hours=2), now=NOW, halt_after_seconds=3600
    )

    assert check.action is Action.HALT_ENTRIES
    assert "exits continue" in check.message


def test_t24_recovery_clears_the_outage_signal(state):
    store, recorder, path = state
    recorder.record_notification_result(NOW, ok=False)
    recorder.record_notification_result(NOW + timedelta(minutes=1), ok=True)

    from kripto.ops.health import NOTIFICATION_FAILING_SINCE, read_signal

    assert read_signal(store._conn, NOTIFICATION_FAILING_SINCE) is None


def test_t24_health_message_names_the_mode(state, policy):
    store, recorder, path = state
    make_healthy(recorder)
    report = Watchdog(path, policy).run(now=NOW + timedelta(minutes=30))

    message = format_health(report, mode="dry-run", version="2026.8")

    assert message.startswith("[DRY-RUN]")
    assert "loop_heartbeat" in message


# --------------------------------------------------------------------------
# The watchdog must never be able to stop exits
# --------------------------------------------------------------------------


def test_t24_no_check_ever_recommends_stopping_exit_management(state, policy):
    """A monitoring system that can halt stop-loss management is a liability.
    The strongest action any check may recommend is halting ENTRIES or
    calling a human - never stopping the bot."""
    store, recorder, path = state
    report = Watchdog(path, policy).run(now=NOW + timedelta(days=1))

    for check in report.checks:
        assert check.action in (Action.NONE, Action.HALT_ENTRIES, Action.OPERATOR_REQUIRED)

    assert BotState.ENTRY_PAUSED.exits_managed
    assert BotState.RECOVERY_REQUIRED.exits_managed


# --------------------------------------------------------------------------
# A standing WARN must not become a permanent trading halt
# --------------------------------------------------------------------------


def test_t24_a_warn_with_no_action_does_not_recommend_halting(state, policy):
    """An unsampled clock is worth reporting and not worth stopping for.
    Keying recovery off the LEVEL rather than the ACTION would turn every
    minor observability gap into a silent, permanent halt."""
    store, recorder, path = state
    make_healthy(recorder)
    # Remove the exchange-time sample, leaving clock skew unknown.
    with store._tx() as conn:
        conn.execute("DELETE FROM health_signals WHERE name=?", (EXCHANGE_TIME,))

    report = Watchdog(path, policy).run(now=NOW)

    assert report.level is Level.WARN
    assert report.action is Action.NONE, (
        "a WARN that recommends no action must not be escalated into a halt"
    )


def test_t24_report_action_is_the_strongest_recommended_action(state, policy):
    store, recorder, path = state
    make_healthy(recorder)

    # Frozen loop => OPERATOR_REQUIRED, which must outrank any HALT_ENTRIES.
    report = Watchdog(path, policy).run(now=NOW + timedelta(hours=6))

    assert report.action is Action.OPERATOR_REQUIRED
