"""T18 - the filesystem misbehaves: disk full, database locked, corrupt file.

The faults are injected, not reasoned about. Disk exhaustion is modelled two
ways: an ENOSPC raised from the exact syscalls the atomic writer relies on,
and SQLite's own "database or disk is full" produced by capping the page
count. Neither is a real full disk; both exercise the code paths a real one
would, and docs/TEST_MATRIX.md records that distinction.

The properties under test:

* a failed write never leaves a half-written file that later reads as data,
* a failed transaction never leaves a half-applied reservation,
* a lock held by another connection delays or refuses a writer but never
  blocks the read-only watchdog,
* a corrupt or truncated state file is refused, never silently recreated
  empty (an empty state file would forget every period loss and lock), and
* a corrupt backup snapshot fails verification instead of passing as a
  backup.
"""

from __future__ import annotations

import errno
import importlib.util
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import pandas as pd
import pytest

from kripto.data.store import atomic_write, read_candles
from kripto.money import dec
from kripto.ops.health import LOOP_HEARTBEAT, HealthRecorder, open_readonly, read_signal
from kripto.ops.watchdog import Action, Level, Watchdog
from kripto.policy import load_policy
from kripto.risk.state import BotState, RiskStore

ROOT = Path(__file__).resolve().parent.parent
NOW = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)
PAIR = "BTC/USDC"


def _enospc(*args, **kwargs):
    raise OSError(errno.ENOSPC, "No space left on device")


def candles(n: int, start_price: float = 100.0) -> pd.DataFrame:
    dates = pd.date_range("2026-01-01", periods=n, freq="4h", tz="UTC")
    return pd.DataFrame(
        {
            "date": dates,
            "open": [start_price + i for i in range(n)],
            "high": [start_price + i + 1 for i in range(n)],
            "low": [start_price + i - 1 for i in range(n)],
            "close": [start_price + i + 0.5 for i in range(n)],
            "volume": [1.0] * n,
        }
    )


@pytest.fixture
def policy():
    return load_policy(str(ROOT / "config" / "policy.yaml"))


def reserve(store, intent_id, now=NOW):
    return store.try_reserve(
        intent_id=intent_id, pair=PAIR, amount_base=dec("0.001"), risk_quote=dec("1"),
        notional_quote=dec("10"), risk_budget_remaining=dec("1000000"),
        notional_budget_remaining=dec("1000000"), max_concurrent=100000,
        existing_positions=0, now=now,
    )


# --------------------------------------------------------------------------
# Disk full during the atomic candle write
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "failing",
    ["to_feather", "fsync", "replace"],
)
def test_t18_enospc_during_a_write_leaves_the_old_file_intact(tmp_path, monkeypatch, failing):
    target = tmp_path / "BTC_USDC-4h.feather"
    old = candles(10)
    atomic_write(old, target)
    old_bytes = target.read_bytes()

    if failing == "to_feather":
        real = pd.DataFrame.to_feather

        def half_then_fail(self, path, *args, **kwargs):
            # A real ENOSPC arrives part-way through: bytes are on disk, the
            # file is not complete.
            Path(path).write_bytes(b"ARROW1\x00\x00partial")
            _enospc()

        monkeypatch.setattr(pd.DataFrame, "to_feather", half_then_fail)
        del real
    elif failing == "fsync":
        monkeypatch.setattr("kripto.data.store.os.fsync", _enospc)
    else:
        monkeypatch.setattr("kripto.data.store.os.replace", _enospc)

    with pytest.raises(OSError) as info:
        atomic_write(candles(20), target)
    assert info.value.errno == errno.ENOSPC

    assert target.read_bytes() == old_bytes, "the target must be the OLD complete file"
    assert read_candles(target).shape[0] == 10
    leftovers = [p for p in tmp_path.iterdir() if p.name != target.name]
    assert leftovers == [], f"temp file left behind: {leftovers}"


def test_t18_after_the_disk_recovers_the_write_converges(tmp_path, monkeypatch):
    target = tmp_path / "BTC_USDC-4h.feather"
    atomic_write(candles(10), target)
    monkeypatch.setattr("kripto.data.store.os.fsync", _enospc)
    with pytest.raises(OSError):
        atomic_write(candles(20), target)
    monkeypatch.undo()

    atomic_write(candles(20), target)
    assert read_candles(target).shape[0] == 20


