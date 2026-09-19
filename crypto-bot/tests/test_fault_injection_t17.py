"""T17 - transport faults injected on the ORDER path and the DATA path.

The collector's retry loop was already covered by reasoning; this file
exercises it, and - the part that was genuinely missing - injects 429, 5xx,
disconnects and lost responses into order creation, cancellation and
resolution, then checks the one property that matters: a transport fault
never turns into a second order or a freed budget.

Everything here runs against the stateful fake venue or a fake HTTP session.
Passing is "verified against our model of the venue", not "verified on the
exchange" - docs/TEST_MATRIX.md keeps that distinction.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

import pytest
import requests

from fake_exchange import ExchangeRejected, FakeExchange, RateLimited
from kripto.data.hyperliquid_client import HyperliquidInfoClient, HyperliquidError
from kripto.money import dec
from kripto.orders.executor import OrderExecutor, Outcome
from kripto.orders.lifecycle import OrderLedger, OrderState
from kripto.risk.state import BotState, ReservationState, RiskStore

NOW = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)
PAIR = "BTC/USDC"


# --------------------------------------------------------------------------
# Transport exceptions with the names real adapters use. ccxt's hierarchy is
# NetworkError > {DDoSProtection > RateLimitExceeded, ExchangeNotAvailable,
# RequestTimeout}; the executor classifies by NAME, so these doubles carry
# the real names and nothing else.
# --------------------------------------------------------------------------


class RateLimitExceeded(Exception):
    """ccxt's 429."""


class ExchangeNotAvailable(Exception):
    """ccxt's 5xx / maintenance."""


class ConnectionError(Exception):  # noqa: A001 - deliberately shadows the builtin name
    """A socket that dropped mid-request."""


