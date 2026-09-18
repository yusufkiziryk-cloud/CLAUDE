"""Backup that provably restores, and a heartbeat that stays quiet when the
bot is broken."""

from __future__ import annotations

import importlib.util
import json
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent


def _load(name: str):
    """Import a script from scripts/ as a module."""
    spec = importlib.util.spec_from_file_location(name, REPO / "scripts" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


backup = _load("backup")
deadman = _load("deadman")

from kripto.ops.health import (  # noqa: E402
    EXCHANGE_TIME,
    LAST_CANDLE_OPEN,
    LAST_ORDERBOOK_UPDATE,
    LAST_RECONCILE,
    HealthRecorder,
)
from kripto.ops.watchdog import Action, Level, expected_last_completed_open  # noqa: E402
from kripto.risk.state import BotState, RiskStore  # noqa: E402

NOW = datetime(2026, 9, 18, 12, 0, tzinfo=timezone.utc)


# --------------------------------------------------------------------------
# Backup
# --------------------------------------------------------------------------


@pytest.fixture
def state_dir(tmp_path):
    """A state directory with a populated, still-open risk database."""
    directory = tmp_path / "state"
    directory.mkdir()
    store = RiskStore(directory / "risk_state.sqlite")
    store.set_state(BotState.READY, "test", NOW)
    for n in range(5):
        store.record_entry_decision(
            now=NOW, pair="BTC/USDC", intent_id=f"i{n}", allowed=n == 0,
            code="ACCEPTED" if n == 0 else "ASSET_CAP_REACHED",
        )
    yield directory, store
    store.close()


def run_backup(state_dir, out, **kw):
    args = backup.parse_args(
        ["--state-dir", str(state_dir), "--out", str(out),
         "--config-dir", str(REPO / "config")] + list(kw.get("extra", []))
    )
    return backup.take_backup(args)


def test_backup_snapshots_a_database_that_is_still_open(state_dir, tmp_path):
    """Copying a live SQLite file byte-for-byte can catch a torn page; the
    backup API cannot."""
    directory, store = state_dir

    out = run_backup(directory, tmp_path / "backups")

    copied = out / "risk_state.sqlite"
    assert copied.is_file()
    conn = sqlite3.connect(f"file:{copied}?mode=ro", uri=True)
    assert conn.execute("SELECT COUNT(*) FROM entry_decisions").fetchone()[0] == 5
    conn.close()


def test_backup_verifies_by_actually_restoring(state_dir, tmp_path):
    directory, _ = state_dir
    out = run_backup(directory, tmp_path / "backups")

    assert backup.verify_backup(out) is True


def test_verification_fails_on_a_corrupted_backup(state_dir, tmp_path):
    """An unverified backup is a hope. Prove the check can actually fail."""
    directory, _ = state_dir
    out = run_backup(directory, tmp_path / "backups")

    target = out / "risk_state.sqlite"
    data = bytearray(target.read_bytes())
    data[4096:4196] = b"\x00" * 100  # scribble on a page
    target.write_bytes(bytes(data))

    assert backup.verify_backup(out) is False


def test_verification_fails_when_a_file_is_missing(state_dir, tmp_path):
    directory, _ = state_dir
    out = run_backup(directory, tmp_path / "backups")

    (out / "risk_state.sqlite").unlink()

    assert backup.verify_backup(out) is False


def test_manifest_records_row_counts_and_hashes(state_dir, tmp_path):
    directory, _ = state_dir
    out = run_backup(directory, tmp_path / "backups")

    manifest = json.loads((out / "manifest.json").read_text())
    entry = manifest["databases"]["risk_state.sqlite"]

    assert entry["status"] == "OK"
    assert entry["hash"].startswith("sha256:")
    assert entry["row_counts"]["entry_decisions"] == 5


def test_an_absent_database_is_reported_not_invented(tmp_path):
    empty = tmp_path / "empty"
    empty.mkdir()

    out = run_backup(empty, tmp_path / "backups")

    manifest = json.loads((out / "manifest.json").read_text())
    assert manifest["databases"]["risk_state.sqlite"]["status"] == "ABSENT"


def test_rotation_keeps_the_newest_and_drops_the_rest(state_dir, tmp_path):
    directory, _ = state_dir
    root = tmp_path / "backups"
    made = []
    for _ in range(4):
        made.append(run_backup(directory, root))
        # take_backup stamps to the second; force distinct names
        made[-1].rename(root / f"2026091{len(made)}T000000Z")

    backup.rotate(root, keep=2)

    remaining = sorted(p.name for p in root.iterdir() if p.is_dir())
    assert len(remaining) == 2
    assert remaining == sorted(remaining)[-2:]


# --------------------------------------------------------------------------
# Dead-man heartbeat
# --------------------------------------------------------------------------


@pytest.fixture
def healthy_state(tmp_path):
    path = tmp_path / "risk_state.sqlite"
    store = RiskStore(path)
    store.set_state(BotState.READY, "test", NOW)
    recorder = HealthRecorder(store)
    now = datetime.now(timezone.utc)
    recorder.heartbeat(now)
    recorder.record(LAST_CANDLE_OPEN, now,
                    value=expected_last_completed_open(now, "4h").isoformat())
    recorder.record(LAST_ORDERBOOK_UPDATE, now)
    recorder.record(LAST_RECONCILE, now)
    recorder.record(EXCHANGE_TIME, now, value=now.isoformat())
    for _ in range(20):
        recorder.record_api_call(now, ok=True)
    yield path, store, recorder
    store.close()


def health_report(path, now=None):
    from kripto.ops.watchdog import Watchdog
    from kripto.policy import load_policy

    return Watchdog(path, load_policy(REPO / "config" / "policy.yaml")).run(now=now)


def test_deadman_pings_while_the_bot_is_healthy(healthy_state):
    path, _, _ = healthy_state

    allowed, reason = deadman.should_ping(health_report(path))

    assert allowed is True
    assert "healthy" in reason


def test_deadman_withholds_the_ping_when_the_loop_is_frozen(healthy_state):
    """THE point of the whole thing. A heartbeat that fires on a timer would
    keep saying "alive" here; silence is what makes the service alert."""
    path, _, _ = healthy_state
    much_later = datetime.now(timezone.utc) + timedelta(hours=6)

    report = health_report(path, now=much_later)
    allowed, reason = deadman.should_ping(report)

    assert report.level is Level.CRITICAL
    assert allowed is False
    assert "loop_heartbeat" in reason


def test_deadman_withholds_whenever_health_recommends_any_action(healthy_state):
    """Not just CRITICAL: anything that says halt entries or call a human."""
    class FakeReport:
        level = Level.WARN
        action = Action.HALT_ENTRIES
        failures = []

    allowed, reason = deadman.should_ping(FakeReport())

    assert allowed is False
    assert "HALT_ENTRIES" in reason


def test_a_plain_warning_still_pings(healthy_state):
    """A warning is something to look at, not a reason to fire the alarm."""
    class FakeReport:
        level = Level.WARN
        action = Action.NONE
        failures = []

    allowed, _ = deadman.should_ping(FakeReport())

    assert allowed is True


def test_the_ping_url_is_never_printed_whole():
    url = "https://hc-ping.example/9f8e7d6c-secret-token-value"

    masked = deadman.mask(url)

    assert "secret-token-value" not in masked
    assert "9f8e7d6c" not in masked
    assert masked.startswith("https://hc-ping.example")


def test_a_plain_http_url_is_refused(healthy_state, monkeypatch, capsys):
    path, _, _ = healthy_state
    monkeypatch.setenv("KRIPTO_DEADMAN_URL", "http://insecure.example/ping")

    code = deadman.main(["--state", str(path)])

    assert code == deadman.EXIT_MISCONFIGURED
    assert "must be https" in capsys.readouterr().err


def test_a_missing_url_is_a_configuration_error_not_a_silent_no_op(healthy_state, monkeypatch, capsys):
    path, _, _ = healthy_state
    monkeypatch.delenv("KRIPTO_DEADMAN_URL", raising=False)

    code = deadman.main(["--state", str(path)])

    assert code == deadman.EXIT_MISCONFIGURED
    assert "no ping URL" in capsys.readouterr().err


def test_a_send_failure_is_distinguished_from_an_unhealthy_bot(healthy_state, monkeypatch, capsys):
    """"The bot is fine, the network is not" and "the bot is broken" must not
    look the same in the log."""
    path, _, _ = healthy_state
    monkeypatch.setattr(deadman, "ping", lambda url, timeout: (False, "TimeoutError: no route"))
    monkeypatch.setenv("KRIPTO_DEADMAN_URL", "https://hc-ping.example/token")

    code = deadman.main(["--state", str(path)])
    out = capsys.readouterr().out

    assert code == deadman.EXIT_WITHHELD
    assert "healthy but the ping FAILED" in out
    assert "check the network, not the bot" in out
    assert "token" not in out


# --------------------------------------------------------------------------
# The units themselves
# --------------------------------------------------------------------------


UNITS = sorted((REPO / "deploy").glob("*.service"))


def test_deployment_units_exist():
    names = {p.name for p in UNITS}
    assert {"kripto-bot.service", "kripto-watchdog.service",
            "kripto-deadman.service", "kripto-backup.service"} <= names


@pytest.mark.parametrize("unit", UNITS, ids=lambda p: p.name)
def test_no_unit_can_enable_live_trading(unit):
    text = unit.read_text()

    assert "dry_run" not in text.lower() or "dry-run" in text.lower()
    assert "--dry-run false" not in text
    assert "FREQTRADE__DRY_RUN" not in text


def test_the_bot_unit_starts_through_the_safe_launcher():
    text = (REPO / "deploy" / "kripto-bot.service").read_text()

    assert "scripts/safe-run.py" in text
    assert "freqtrade trade" not in text


@pytest.mark.parametrize("unit", UNITS, ids=lambda p: p.name)
def test_every_unit_is_hardened(unit):
    text = unit.read_text()

    assert "NoNewPrivileges=true" in text
    assert "User=" in text and "User=root" not in text
    assert "CapabilityBoundingSet=" in text


def test_the_watchdog_unit_cannot_write_to_the_repository():
    text = (REPO / "deploy" / "kripto-watchdog.service").read_text()

    assert "ReadOnlyPaths=/opt/kripto-bot" in text
    assert "ReadWritePaths" not in text


def test_the_deadman_unit_reads_its_url_from_outside_the_repository():
    text = (REPO / "deploy" / "kripto-deadman.service").read_text()

    assert "--url-file /etc/kripto/deadman.url" in text
    assert "KRIPTO_DEADMAN_URL=https" not in text, "a real URL must never be committed"