def test_t18_enospc_on_a_first_write_leaves_no_file_at_all(tmp_path, monkeypatch):
    """No previous file: a failed write must not leave an empty or partial one."""
    target = tmp_path / "new" / "BTC_USDC-4h.feather"
    monkeypatch.setattr("kripto.data.store.os.fsync", _enospc)
    with pytest.raises(OSError):
        atomic_write(candles(5), target)
    assert not target.exists()
    assert read_candles(target) is None
    assert list(target.parent.iterdir()) == []


# --------------------------------------------------------------------------
# SQLite reports a full disk mid-transaction
# --------------------------------------------------------------------------


def _cap_pages(store: RiskStore, extra: int = 0) -> None:
    pages = store._conn.execute("PRAGMA page_count").fetchone()[0]
    store._conn.execute(f"PRAGMA max_page_count={pages + extra}")


def test_t18_a_full_database_rolls_the_reservation_back_completely(tmp_path):
    path = tmp_path / "risk_state.sqlite"
    store = RiskStore(path)
    store.set_state(BotState.READY, "test", NOW)
    _cap_pages(store, extra=1)

    successes = 0
    failure: sqlite3.OperationalError | None = None
    for n in range(2000):
        try:
            ok, _ = reserve(store, f"intent-{n:05d}-" + "x" * 400)
        except sqlite3.OperationalError as exc:
            failure = exc
            break
        assert ok
        successes += 1

    assert failure is not None, "the page cap never produced a full-disk error"
    assert "full" in str(failure)
    assert successes > 0

    # Nothing half-applied: exactly the committed rows, and a sound file.
    assert len(store.open_reservations()) == successes
    assert store._conn.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    # The connection is usable again: no dangling transaction.
    assert store._conn.in_transaction is False
    assert store.get_state() is BotState.READY
    store.close()

    # Durability: a fresh process sees the same committed rows, no more.
    reopened = RiskStore(path)
    assert len(reopened.open_reservations()) == successes
    reopened.close()


def test_t18_a_full_disk_stops_the_heartbeat_and_the_watchdog_notices(
    tmp_path, monkeypatch, policy
):
    """The end-to-end property: a loop that cannot persist evidence must look
    dead to the watchdog, not alive. The failure is injected at the store's
    transaction boundary, which is where SQLITE_FULL surfaces."""
    import sys

    sys.path.insert(0, str(ROOT / "user_data" / "strategies"))
    from BaselineTrend4h import BaselineTrend4h

    path = tmp_path / "risk_state.sqlite"
    store = RiskStore(path)
    store.set_state(BotState.READY, "test", NOW)
    strategy = BaselineTrend4h({"runmode": "dry_run", "stake_currency": "USDC", "timeframe": "4h"})
    strategy._store = store
    strategy._health = HealthRecorder(store)
    strategy.health.heartbeat(NOW)

    def full_disk():
        raise sqlite3.OperationalError("database or disk is full")

    monkeypatch.setattr(store, "_tx", full_disk)
    later = NOW + timedelta(hours=1)

    strategy.bot_loop_start(current_time=later)  # must not raise

    beat = read_signal(store._conn, LOOP_HEARTBEAT)
    assert beat.observed_at == NOW, "no heartbeat may be faked while writes fail"

    report = Watchdog(path, policy, timeframe="4h").run(now=later)
    heartbeat = next(c for c in report.checks if c.name == "loop_heartbeat")
    assert heartbeat.level is Level.CRITICAL
    assert heartbeat.action is Action.OPERATOR_REQUIRED
    store.close()


