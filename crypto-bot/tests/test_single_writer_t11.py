"""T11 - a second bot instance must never become a second order writer."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from kripto.money import dec
from kripto.risk.state import BotState, RiskStore

NOW = datetime(2026, 9, 17, 12, 0, tzinfo=timezone.utc)


@pytest.fixture
def path(tmp_path):
    return tmp_path / "risk.sqlite"


def test_t11_second_instance_is_refused(path):
    first = RiskStore(path)
    second = RiskStore(path)

    assert first.acquire_writer_lock("bot-A", NOW)[0] is True
    acquired, message = second.acquire_writer_lock("bot-B", NOW)

    assert acquired is False
    assert "another instance holds the writer lock" in message
    assert "bot-A" in message
    first.close()
    second.close()


def test_t11_refusal_survives_a_reopen(path):
    first = RiskStore(path)
    first.acquire_writer_lock("bot-A", NOW)
    first.close()  # the holder's connection is gone, the lease is not

    second = RiskStore(path)
    acquired, _ = second.acquire_writer_lock("bot-B", NOW + timedelta(seconds=30))

    assert acquired is False, "a closed connection must not free a live lease"
    second.close()


def test_t11_the_holder_can_renew_its_own_lease(path):
    store = RiskStore(path)
    store.acquire_writer_lock("bot-A", NOW)

    again, message = store.acquire_writer_lock("bot-A", NOW + timedelta(seconds=60))

    assert again is True
    assert "renewed" in message
    store.close()


def test_t11_an_abandoned_lease_can_be_taken_over(path):
    """A crashed process must not lock the account out forever."""
    first = RiskStore(path)
    first.acquire_writer_lock("bot-A", NOW)
    first.close()

    second = RiskStore(path)
    acquired, _ = second.acquire_writer_lock(
        "bot-B", NOW + timedelta(seconds=400), lease_seconds=300
    )

    assert acquired is True
    assert second.writer_lock_holder()["owner"] == "bot-B"
    second.close()


def test_t11_heartbeat_keeps_the_lease_alive(path):
    holder = RiskStore(path)
    other = RiskStore(path)
    holder.acquire_writer_lock("bot-A", NOW)

    later = NOW + timedelta(seconds=280)
    assert holder.heartbeat_writer_lock("bot-A", later) is True

    # 400s after the original acquisition, but only 120s after the heartbeat.
    acquired, _ = other.acquire_writer_lock(
        "bot-B", later + timedelta(seconds=120), lease_seconds=300
    )
    assert acquired is False
    holder.close()
    other.close()


def test_t11_heartbeat_from_a_non_holder_fails(path):
    store = RiskStore(path)
    store.acquire_writer_lock("bot-A", NOW)

    assert store.heartbeat_writer_lock("bot-B", NOW) is False
    store.close()


def test_t11_releasing_frees_the_lock_for_the_next_instance(path):
    first = RiskStore(path)
    second = RiskStore(path)
    first.acquire_writer_lock("bot-A", NOW)

    first.release_writer_lock("bot-A")

    assert second.acquire_writer_lock("bot-B", NOW)[0] is True
    first.close()
    second.close()


def test_t11_a_non_holder_cannot_release_someone_elses_lock(path):
    store = RiskStore(path)
    store.acquire_writer_lock("bot-A", NOW)

    store.release_writer_lock("bot-B")

    assert store.writer_lock_holder()["owner"] == "bot-A"
    store.close()


def test_t11_the_refused_instance_cannot_reserve_budget(path):
    """The refusal has to have teeth: a blocked instance must not go on to
    spend the shared risk budget."""
    first = RiskStore(path)
    second = RiskStore(path)
    first.acquire_writer_lock("bot-A", NOW)
    acquired, message = second.acquire_writer_lock("bot-B", NOW)
    assert not acquired

    # This is what the strategy does on refusal.
    second.set_state(BotState.STOPPED, message, NOW)

    assert second.get_state() is BotState.STOPPED
    assert not second.get_state().entries_allowed
    first.close()
    second.close()


def test_t11_lock_records_who_and_where(path):
    """The refusal message must let an operator find the other process."""
    store = RiskStore(path)
    store.acquire_writer_lock("bot-A", NOW)

    holder = store.writer_lock_holder()

    assert holder["owner"] == "bot-A"
    assert holder["host"]
    assert holder["pid"] > 0
    store.close()