class FaultyVenue(FakeExchange):
    """FakeExchange plus a scripted fault for the NEXT call of each method.

    A fault is raised AFTER the venue has acted, when that is what the real
    failure looks like: a 5xx on create can still leave an order resting,
    and a dropped connection on cancel says nothing about whether the cancel
    landed. ``create_faults`` entries are (exception, order_exists_anyway).
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.create_faults: list[tuple[BaseException, bool]] = []
        self.cancel_faults: list[tuple[BaseException, bool]] = []
        self.fetch_faults: list[BaseException] = []
        self.lookup_faults: list[BaseException] = []

    def create_order(self, pair, side, amount, price, client_order_id=""):
        if self.create_faults:
            exc, exists_anyway = self.create_faults.pop(0)
            if exists_anyway:
                # The request reached the matching engine; only the reply died.
                # (super() records the call in call_log.)
                super().create_order(pair, side, amount, price, client_order_id)
            else:
                self.call_log.append(("create_order", client_order_id))
            raise exc
        return super().create_order(pair, side, amount, price, client_order_id)

    def cancel_order(self, order_id):
        if self.cancel_faults:
            exc, cancelled_anyway = self.cancel_faults.pop(0)
            self.call_log.append(("cancel_order", order_id))
            if cancelled_anyway and order_id in self.orders:
                self.orders[order_id].status = "canceled"
            raise exc
        return super().cancel_order(order_id)

    def fetch_order(self, order_id):
        if self.fetch_faults:
            raise self.fetch_faults.pop(0)
        return super().fetch_order(order_id)

    def find_by_client_order_id(self, client_order_id):
        if self.lookup_faults:
            raise self.lookup_faults.pop(0)
        return super().find_by_client_order_id(client_order_id)


@pytest.fixture
def store(tmp_path):
    s = RiskStore(tmp_path / "risk.sqlite")
    s.set_state(BotState.READY, "test", NOW)
    yield s
    s.close()


@pytest.fixture
def ledger(store):
    return OrderLedger(store)


@pytest.fixture
def venue():
    return FaultyVenue()


@pytest.fixture
def executor(ledger, venue):
    return OrderExecutor(ledger, venue)


def make_intent(ledger, intent_id="i1", amount="1", price="100", side="buy"):
    return ledger.record_intent(
        intent_id=intent_id, pair=PAIR, side=side, amount=dec(amount), price=dec(price),
        client_order_id=intent_id.replace("|", "-"), now=NOW,
    )


def reserve(store, intent_id="i1", amount="1", risk="10", notional="100"):
    ok, msg = store.try_reserve(
        intent_id=intent_id, pair=PAIR, amount_base=dec(amount), risk_quote=dec(risk),
        notional_quote=dec(notional), risk_budget_remaining=dec("30"),
        notional_budget_remaining=dec("750"), max_concurrent=3, existing_positions=0, now=NOW,
    )
    assert ok, msg


def submit(executor, intent_id="i1", amount="1", price="100", side="buy"):
    return executor.submit(
        intent_id=intent_id, pair=PAIR, side=side, amount=dec(amount), price=dec(price),
        client_order_id=intent_id.replace("|", "-"), now=NOW,
    )


# --------------------------------------------------------------------------
# Order creation under transport faults
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "fault, exists_anyway",
    [
        (RateLimitExceeded("429 Too Many Requests"), False),
        (ExchangeNotAvailable("503 Service Unavailable"), True),
        (ConnectionError("connection reset by peer"), True),
        (RateLimited("429"), False),
    ],
    ids=["429-not-placed", "503-but-placed", "disconnect-but-placed", "fake-429"],
)
def test_t17_a_transport_fault_on_create_is_unknown_not_failed(
    store, ledger, executor, venue, fault, exists_anyway
):
    """Whatever the transport says, the process does not know the outcome."""
    reserve(store)
    make_intent(ledger)
    venue.create_faults.append((fault, exists_anyway))

    result = submit(executor)

    assert result.outcome is Outcome.UNKNOWN
    assert result.needs_operator
    assert ledger.get("i1").state is OrderState.UNKNOWN
    # Budget is HELD, not freed: the order may be resting at the venue.
    assert store.get_reservation("i1").state is ReservationState.UNKNOWN
    assert store.reserved_risk() == dec("10")


@pytest.mark.parametrize(
    "fault",
    [RateLimitExceeded("429"), ExchangeNotAvailable("502"), ConnectionError("reset")],
)
def test_t17_an_unknown_order_is_never_resubmitted(store, ledger, executor, venue, fault):
    reserve(store)
    make_intent(ledger)
    venue.create_faults.append((fault, True))
    assert submit(executor).outcome is Outcome.UNKNOWN

    # A naive retry loop would call create again here. It must be refused.
    second = submit(executor)

    assert second.outcome is Outcome.BLOCKED
    assert "UNKNOWN" in second.detail
    creates = [c for c in venue.call_log if c[0] == "create_order"]
    assert len(creates) == 1, "the transport fault must not produce a second create"
    assert len(venue.orders) == 1


def test_t17_a_429_that_did_place_the_order_is_found_on_resolve(
    store, ledger, executor, venue
):
    """The honest case where 'unknown' hides a live order: resolution finds it."""
    reserve(store)
    make_intent(ledger)
    venue.create_faults.append((ExchangeNotAvailable("504 gateway timeout"), True))
    assert submit(executor).outcome is Outcome.UNKNOWN

    resolved = executor.resolve_unknown("i1", NOW)

    assert resolved.outcome is Outcome.SUBMITTED  # live at the venue, unfilled
    assert ledger.get("i1").state is OrderState.ACCEPTED
    assert ledger.get("i1").exchange_order_id in venue.orders
    # Still one order, still holding budget, now with an id we can cancel.
    assert len(venue.orders) == 1
    assert store.get_reservation("i1").state.holds_budget
    assert store.reserved_risk() == dec("10")


def test_t17_a_429_that_did_not_place_the_order_stays_unknown_on_resolve(
    store, ledger, executor, venue
):
    """Absence at the venue is not proof of absence. Budget stays held.

    This is the conservative side of the design and it has a cost: a 429 on
    a create that genuinely never landed keeps its budget until an operator
    decides. The alternative - freeing on 'not found' - is how a bot sends a
    duplicate while the first order is still in flight.
    """
    reserve(store)
    make_intent(ledger)
    venue.create_faults.append((RateLimitExceeded("429"), False))
    assert submit(executor).outcome is Outcome.UNKNOWN

    resolved = executor.resolve_unknown("i1", NOW)

    assert resolved.outcome is Outcome.UNKNOWN
    assert ledger.get("i1").state is OrderState.UNKNOWN
    assert store.reserved_risk() == dec("10")
    assert submit(executor).outcome is Outcome.BLOCKED


def test_t17_a_transport_fault_during_resolution_keeps_unknown(
    store, ledger, executor, venue
):
    """Resolution is itself a network call; when it fails nothing changes."""
    reserve(store)
    make_intent(ledger)
    venue.create_faults.append((ConnectionError("reset"), True))
    assert submit(executor).outcome is Outcome.UNKNOWN

    venue.fetch_faults.append(RateLimitExceeded("429"))
    venue.lookup_faults.append(ExchangeNotAvailable("503"))
    resolved = executor.resolve_unknown("i1", NOW)

    assert resolved.outcome is Outcome.UNKNOWN
    assert ledger.get("i1").state is OrderState.UNKNOWN
    assert store.reserved_risk() == dec("10")

    # Second attempt, transport recovered: the order is found and adopted.
    resolved = executor.resolve_unknown("i1", NOW)
    assert resolved.outcome is Outcome.SUBMITTED
    assert ledger.get("i1").state is OrderState.ACCEPTED


def test_t17_a_transport_fault_masking_a_fill_is_discovered_not_assumed(
    store, ledger, executor, venue
):
    reserve(store)
    make_intent(ledger)
    venue.create_faults.append((ExchangeNotAvailable("502"), True))
    assert submit(executor).outcome is Outcome.UNKNOWN
    venue.tick("99")  # the resting buy at 100 fills while we were blind

    resolved = executor.resolve_unknown("i1", NOW)

    assert resolved.outcome is Outcome.FILLED
    assert ledger.get("i1").state is OrderState.FILLED
    assert store.get_reservation("i1").state is ReservationState.FILLED


# --------------------------------------------------------------------------
# Cancellation under transport faults
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "fault, cancelled_anyway",
    [
        (RateLimitExceeded("429"), False),
        (ExchangeNotAvailable("503"), True),
        (ConnectionError("reset"), True),
    ],
    ids=["429", "503-but-cancelled", "disconnect-but-cancelled"],
)
def test_t17_a_transport_fault_on_cancel_releases_nothing(
    store, ledger, executor, venue, fault, cancelled_anyway
):
    reserve(store)
    make_intent(ledger)
    assert submit(executor).outcome is Outcome.SUBMITTED
    venue.cancel_faults.append((fault, cancelled_anyway))

    result = executor.cancel("i1", NOW)

    assert result.outcome is Outcome.UNKNOWN
    assert ledger.get("i1").state is OrderState.UNKNOWN
    assert store.get_reservation("i1").state is not ReservationState.RELEASED
    assert store.reserved_risk() == dec("10")

    # Only a query settles it, and it settles it correctly either way.
    resolved = executor.resolve_unknown("i1", NOW)
    if cancelled_anyway:
        assert resolved.outcome is Outcome.CANCELLED
        assert store.get_reservation("i1").state is ReservationState.RELEASED
    else:
        assert resolved.outcome is Outcome.SUBMITTED
        assert store.reserved_risk() == dec("10")


def test_t17_a_cancel_rejected_because_it_filled_is_recorded_as_a_fill(
    store, ledger, executor, venue
):
    reserve(store)
    make_intent(ledger)
    assert submit(executor).outcome is Outcome.SUBMITTED
    venue.cancel_loses_race = True

    result = executor.cancel("i1", NOW)

    assert result.outcome is Outcome.FILLED
    assert ledger.get("i1").state is OrderState.FILLED
    assert store.get_reservation("i1").state is ReservationState.FILLED


# --------------------------------------------------------------------------
# Emergency exit under transport faults
# --------------------------------------------------------------------------


def test_t17_an_emergency_exit_stops_at_the_first_unknown(store, ledger, executor, venue):
    """A chase that continues past an unknown sell could sell twice."""
    venue.create_faults.append((ExchangeNotAvailable("503"), True))

    result = executor.emergency_exit(
        intent_prefix="t1", pair=PAIR, amount=dec("1"), reference_price=dec("100"),
        max_slippage=dec("0.05"), now=NOW, price_feed=lambda: dec("100"),
    )

    assert result.outcome is Outcome.UNKNOWN
    assert result.needs_operator
    assert any("not retried automatically" in a for a in result.alerts)
    creates = [c for c in venue.call_log if c[0] == "create_order"]
    assert len(creates) == 1
    assert len(venue.orders) == 1  # exactly one sell at the venue


def test_t17_an_emergency_exit_survives_a_429_on_its_cancel_step(
    store, ledger, executor, venue
):
    """The cancel between reprice attempts can fail too. That must not lead
    to a second sell while the first may still be live."""
    venue.never_fill = True
    venue.cancel_faults.append((RateLimitExceeded("429"), False))

    result = executor.emergency_exit(
        intent_prefix="t1", pair=PAIR, amount=dec("1"), reference_price=dec("100"),
        max_slippage=dec("0.05"), now=NOW, price_feed=lambda: dec("100"),
    )

    sells = [o for o in venue.orders.values() if o.side == "sell"]
    live_sells = [o for o in sells if o.status == "open"]
    # Bounded: at most max_reprice_attempts sells were ever created ...
    assert len(sells) <= executor.max_reprice_attempts
    # ... and the attempt whose cancel was lost is recorded as UNKNOWN, so the
    # operator is told a sell may still be resting rather than "position open,
    # nothing live".
    unknown = [o for o in ledger.all_orders() if o.state is OrderState.UNKNOWN]
    assert unknown, "the un-confirmed cancel must leave an UNKNOWN record"
    assert result.outcome in (Outcome.NOT_FILLED_ALERT, Outcome.UNKNOWN)
    assert result.needs_operator
    assert len(live_sells) >= 1  # the fake did not cancel; the record agrees


# --------------------------------------------------------------------------
# Data path: HTTP-level 429 / 5xx / timeouts against the retrying client
# --------------------------------------------------------------------------


class _Response:
    def __init__(self, status: int, body=None):
        self.status_code = status
        self._body = body if body is not None else {"ok": True}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"HTTP {self.status_code}")

    def json(self):
        if isinstance(self._body, Exception):
            raise self._body
        return self._body


class ScriptedSession:
    """A requests.Session double that plays back a script of outcomes."""

    def __init__(self, script):
        self.script = list(script)
        self.calls = 0

    def post(self, url, **kwargs):
        self.calls += 1
        item = self.script.pop(0) if self.script else _Response(200)
        if isinstance(item, Exception):
            raise item
        return item


@pytest.fixture
def no_sleep(monkeypatch):
    slept: list[float] = []
    monkeypatch.setattr("kripto.data.hyperliquid_client.time.sleep", slept.append)
    return slept


def test_t17_429_then_success_is_retried_with_growing_backoff(no_sleep):
    session = ScriptedSession([_Response(429), _Response(429), _Response(200, {"v": 1})])
    client = HyperliquidInfoClient(session=session, max_retries=4, base_backoff=1.0)

    assert client._post({"type": "meta"}) == {"v": 1}
    assert session.calls == 3
    assert len(no_sleep) == 2
    assert no_sleep[0] < no_sleep[1], "backoff must grow between attempts"
    assert all(1.0 <= d <= 2.0 * 1.25 for d in no_sleep)


@pytest.mark.parametrize("status", [500, 502, 503, 504])
def test_t17_5xx_is_retried_then_given_up_within_the_bound(no_sleep, status):
    session = ScriptedSession([_Response(status)] * 10)
    client = HyperliquidInfoClient(session=session, max_retries=3, base_backoff=1.0)

    with pytest.raises(HyperliquidError) as info:
        client._post({"type": "meta"})

    assert session.calls == 4, "max_retries=3 means exactly four attempts, not forever"
    assert f"HTTP {status}" in str(info.value)


def test_t17_backoff_is_capped(no_sleep):
    session = ScriptedSession([_Response(503)] * 10)
    client = HyperliquidInfoClient(
        session=session, max_retries=6, base_backoff=1.0, max_backoff=4.0
    )
    with pytest.raises(HyperliquidError):
        client._post({"type": "meta"})
    assert max(no_sleep) <= 4.0 * 1.25


def test_t17_disconnects_and_timeouts_are_retried_like_5xx(no_sleep):
    session = ScriptedSession(
        [
            requests.ConnectionError("reset"),
            requests.Timeout("read timed out"),
            _Response(200, {"v": 2}),
        ]
    )
    client = HyperliquidInfoClient(session=session, max_retries=4)
    assert client._post({"type": "meta"}) == {"v": 2}
    assert session.calls == 3


def test_t17_a_malformed_body_is_retried_not_parsed_as_data(no_sleep):
    bad = json.JSONDecodeError("bad", "<html>", 0)
    session = ScriptedSession([_Response(200, bad), _Response(200, {"v": 3})])
    client = HyperliquidInfoClient(session=session, max_retries=2)
    assert client._post({"type": "meta"}) == {"v": 3}


def test_t17_a_4xx_that_is_not_429_is_not_retried(no_sleep):
    """A 400/403 will not become a 200 by asking again."""
    session = ScriptedSession([_Response(403)] * 5)
    client = HyperliquidInfoClient(session=session, max_retries=4)
    with pytest.raises(HyperliquidError):
        client._post({"type": "meta"})
    assert session.calls == 1
    assert no_sleep == []


def test_t17_the_retrying_client_has_no_write_methods():
    """The retry loop is safe ONLY because the client is read-only. If a
    write method ever appears here, the generic retry becomes a duplicate-
    order generator and this test is the tripwire."""
    forbidden = {"create_order", "cancel_order", "place", "order", "withdraw", "transfer"}
    names = {n.lower() for n in dir(HyperliquidInfoClient)}
    assert not (names & forbidden)