def test_t18_custom_stake_amount_returns_zero_when_the_disk_is_full(tmp_path, monkeypatch):
    """freqtrade would fall back to proposed_stake if this raised."""
    import sys

    sys.path.insert(0, str(ROOT / "user_data" / "strategies"))
    from BaselineTrend4h import BaselineTrend4h

    strategy = BaselineTrend4h({"runmode": "dry_run", "stake_currency": "USDC", "timeframe": "4h"})
    strategy._store = RiskStore(tmp_path / "risk_state.sqlite")

    class FullGate:
        def evaluate_entry(self, **kwargs):
            raise sqlite3.OperationalError("database or disk is full")

    strategy._gate = FullGate()
    monkeypatch.setattr(
        strategy, "_current_atr_and_stop", lambda pair, price, now: (dec("1"), dec("95"), now)
    )
    monkeypatch.setattr(
        strategy, "_market_limits",
        lambda pair: {"amount_step": dec("0.0001"), "min_amount": dec("0.0001"), "min_cost": dec("10")},
    )
    monkeypatch.setattr(strategy, "_gate_context", lambda pair, now: None)

    stake = strategy.custom_stake_amount(
        pair=PAIR, current_time=NOW, current_rate=100.0, proposed_stake=250.0,
        min_stake=10.0, max_stake=1000.0, leverage=1.0, entry_tag=None, side="long",
    )
    assert stake == 0.0
    strategy._store.close()


# --------------------------------------------------------------------------
# Database locked by another connection
# --------------------------------------------------------------------------


def test_t18_a_held_write_lock_refuses_the_second_writer_without_a_partial_row(tmp_path):
    path = tmp_path / "risk_state.sqlite"
    holder = RiskStore(path)
    holder.set_state(BotState.READY, "test", NOW)
    other = RiskStore(path)
    other._conn.execute("PRAGMA busy_timeout=200")

    holder._conn.execute("BEGIN IMMEDIATE")
    try:
        with pytest.raises(sqlite3.OperationalError, match="locked"):
            reserve(other, "blocked-intent")
    finally:
        holder._conn.execute("ROLLBACK")

    assert other._conn.in_transaction is False
    assert other.open_reservations() == []

    ok, _ = reserve(other, "blocked-intent")
    assert ok
    assert [r.intent_id for r in holder.open_reservations()] == ["blocked-intent"]
    holder.close()
    other.close()


def test_t18_a_held_write_lock_does_not_block_the_read_only_watchdog(tmp_path, policy):
    """WAL readers never wait on the writer. If they did, a stuck transaction
    would also blind the thing meant to detect it."""
    path = tmp_path / "risk_state.sqlite"
    store = RiskStore(path)
    store.set_state(BotState.READY, "test", NOW)
    HealthRecorder(store).heartbeat(NOW)

    store._conn.execute("BEGIN IMMEDIATE")
    store._conn.execute(
        "UPDATE health_signals SET observed_at=? WHERE name=?",
        ((NOW + timedelta(days=9)).isoformat(), LOOP_HEARTBEAT),
    )
    try:
        conn = open_readonly(path)
        started = datetime.now(timezone.utc)
        beat = read_signal(conn, LOOP_HEARTBEAT)
        elapsed = (datetime.now(timezone.utc) - started).total_seconds()
        conn.close()
        report = Watchdog(path, policy, timeframe="4h").run(now=NOW + timedelta(seconds=30))
    finally:
        store._conn.execute("ROLLBACK")

    assert elapsed < 1.0, "the read-only observer waited on a writer"
    # The reader sees committed state only - not the uncommitted future beat.
    assert beat.observed_at == NOW
    heartbeat = next(c for c in report.checks if c.name == "loop_heartbeat")
    assert heartbeat.level is Level.OK
    store.close()


# --------------------------------------------------------------------------
# Corrupt or truncated state file
# --------------------------------------------------------------------------


def test_t18_a_garbage_state_file_is_refused_and_left_untouched(tmp_path):
    path = tmp_path / "risk_state.sqlite"
    path.write_bytes(os.urandom(8192))
    before = path.read_bytes()

    with pytest.raises(sqlite3.DatabaseError):
        RiskStore(path)

    assert path.read_bytes() == before
    assert not path.with_name(path.name + "-wal").exists()


def test_t18_a_garbage_state_file_makes_the_watchdog_call_an_operator(tmp_path, policy):
    path = tmp_path / "risk_state.sqlite"
    path.write_bytes(os.urandom(8192))

    report = Watchdog(path, policy, timeframe="4h").run(now=NOW)

    assert report.level is Level.CRITICAL
    assert report.action is Action.OPERATOR_REQUIRED
    storage = next(c for c in report.checks if c.name == "storage")
    assert "could not be read" in storage.message


