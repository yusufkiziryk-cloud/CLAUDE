"""T08, T09, T10, T16 - the order lifecycle under adversarial conditions.

Driven by the stateful fake venue in ``fake_exchange.py``, which keeps real
order state and can be told to fail in the specific ways venues fail.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from fake_exchange import (
    ExchangeRejected,
    ExchangeTimeout,
    FakeExchange,
    duplicated,
    reordered,
)
from kripto.money import dec
from kripto.orders.executor import OrderExecutor, Outcome
from kripto.orders.lifecycle import DuplicateIntent, OrderLedger, OrderState
from kripto.risk.state import BotState, ReservationState, RiskStore

NOW = datetime(2026, 9, 17, 12, 0, tzinfo=timezone.utc)
PAIR = "BTC/USDC"


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
    return FakeExchange()


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


# --------------------------------------------------------------------------
# Baseline
# --------------------------------------------------------------------------


def test_happy_path_submit_and_fill(ledger, executor, venue):
    make_intent(ledger)
    result = executor.submit(
        intent_id="i1", pair=PAIR, side="buy", amount=dec("1"), price=dec("100"),
        client_order_id="i1", now=NOW,
    )

    assert result.outcome is Outcome.SUBMITTED
    assert ledger.get("i1").state is OrderState.ACCEPTED

    for event in venue.tick("99"):
        ledger.mark_filled("i1", event["filled"], NOW, event_id=event["event_id"])

    record = ledger.get("i1")
    assert record.state is OrderState.FILLED
    assert record.filled_amount == dec("1")


def test_an_unrecorded_intent_can_never_be_sent(executor):
    result = executor.submit(
        intent_id="ghost", pair=PAIR, side="buy", amount=dec("1"), price=dec("100"),
        client_order_id="ghost", now=NOW,
    )

    assert result.outcome is Outcome.BLOCKED
    assert "no recorded intent" in result.detail


def test_duplicate_intent_is_refused(ledger):
    make_intent(ledger)
    with pytest.raises(DuplicateIntent):
        make_intent(ledger)


# --------------------------------------------------------------------------
# T08 - a timeout AFTER the venue accepted the order
# --------------------------------------------------------------------------


def test_t08_timeout_after_submit_becomes_unknown_not_failed(ledger, executor, venue):
    """The dangerous case: the venue HAS the order, we never heard back."""
    venue.timeout_on_create = True
    make_intent(ledger)

    result = executor.submit(
        intent_id="i1", pair=PAIR, side="buy", amount=dec("1"), price=dec("100"),
        client_order_id="i1", now=NOW,
    )

    assert result.outcome is Outcome.UNKNOWN
    assert ledger.get("i1").state is OrderState.UNKNOWN
    # And the order really does exist at the venue.
    assert len(venue.fetch_open_orders()) == 1


def test_t08_no_second_order_is_sent_for_an_unknown_intent(ledger, executor, venue):
    venue.timeout_on_create = True
    make_intent(ledger)
    executor.submit(
        intent_id="i1", pair=PAIR, side="buy", amount=dec("1"), price=dec("100"),
        client_order_id="i1", now=NOW,
    )
    venue.timeout_on_create = False

    retry = executor.submit(
        intent_id="i1", pair=PAIR, side="buy", amount=dec("1"), price=dec("100"),
        client_order_id="i1", now=NOW,
    )

    assert retry.outcome is Outcome.BLOCKED
    assert "may still be live" in retry.detail
    creates = [c for c in venue.call_log if c[0] == "create_order"]
    assert len(creates) == 1, "a second order was sent for an unresolved intent"


def test_t08_unknown_is_resolved_by_querying_the_venue(ledger, executor, venue):
    venue.timeout_on_create = True
    make_intent(ledger)
    executor.submit(
        intent_id="i1", pair=PAIR, side="buy", amount=dec("1"), price=dec("100"),
        client_order_id="i1", now=NOW,
    )
    venue.tick("99")  # it fills while we are in the dark

    resolved = executor.resolve_unknown("i1", NOW + timedelta(seconds=30))

    assert resolved.outcome is Outcome.FILLED
    assert ledger.get("i1").state is OrderState.FILLED
    assert ledger.get("i1").filled_amount == dec("1")


def test_t08_unknown_stays_unknown_when_the_venue_cannot_be_reached(ledger, executor, venue):
    venue.timeout_on_create = True
    make_intent(ledger)
    executor.submit(
        intent_id="i1", pair=PAIR, side="buy", amount=dec("1"), price=dec("100"),
        client_order_id="i1", now=NOW,
    )

    def explode(*_args, **_kwargs):
        raise ExchangeTimeout("still down")

    venue.fetch_order = explode
    venue.find_by_client_order_id = explode

    assert executor.resolve_unknown("i1", NOW).outcome is Outcome.UNKNOWN
    assert ledger.get("i1").state is OrderState.UNKNOWN


def test_t08_unknown_order_keeps_holding_its_risk_budget(store, ledger, executor, venue):
    reserve(store)
    venue.timeout_on_create = True
    make_intent(ledger)
    held_before = store.reserved_risk()

    executor.submit(
        intent_id="i1", pair=PAIR, side="buy", amount=dec("1"), price=dec("100"),
        client_order_id="i1", now=NOW,
    )

    assert store.get_reservation("i1").state is ReservationState.UNKNOWN
    assert store.reserved_risk() == held_before


def test_t08_an_outright_rejection_is_not_an_unknown(ledger, executor, venue):
    """A refusal is definite: the order does not exist, and the intent is done."""
    venue.reject_next_create = True
    make_intent(ledger)

    result = executor.submit(
        intent_id="i1", pair=PAIR, side="buy", amount=dec("1"), price=dec("100"),
        client_order_id="i1", now=NOW,
    )

    assert result.outcome is Outcome.REJECTED
    assert ledger.get("i1").state is OrderState.REJECTED
    assert venue.fetch_open_orders() == []


# --------------------------------------------------------------------------
# T09 - cancel/fill races, duplicated and reordered events
# --------------------------------------------------------------------------


def test_t09_cancel_that_loses_the_race_does_not_lose_the_fill(ledger, executor, venue):
    """The order filled just before our cancel arrived. The fill is real and
    must not be discarded because we had asked to cancel."""
    make_intent(ledger)
    executor.submit(
        intent_id="i1", pair=PAIR, side="buy", amount=dec("1"), price=dec("100"),
        client_order_id="i1", now=NOW,
    )
    venue.cancel_loses_race = True

    result = executor.cancel("i1", NOW)

    assert result.outcome is Outcome.FILLED
    record = ledger.get("i1")
    assert record.state is OrderState.FILLED
    assert record.filled_amount == dec("1"), "the filled quantity was dropped"


def test_t09_a_cancel_request_alone_never_marks_the_order_cancelled(ledger, executor, venue):
    make_intent(ledger)
    executor.submit(
        intent_id="i1", pair=PAIR, side="buy", amount=dec("1"), price=dec("100"),
        client_order_id="i1", now=NOW,
    )

    ledger.mark_cancel_requested("i1", NOW)

    record = ledger.get("i1")
    assert record.state is OrderState.CANCEL_REQUESTED
    assert record.state is not OrderState.CANCELLED
    assert record.state.may_be_live_on_exchange


def test_t09_cancel_timeout_leaves_the_order_unknown_not_cancelled(ledger, executor, venue):
    make_intent(ledger)
    executor.submit(
        intent_id="i1", pair=PAIR, side="buy", amount=dec("1"), price=dec("100"),
        client_order_id="i1", now=NOW,
    )
    venue.timeout_on_cancel = True

    result = executor.cancel("i1", NOW)

    assert result.outcome is Outcome.UNKNOWN
    assert ledger.get("i1").state is OrderState.UNKNOWN


def test_t09_duplicate_fill_events_are_applied_once(ledger, executor, venue):
    make_intent(ledger, amount="2")
    executor.submit(
        intent_id="i1", pair=PAIR, side="buy", amount=dec("2"), price=dec("100"),
        client_order_id="i1", now=NOW,
    )
    venue.partial_fill_fraction = dec("0.5")
    events = venue.tick("99")

    for event in duplicated(events):
        ledger.mark_filled("i1", event["filled"], NOW, event_id=event["event_id"])

    assert ledger.get("i1").filled_amount == dec("1"), "a duplicated event was counted twice"


def test_t09_reordered_events_never_reduce_the_filled_amount(ledger, executor, venue):
    make_intent(ledger, amount="4")
    executor.submit(
        intent_id="i1", pair=PAIR, side="buy", amount=dec("4"), price=dec("100"),
        client_order_id="i1", now=NOW,
    )
    venue.partial_fill_fraction = dec("0.5")
    events = venue.tick("99") + venue.tick("99") + venue.tick("99")
    assert len(events) == 3

    for event in reordered(events):
        ledger.mark_filled("i1", event["filled"], NOW, event_id=event["event_id"])

    record = ledger.get("i1")
    assert record.filled_amount == dec("3.5"), (
        f"out-of-order delivery changed the recorded fill to {record.filled_amount}"
    )


def test_t09_duplicated_and_reordered_together_produce_one_effect(ledger, executor, venue):
    make_intent(ledger, amount="4")
    executor.submit(
        intent_id="i1", pair=PAIR, side="buy", amount=dec("4"), price=dec("100"),
        client_order_id="i1", now=NOW,
    )
    venue.partial_fill_fraction = dec("0.5")
    events = venue.tick("99") + venue.tick("99")

    for event in duplicated(reordered(events)):
        ledger.mark_filled("i1", event["filled"], NOW, event_id=event["event_id"])

    assert ledger.get("i1").filled_amount == dec("3")


def test_t09_a_terminal_order_cannot_be_reopened_by_a_late_event(ledger, executor, venue):
    make_intent(ledger)
    executor.submit(
        intent_id="i1", pair=PAIR, side="buy", amount=dec("1"), price=dec("100"),
        client_order_id="i1", now=NOW,
    )
    for event in venue.tick("99"):
        ledger.mark_filled("i1", event["filled"], NOW, event_id=event["event_id"])
    assert ledger.get("i1").state is OrderState.FILLED

    ledger.mark_cancel_confirmed("i1", NOW, event_id="late-cancel")

    assert ledger.get("i1").state is OrderState.FILLED


def test_t09_partial_fill_then_confirmed_cancel_keeps_the_filled_part(store, ledger, executor, venue):
    reserve(store, amount="2", risk="10", notional="200")
    make_intent(ledger, amount="2")
    executor.submit(
        intent_id="i1", pair=PAIR, side="buy", amount=dec("2"), price=dec("100"),
        client_order_id="i1", now=NOW,
    )
    venue.partial_fill_fraction = dec("0.5")
    for event in venue.tick("99"):
        ledger.mark_filled("i1", event["filled"], NOW, event_id=event["event_id"])

    ledger.mark_cancel_confirmed("i1", NOW)

    record = ledger.get("i1")
    assert record.state is OrderState.CANCELLED
    assert record.filled_amount == dec("1"), "the filled half was discarded"
    # Budget for the unfilled half is released only now that the cancel is confirmed.
    assert store.get_reservation("i1").state is ReservationState.RELEASED


# --------------------------------------------------------------------------
# T10 - crashes at each stage
# --------------------------------------------------------------------------


def _reopen(tmp_path):
    store = RiskStore(tmp_path / "risk.sqlite")
    return store, OrderLedger(store)


def test_t10_crash_after_intent_before_submit(tmp_path):
    """Nothing was sent. The intent is recoverable and still submittable."""
    store = RiskStore(tmp_path / "risk.sqlite")
    ledger = OrderLedger(store)
    make_intent(ledger)
    store.close()  # "crash"

    store2, ledger2 = _reopen(tmp_path)
    record = ledger2.get("i1")
    assert record is not None
    assert record.state is OrderState.INTENT
    allowed, _ = ledger2.may_submit("i1")
    assert allowed, "an unsent intent should still be submittable after a restart"
    store2.close()


def test_t10_crash_between_submit_and_confirmation(tmp_path):
    """The worst moment. After restart the intent must block resubmission."""
    store = RiskStore(tmp_path / "risk.sqlite")
    ledger = OrderLedger(store)
    venue = FakeExchange(timeout_on_create=True)
    executor = OrderExecutor(ledger, venue)
    make_intent(ledger)
    executor.submit(
        intent_id="i1", pair=PAIR, side="buy", amount=dec("1"), price=dec("100"),
        client_order_id="i1", now=NOW,
    )
    store.close()

    store2, ledger2 = _reopen(tmp_path)
    record = ledger2.get("i1")
    assert record.state is OrderState.UNKNOWN
    allowed, reason = ledger2.may_submit("i1")
    assert not allowed
    assert "may still be live" in reason
    store2.close()


def test_t10_crash_after_a_partial_fill_keeps_the_fill(tmp_path):
    store = RiskStore(tmp_path / "risk.sqlite")
    ledger = OrderLedger(store)
    venue = FakeExchange(partial_fill_fraction=dec("0.5"))
    executor = OrderExecutor(ledger, venue)
    make_intent(ledger, amount="2")
    executor.submit(
        intent_id="i1", pair=PAIR, side="buy", amount=dec("2"), price=dec("100"),
        client_order_id="i1", now=NOW,
    )
    for event in venue.tick("99"):
        ledger.mark_filled("i1", event["filled"], NOW, event_id=event["event_id"])
    store.close()

    store2, ledger2 = _reopen(tmp_path)
    record = ledger2.get("i1")
    assert record.filled_amount == dec("1")
    assert record.state is OrderState.PARTIALLY_FILLED
    store2.close()


def test_t10_event_deduplication_survives_a_restart(tmp_path):
    """Replaying a feed after a restart must not double-count what was
    already applied before the crash."""
    store = RiskStore(tmp_path / "risk.sqlite")
    ledger = OrderLedger(store)
    venue = FakeExchange(partial_fill_fraction=dec("0.5"))
    executor = OrderExecutor(ledger, venue)
    make_intent(ledger, amount="2")
    executor.submit(
        intent_id="i1", pair=PAIR, side="buy", amount=dec("2"), price=dec("100"),
        client_order_id="i1", now=NOW,
    )
    events = venue.tick("99")
    for event in events:
        ledger.mark_filled("i1", event["filled"], NOW, event_id=event["event_id"])
    store.close()

    store2, ledger2 = _reopen(tmp_path)
    for event in events:  # the feed replays from its last checkpoint
        ledger2.mark_filled("i1", event["filled"], NOW, event_id=event["event_id"])

    assert ledger2.get("i1").filled_amount == dec("1")
    store2.close()


def test_t10_recovery_required_when_history_is_incomplete(tmp_path):
    """An API that cannot show us the full fill history is not evidence that
    nothing filled."""
    store = RiskStore(tmp_path / "risk.sqlite")
    ledger = OrderLedger(store)
    venue = FakeExchange(timeout_on_create=True)
    executor = OrderExecutor(ledger, venue)
    make_intent(ledger)
    executor.submit(
        intent_id="i1", pair=PAIR, side="buy", amount=dec("1"), price=dec("100"),
        client_order_id="i1", now=NOW,
    )

    result = ledger.reconcile(
        open_orders=[], recent_fills=[], known_positions=set(), now=NOW,
        history_complete=False,
    )

    assert not result.consistent
    assert "i1" in result.unresolved
    assert result.requires_operator
    store.close()


# --------------------------------------------------------------------------
# T16 - the stop does not fill; the price gaps
# --------------------------------------------------------------------------


def test_t16_emergency_exit_stops_after_a_bounded_number_of_attempts(ledger, venue):
    """A limit that never gets touched must not produce an infinite chase."""
    venue.never_fill = True
    executor = OrderExecutor(ledger, venue, max_reprice_attempts=3)

    result = executor.emergency_exit(
        intent_prefix="t16a", pair=PAIR, amount=dec("1"), reference_price=dec("100"),
        max_slippage=dec("0.01"), now=NOW, price_feed=lambda: dec("100"),
    )

    assert result.outcome is Outcome.NOT_FILLED_ALERT
    assert result.attempts == 3
    assert result.needs_operator
    assert any("STILL OPEN" in a for a in result.alerts)
    creates = [c for c in venue.call_log if c[0] == "create_order"]
    assert len(creates) == 3, "the chase was not bounded"


def test_t16_emergency_exit_never_prices_below_the_slippage_floor(ledger, venue):
    """A collapsing market must not drag the limit down without bound."""
    venue.never_fill = True
    executor = OrderExecutor(ledger, venue, max_reprice_attempts=3)
    prices = iter([dec("100"), dec("50"), dec("10")])

    executor.emergency_exit(
        intent_prefix="t16b", pair=PAIR, amount=dec("1"), reference_price=dec("100"),
        max_slippage=dec("0.02"), now=NOW, price_feed=lambda: next(prices),
    )

    floor = dec("100") * (dec("1") - dec("0.02"))
    for record in ledger.all_orders():
        if record.side == "sell":
            assert record.price >= floor, (
                f"placed a sell at {record.price}, below the {floor} floor"
            )


def test_t16_emergency_exit_succeeds_when_the_price_is_reachable(ledger, venue):
    """The market trades at the limit right after the sell rests. (The
    earlier version ticked BEFORE the sell existed, so nothing ever filled
    and the assertion accepted NOT_FILLED_ALERT - audit finding.)"""
    executor = OrderExecutor(ledger, venue, max_reprice_attempts=3)
    original = venue.create_order

    def create_then_get_hit(*args, **kwargs):
        response = original(*args, **kwargs)
        venue.tick("100")
        return response

    venue.create_order = create_then_get_hit

    result = executor.emergency_exit(
        intent_prefix="t16c", pair=PAIR, amount=dec("1"), reference_price=dec("100"),
        max_slippage=dec("0.01"), now=NOW, price_feed=lambda: dec("100"),
    )

    assert result.outcome is Outcome.FILLED
    assert result.attempts == 1
    assert ledger.get(result.intent_id).state is OrderState.FILLED
    assert sum(o.filled for o in venue.orders.values() if o.side == "sell") == dec("1")


def test_t16_a_price_gap_leaves_the_stop_untouched(venue):
    """A gap is the case a bot-internal stop cannot protect against: the
    market simply is not there at the stop price."""
    venue.create_order(
        pair=PAIR, side="sell", amount=dec("1"), price=dec("90"), client_order_id="stop-1"
    )

    # The price jumps from 100 straight to 70 without ever trading at 90...
    filled_on_the_way = venue.tick("70")

    # ...which, for a resting sell at 90, still counts as touched (70 >= 90 is
    # false, so it does NOT fill). That is the point: the protective sell sits
    # above the market and never trades.
    assert filled_on_the_way == []
    assert venue.fetch_open_orders()[0]["filled"] == 0.0


def test_t16_no_fill_guarantee_is_ever_claimed(ledger, venue):
    """The alert text must say the position is still open, not imply it closed."""
    venue.never_fill = True
    executor = OrderExecutor(ledger, venue, max_reprice_attempts=2)

    result = executor.emergency_exit(
        intent_prefix="t16e", pair=PAIR, amount=dec("1"), reference_price=dec("100"),
        max_slippage=dec("0.01"), now=NOW, price_feed=lambda: dec("100"),
    )

    joined = " ".join(result.alerts).lower()
    assert "still open" in joined
    assert "operator" in joined