def test_t18_a_truncated_state_file_is_refused_not_opened_with_silent_loss(tmp_path):
    """Half a database can still open: page 1 is intact, the tail is gone.
    Opening it 'successfully' would mean trading on forgotten locks and
    period baselines. The store must check integrity at open and refuse."""
    path = tmp_path / "risk_state.sqlite"
    store = RiskStore(path)
    store.set_state(BotState.ENTRY_PAUSED, "a loss happened", NOW)
    for n in range(300):
        assert reserve(store, f"intent-{n:05d}-" + "y" * 300)[0]
    store._conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    store.close()

    size = path.stat().st_size
    assert size > 8192 * 4
    with open(path, "r+b") as fh:
        fh.truncate(size // 2)

    with pytest.raises(sqlite3.DatabaseError):
        RiskStore(path)


# --------------------------------------------------------------------------
# Corrupt backup snapshot
# --------------------------------------------------------------------------


@pytest.fixture
def backup_module():
    spec = importlib.util.spec_from_file_location("kripto_backup", ROOT / "scripts" / "backup.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _make_backup(backup_module, tmp_path) -> Path:
    state_dir = tmp_path / "state"
    state_dir.mkdir()
    store = RiskStore(state_dir / "risk_state.sqlite")
    store.set_state(BotState.READY, "test", NOW)
    for n in range(20):
        assert reserve(store, f"intent-{n}")[0]
    store.close()
    args = SimpleNamespace(out=tmp_path / "backups", state_dir=state_dir, config_dir=ROOT / "config")
    return backup_module.take_backup(args)


def test_t18_an_intact_backup_verifies(backup_module, tmp_path):
    out = _make_backup(backup_module, tmp_path)
    assert backup_module.verify_backup(out) is True


def test_t18_a_bit_flipped_snapshot_fails_verification(backup_module, tmp_path):
    out = _make_backup(backup_module, tmp_path)
    snapshot = out / "risk_state.sqlite"
    conn = sqlite3.connect(str(snapshot))
    page_size = conn.execute("PRAGMA page_size").fetchone()[0]
    root = conn.execute(
        "SELECT rootpage FROM sqlite_master WHERE name='reservations'"
    ).fetchone()[0]
    conn.close()
    data = bytearray(snapshot.read_bytes())
    start = (root - 1) * page_size + 64
    data[start : start + 64] = b"\xff" * 64  # inside real data, so the hash changes
    snapshot.write_bytes(bytes(data))

    assert backup_module.verify_backup(out) is False


def test_t18_a_snapshot_corrupted_before_hashing_still_fails_verification(
    backup_module, tmp_path
):
    """If the corruption happened before the manifest hash was taken, the hash
    matches and only a real restore + integrity_check can catch it."""
    import json

    out = _make_backup(backup_module, tmp_path)
    snapshot = out / "risk_state.sqlite"
    conn = sqlite3.connect(str(snapshot))
    page_size = conn.execute("PRAGMA page_size").fetchone()[0]
    root = conn.execute(
        "SELECT rootpage FROM sqlite_master WHERE name='reservations'"
    ).fetchone()[0]
    conn.close()
    data = bytearray(snapshot.read_bytes())
    # Wipe the reservations table's root page. Page 1 (the schema) stays
    # intact, so the file still opens and only a real check finds the hole.
    start = (root - 1) * page_size
    data[start : start + page_size] = b"\xff" * page_size
    snapshot.write_bytes(bytes(data))
    manifest_path = out / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["databases"]["risk_state.sqlite"]["hash"] = backup_module.file_hash(snapshot)
    manifest_path.write_text(json.dumps(manifest))

    assert backup_module.verify_backup(out) is False


def test_t18_a_truncated_snapshot_fails_verification(backup_module, tmp_path):
    import json

    out = _make_backup(backup_module, tmp_path)
    snapshot = out / "risk_state.sqlite"
    size = snapshot.stat().st_size
    with open(snapshot, "r+b") as fh:
        fh.truncate(size // 2)
    manifest_path = out / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["databases"]["risk_state.sqlite"]["hash"] = backup_module.file_hash(snapshot)
    manifest_path.write_text(json.dumps(manifest))

    assert backup_module.verify_backup(out) is False
