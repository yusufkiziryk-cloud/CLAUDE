"""Regression tests for the findings of the adversarial audit (2026-09-19).

Each test names the finding it pins. A test here that starts failing means
one of the audited defects is back.
"""

from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import pandas as pd
import pytest

from fake_exchange import ExchangeTimeout, FakeExchange
from kripto.money import dec
from kripto.orders.executor import OrderExecutor, Outcome
from kripto.orders.lifecycle import OrderLedger, OrderState
from kripto.policy import load_policy
from kripto.risk.gate import EntryGate, GateContext
from kripto.risk.equity import EquitySnapshot
from kripto.risk.state import BotState, LockKind, ReservationState, RiskStore

ROOT = Path(__file__).resolve().parent.parent
NOW = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)
PAIR = "BTC/USDC"


@pytest.fixture
def policy():
    return load_policy(str(ROOT / "config" / "policy.yaml"))


@pytest.fixture
def store(tmp_path):
    s = RiskStore(tmp_path / "risk.sqlite")
    s.set_state(BotState.READY, "test", NOW)
    yield s
    s.close()


def reserve(store, intent_id, pair=PAIR, amount="1", risk="10", notional="100"):
    ok, msg = store.try_reserve(
        intent_id=intent_id, pair=pair, amount_base=dec(amount), risk_quote=dec(risk),
        notional_quote=dec(notional), risk_budget_remaining=dec("1000"),
        notional_budget_remaining=dec("10000"), max_concurrent=10, existing_positions=0, now=NOW,
    )
    assert ok, msg


# --------------------------------------------------------------------------
# Writer lock
# --------------------------------------------------------------------------


def test_audit_writer_lock_refuses_a_live_second_process_with_its_own_owner(tmp_path):
    """Finding: every dry-run instance used the same owner string, so a second
    instance 'renewed' the lease instead of being refused."""
    path = tmp_path / "risk.sqlite"
    first = RiskStore(path)
    ok, _ = first.acquire_writer_lock(f"bot:dry_run:host:{os.getpid()}", NOW)
    assert ok
    second = RiskStore(path)
    ok, message = second.acquire_writer_lock(f"bot:dry_run:host:{os.getpid() + 1}", NOW + timedelta(seconds=5))
    # Our own pid is alive, so the lock is genuinely held.
    assert not ok and "another instance holds" in message
    first.close()
    second.close()


def test_audit_writer_lock_left_by_a_dead_pid_on_this_host_is_taken_over(tmp_path):
    """Finding: a systemd restart 30s after a crash was refused for the rest of
    the 300s lease, and five refusals hit StartLimitBurst."""
    path = tmp_path / "risk.sqlite"
    store = RiskStore(path)
    with store._tx() as conn:
        import socket

        conn.execute(
            "INSERT INTO writer_lock(id, owner, host, pid, acquired_at, heartbeat_at) "
            "VALUES (1, 'crashed', ?, ?, ?, ?)",
            (socket.gethostname(), 2**22 - 7, NOW.isoformat(), NOW.isoformat()),
        )
    ok, message = store.acquire_writer_lock("restarted:host:pid", NOW + timedelta(seconds=30))
    assert ok, message
    store.close()


def test_audit_strategy_owner_is_unique_per_process():
    import sys

    sys.path.insert(0, str(ROOT / "user_data" / "strategies"))
    import inspect

    from BaselineTrend4h import BaselineTrend4h

    source = inspect.getsource(BaselineTrend4h.bot_start)
    assert "os.getpid()" in source and "socket.gethostname()" in source
    assert "BotState.STOPPED" not in source, "a refused instance must not write STOPPED into the shared store"


# --------------------------------------------------------------------------
# Transactions
# --------------------------------------------------------------------------


def test_audit_order_state_and_budget_release_commit_together(store):
    """Finding: _apply committed the order row, then released the budget in a
    second transaction; a failure between them left a terminal order holding
    budget forever."""
    ledger = OrderLedger(store)
    reserve(store, "i1")
    ledger.record_intent(intent_id="i1", pair=PAIR, side="buy", amount=dec("1"), price=dec("100"), client_order_id="i1", now=NOW)
    ledger.mark_submitted("i1", NOW)
    ledger.mark_accepted("i1", "X1", NOW)

    real_release = store.release

    def failing_release(*args, **kwargs):
        raise sqlite3.OperationalError("database or disk is full")

    store.release = failing_release
    with pytest.raises(sqlite3.OperationalError):
        ledger.mark_cancel_confirmed("i1", NOW)
    store.release = real_release

    # Neither half was applied: the order is still ACCEPTED, the budget still held.
    assert ledger.get("i1").state is OrderState.ACCEPTED
    assert store.get_reservation("i1").state is ReservationState.PENDING
    assert store._conn.in_transaction is False

    ledger.mark_cancel_confirmed("i1", NOW)
    assert ledger.get("i1").state is OrderState.CANCELLED
    assert store.get_reservation("i1").state is ReservationState.RELEASED


def test_audit_nested_transactions_join_the_outer_one(store):
    with store._tx():
        reserve(store, "outer")
        with store._tx():
            store.set_state(BotState.ENTRY_PAUSED, "inner", NOW)
        assert store._tx_depth == 1
    assert store._tx_depth == 0
    assert store.get_state() is BotState.ENTRY_PAUSED
    assert store.get_reservation("outer") is not None


# --------------------------------------------------------------------------
# Order lifecycle
# --------------------------------------------------------------------------


def test_audit_terminal_orders_ignore_late_fills_but_record_them(store):
    """Finding: a late fill flipped CANCELLED to FILLED and rewrote
    filled_amount while logging the event as not applied."""
    ledger = OrderLedger(store)
    ledger.record_intent(intent_id="i5", pair=PAIR, side="buy", amount=dec("2"), price=dec("100"), client_order_id="i5", now=NOW)
    ledger.mark_submitted("i5", NOW)
    ledger.mark_accepted("i5", "X5", NOW)
    ledger.mark_filled("i5", dec("1"), NOW, event_id="f1")
    ledger.mark_cancel_confirmed("i5", NOW)
    assert ledger.get("i5").state is OrderState.CANCELLED

    ledger.mark_filled("i5", dec("2"), NOW, event_id="f2-late")

    record = ledger.get("i5")
    assert record.state is OrderState.CANCELLED
    assert record.filled_amount == dec("1")
    row = store._conn.execute("SELECT applied, skip_reason FROM order_events WHERE event_id='f2-late'").fetchone()
    assert row["applied"] == 0 and "terminal" in row["skip_reason"]


def test_audit_resolve_unknown_treats_rejected_as_dead_and_releases(store):
    ledger = OrderLedger(store)
    venue = FakeExchange()
    executor = OrderExecutor(ledger, venue)
    reserve(store, "i1")
    ledger.record_intent(intent_id="i1", pair=PAIR, side="buy", amount=dec("1"), price=dec("100"), client_order_id="i1", now=NOW)
    venue.timeout_on_create = True
    assert executor.submit(intent_id="i1", pair=PAIR, side="buy", amount=dec("1"), price=dec("100"), client_order_id="i1", now=NOW).outcome is Outcome.UNKNOWN
    order = next(iter(venue.orders.values()))
    order.status = "rejected"

    result = executor.resolve_unknown("i1", NOW)

    assert result.outcome is Outcome.REJECTED
    assert ledger.get("i1").state is OrderState.REJECTED
    assert store.get_reservation("i1").state is ReservationState.RELEASED


def test_audit_resolve_unknown_treats_expired_as_cancelled(store):
    ledger = OrderLedger(store)
    venue = FakeExchange()
    executor = OrderExecutor(ledger, venue)
    reserve(store, "i1")
    ledger.record_intent(intent_id="i1", pair=PAIR, side="buy", amount=dec("1"), price=dec("100"), client_order_id="i1", now=NOW)
    venue.timeout_on_create = True
    executor.submit(intent_id="i1", pair=PAIR, side="buy", amount=dec("1"), price=dec("100"), client_order_id="i1", now=NOW)
    next(iter(venue.orders.values())).status = "expired"

    assert executor.resolve_unknown("i1", NOW).outcome is Outcome.CANCELLED
    assert ledger.get("i1").state is OrderState.CANCELLED
    assert store.get_reservation("i1").state is ReservationState.RELEASED


def test_audit_a_second_resolution_with_more_filled_is_not_dropped_as_duplicate(store):
    """Finding: the resolve event id was the order id alone, so a later,
    larger fill seen on re-resolution was ignored as a redelivery."""
    ledger = OrderLedger(store)
    venue = FakeExchange()
    executor = OrderExecutor(ledger, venue)
    reserve(store, "i4", amount="2")
    ledger.record_intent(intent_id="i4", pair=PAIR, side="buy", amount=dec("2"), price=dec("100"), client_order_id="i4", now=NOW)
    executor.submit(intent_id="i4", pair=PAIR, side="buy", amount=dec("2"), price=dec("100"), client_order_id="i4", now=NOW)
    venue.partial_fill_fraction = dec("0.5")
    venue.tick("99")  # fills 1.0
    venue.timeout_on_cancel = True
    venue.orders[ledger.get("i4").exchange_order_id].status = "open"
    assert executor.cancel("i4", NOW).outcome is Outcome.UNKNOWN
    # fake's timeout_on_cancel marked it canceled; undo so the order stays live
    venue.orders[ledger.get("i4").exchange_order_id].status = "open"
    first = executor.resolve_unknown("i4", NOW)
    assert first.outcome is Outcome.SUBMITTED
    assert ledger.get("i4").filled_amount == dec("1")

    venue.partial_fill_fraction = None
    venue.tick("98")  # fills the remaining 1.0 -> closed
    ledger.mark_unknown("i4", "re-check", NOW)
    second = executor.resolve_unknown("i4", NOW)

    assert second.outcome is Outcome.FILLED
    assert ledger.get("i4").filled_amount == dec("2")
    assert ledger.get("i4").state is OrderState.FILLED
    assert store.get_reservation("i4").state is ReservationState.FILLED


def test_audit_emergency_exit_never_resells_what_an_earlier_attempt_sold(store):
    """Finding: each reprice attempt re-sent the FULL amount, so a partial
    fill on attempt 1 was sold again on attempts 2 and 3."""
    ledger = OrderLedger(store)
    venue = FakeExchange()
    executor = OrderExecutor(ledger, venue)

    class PartialThenCancel(FakeExchange):
        pass

    # First attempt fills 0.4 then the cancel lands; later attempts do not fill.
    fills = iter([dec("0.4"), dec("0"), dec("0")])

    original_cancel = venue.cancel_order

    def cancel_with_partial(order_id):
        order = venue.orders[order_id]
        quantity = next(fills)
        if quantity > 0:
            venue._fill(order, quantity)
        return original_cancel(order_id)

    venue.cancel_order = cancel_with_partial

    result = executor.emergency_exit(
        intent_prefix="e1", pair=PAIR, amount=dec("1"), reference_price=dec("100"),
        max_slippage=dec("0.05"), now=NOW, price_feed=lambda: dec("100"),
    )

    sells = [o for o in venue.orders.values() if o.side == "sell"]
    assert sum(o.filled for o in sells) == dec("0.4")
    assert [o.amount for o in sells] == [dec("1"), dec("0.6"), dec("0.6")]
    assert result.outcome is Outcome.NOT_FILLED_ALERT
    assert "0.6 is STILL OPEN" in result.alerts[-1]


def test_audit_emergency_exit_stops_when_a_cancel_is_unconfirmed(store):
    """Finding: a cancel timeout marked the attempt UNKNOWN but the chase went
    on to submit another full-size sell - three resting sells for one
    position."""
    ledger = OrderLedger(store)
    venue = FakeExchange()
    executor = OrderExecutor(ledger, venue)
    venue.never_fill = True

    def cancel_lost(order_id):
        raise ExchangeTimeout("no response after cancel")

    venue.cancel_order = cancel_lost

    result = executor.emergency_exit(
        intent_prefix="e1", pair=PAIR, amount=dec("1"), reference_price=dec("100"),
        max_slippage=dec("0.05"), now=NOW, price_feed=lambda: dec("100"),
    )

    assert result.outcome is Outcome.UNKNOWN
    assert result.needs_operator
    assert len([o for o in venue.orders.values() if o.side == "sell"]) == 1
    assert any("may still be live" in a for a in result.alerts)


def test_audit_partial_fill_then_gone_from_venue_releases_the_remainder(store):
    ledger = OrderLedger(store)
    reserve(store, "i6", amount="2")
    ledger.record_intent(intent_id="i6", pair=PAIR, side="buy", amount=dec("2"), price=dec("100"), client_order_id="i6", now=NOW)
    ledger.mark_submitted("i6", NOW)
    ledger.mark_accepted("i6", "X7", NOW)

    result = ledger.reconcile(
        open_orders=[], recent_fills=[{"order": "X7", "amount": 0.5}], known_positions=set(), now=NOW,
    )

    assert result.consistent
    assert ledger.get("i6").state is OrderState.CANCELLED
    assert ledger.get("i6").filled_amount == dec("0.5")
    assert store.get_reservation("i6").state is ReservationState.RELEASED


# --------------------------------------------------------------------------
# Gate
# --------------------------------------------------------------------------


def _ctx(equity="1000", now=NOW) -> GateContext:
    snap = EquitySnapshot(total=dec(equity), free_quote=dec(equity), locked_quote=dec(0), holdings_value=dec(0))
    return GateContext(now=now, equity=snap, open_positions=0, open_position_risk_quote=dec(0),
                       pair_notional_quote=dec(0), data_is_tradable=True, liquidity_ok=True)


def test_audit_float_ulp_on_the_final_amount_is_not_an_enlargement(store, policy):
    """Finding: freqtrade recomputes amount = float(stake)/rate, one ulp above
    the reserved Decimal about one time in six; the gate refused those."""
    gate = EntryGate(store, policy)
    # Find an (amount, price) pair where freqtrade's float round trip lands
    # one ulp ABOVE the reserved Decimal, exactly as the audit measured.
    found = None
    for n in range(1000, 5000):
        amount = dec(n) / dec(100000)
        price = dec("91657.68")
        round_trip = dec(str(float(amount * price) / float(price)))
        if round_trip > amount:
            found = (amount, price, round_trip)
            break
    assert found is not None, "no ulp-above example found; adjust the search"
    amount, price, round_trip = found
    reserve(store, "i1", amount=str(amount), notional=str(amount * price))

    ok, message = gate.confirm_final_order(intent_id="i1", final_amount=round_trip, final_price=price, ctx=_ctx())
    assert ok, message

    ok, message = gate.confirm_final_order(intent_id="i1", final_amount=amount * dec("1.3"), final_price=price, ctx=_ctx())
    assert not ok and "enlarged" in message


def test_audit_observe_opens_the_baseline_and_records_the_peak_without_a_signal(store, policy):
    """Finding: baselines and peak equity were only touched inside an entry
    evaluation, so the day baseline was the equity at the first ATTEMPT."""
    gate = EntryGate(store, policy)
    midnight = NOW.replace(hour=0, minute=1)
    gate.observe(_ctx("1000", midnight))
    day = store.get_period("day", midnight.replace(hour=0, minute=0))
    assert day is not None and day.starting_equity == dec("1000")

    gate.observe(_ctx("1200", midnight + timedelta(hours=3)))
    assert store.get_peak_equity() == dec("1200")

    breaches = gate.observe(_ctx("960", midnight + timedelta(hours=6)))  # -4% on the day
    assert any("DAILY_LOSS" in b for b in breaches)
    assert any(lock.kind is LockKind.DAILY_LOSS for lock in store.active_locks(midnight + timedelta(hours=6)))


# --------------------------------------------------------------------------
# Store: approvals and fills
# --------------------------------------------------------------------------


def test_audit_a_fill_one_step_short_completes_the_reservation(store):
    """Finding: ccxt truncation fills one exchange step below the reserved
    amount; the reservation stayed PENDING forever and after three of them
    every entry was refused."""
    reserve(store, "i1", amount="0.00270")
    store.record_partial_fill("i1", dec("0.00269"), NOW, complete=True)
    assert store.get_reservation("i1").state is ReservationState.FILLED
    assert store.reserved_risk() == dec("0")

    reserve(store, "i2", amount="0.00270")
    store.record_partial_fill("i2", dec("0.00269"), NOW)  # still filling
    assert store.get_reservation("i2").state is ReservationState.PARTIALLY_FILLED


def test_audit_pending_entries_are_durable_and_keyed_by_pair(tmp_path):
    path = tmp_path / "risk.sqlite"
    store = RiskStore(path)
    store.put_pending_entry(intent_id="a", pair=PAIR, amount_base=dec("1"), entry_price=dec("100"), stop_price=dec("95"), atr=dec("2"), now=NOW)
    store.put_pending_entry(intent_id="b", pair=PAIR, amount_base=dec("1"), entry_price=dec("101"), stop_price=dec("96"), atr=dec("2"), now=NOW + timedelta(minutes=1))
    store.close()

    reopened = RiskStore(path)  # a restart
    newest = reopened.get_pending_entry(PAIR)
    assert newest["intent_id"] == "b" and newest["stop_price"] == dec("96")
    reopened.release("b", "test", NOW)
    assert reopened.get_pending_entry(PAIR)["intent_id"] == "a"
    reopened.close()


# --------------------------------------------------------------------------
# Strategy integration with fakes standing in for freqtrade's live objects
# --------------------------------------------------------------------------


class FakeOrder:
    def __init__(self, side="buy", remaining=0.0, filled=0.0, status="closed"):
        self.ft_order_side = side
        self.remaining = remaining
        self.safe_filled = filled
        self.filled = filled
        self.status = status
        self.ft_is_open = status == "open"
        self.order_id = "o1"
        self.amount = remaining + filled


class FakeTrade:
    def __init__(self, pair, amount, open_rate, open_orders=(), is_open=True, exit_reason=None):
        self.pair = pair
        self.amount = amount
        self.open_rate = open_rate
        self.stake_amount = amount * open_rate
        self.open_orders = list(open_orders)
        self.orders = list(open_orders)
        self.is_open = is_open
        self.exit_reason = exit_reason
        self.entry_side = "buy"
        self.open_date_utc = NOW
        self._custom = {}

    @property
    def has_open_orders(self):
        return bool(self.open_orders)

    def get_custom_data(self, key):
        return self._custom.get(key)

    def set_custom_data(self, key, value):
        self._custom[key] = value


class FakeWallets:
    def __init__(self, free):
        self._free = free

    def get_free(self, currency):
        return self._free


class FakeDP:
    def __init__(self, dataframe, book=None, book_error=None):
        self.dataframe = dataframe
        self.book = book
        self.book_error = book_error

    def get_analyzed_dataframe(self, pair, timeframe):
        return self.dataframe, NOW

    def orderbook(self, pair, depth):
        if self.book_error:
            raise self.book_error
        return self.book

    def ticker(self, pair):
        raise RuntimeError("no ticker")

    def current_whitelist(self):
        return [PAIR]


def make_dataframe(last_open: datetime, close=100.0, volume=50000.0, n=10):
    dates = pd.date_range(end=last_open, periods=n, freq="4h")
    return pd.DataFrame({
        "date": dates, "open": [close] * n, "high": [close + 1] * n, "low": [close - 1] * n,
        "close": [close] * n, "volume": [volume] * n, "atr": [2.0] * n,
    })


def good_book(mid=100.0, spread_bps=5.0, depth_levels=10, size=100.0):
    half = mid * spread_bps / 20000
    bids = [[mid - half - i * 0.01, size] for i in range(depth_levels)]
    asks = [[mid + half + i * 0.01, size] for i in range(depth_levels)]
    return {"bids": bids, "asks": asks}


@pytest.fixture
def strategy(tmp_path, monkeypatch):
    import sys

    sys.path.insert(0, str(ROOT / "user_data" / "strategies"))
    from BaselineTrend4h import BaselineTrend4h

    strat = BaselineTrend4h({"runmode": "dry_run", "stake_currency": "USDC", "timeframe": "4h", "unfilledtimeout": {"entry": 30, "unit": "minutes"}})
    strat._store = RiskStore(tmp_path / "risk.sqlite")
    strat._store.set_state(BotState.READY, "test", NOW)
    strat.wallets = FakeWallets(free=800.0)
    last_open = datetime(2026, 9, 19, 8, 0, tzinfo=timezone.utc)  # closed at 12:00 = NOW
    strat.dp = FakeDP(make_dataframe(last_open), book=good_book())
    yield strat
    strat._store.close()


def _set_open_trades(monkeypatch, trades):
    from freqtrade.persistence import Trade

    monkeypatch.setattr(Trade, "get_open_trades", staticmethod(lambda: list(trades)))


def test_audit_equity_is_marked_to_market_not_cost(strategy, monkeypatch):
    """Finding: gate equity was freqtrade's cost-basis total, so an open loss
    never reached the loss limits, the drawdown lock or sizing."""
    from BaselineTrend4h import META_STOP_PRICE

    trade = FakeTrade(PAIR, amount=2.0, open_rate=100.0)
    trade.set_custom_data(META_STOP_PRICE, "90")
    _set_open_trades(monkeypatch, [trade])
    strategy.dp.book = good_book(mid=80.0)  # the position is down 20%

    ctx = strategy._gate_context(PAIR, NOW)

    assert ctx.equity.total == dec("800") + dec("2") * dec("80")  # 960, not 1000
    assert ctx.equity.is_usable
    assert ctx.open_position_risk_quote == dec("0")  # already below the stop: nothing more to lose to it
    assert ctx.pair_notional_quote == dec("160")


def test_audit_an_open_loss_trips_the_daily_lock_without_a_signal(strategy, monkeypatch, policy):
    from BaselineTrend4h import META_STOP_PRICE

    midnight = NOW.replace(hour=0, minute=1)
    _set_open_trades(monkeypatch, [])
    strategy._observe_limits(midnight)  # baseline 800 free, no positions
    assert strategy.store.get_period("day", midnight.replace(hour=0, minute=0)).starting_equity == dec("800")

    trade = FakeTrade(PAIR, amount=2.0, open_rate=100.0)
    trade.set_custom_data(META_STOP_PRICE, "90")
    strategy.wallets = FakeWallets(free=600.0)  # 200 went into the position
    _set_open_trades(monkeypatch, [trade])
    strategy.dp.book = good_book(mid=80.0)  # 600 + 160 = 760 -> -5% on the day, unrealised
    strategy._mark_cache.clear()

    strategy._observe_limits(midnight + timedelta(hours=3))

    kinds = {lock.kind for lock in strategy.store.active_locks(midnight + timedelta(hours=3))}
    assert LockKind.DAILY_LOSS in kinds


def test_audit_quote_in_a_resting_buy_is_not_double_counted(strategy, monkeypatch):
    trade = FakeTrade(PAIR, amount=2.0, open_rate=100.0, open_orders=[FakeOrder("buy", remaining=2.0, filled=0.0, status="open")])
    _set_open_trades(monkeypatch, [trade])
    ctx = strategy._gate_context(PAIR, NOW)
    assert ctx.equity.holdings_value == dec("0")
    assert ctx.equity.locked_quote == dec("200")
    assert ctx.equity.total == dec("1000")


def test_audit_entry_gates_are_enforced_not_hardcoded(strategy, monkeypatch, policy):
    _set_open_trades(monkeypatch, [])
    ok = strategy._gate_context(PAIR, NOW)
    assert ok.data_is_tradable and ok.liquidity_ok

    strategy.dp.book = good_book(spread_bps=40.0)
    wide = strategy._gate_context(PAIR, NOW)
    assert not wide.liquidity_ok and "spread" in wide.liquidity_detail

    strategy.dp.book = good_book(size=1.0)
    thin = strategy._gate_context(PAIR, NOW)
    assert not thin.liquidity_ok and "depth" in thin.liquidity_detail

    strategy.dp.book = None
    strategy.dp.book_error = RuntimeError("venue unreachable")
    strategy._mark_cache.clear()
    dark = strategy._gate_context(PAIR, NOW)
    assert not dark.liquidity_ok and "unavailable" in dark.liquidity_detail

    strategy.dp = FakeDP(make_dataframe(NOW - timedelta(hours=16)), book=good_book())
    stale = strategy._gate_context(PAIR, NOW)
    assert not stale.data_is_tradable


def test_audit_abandoned_reservations_are_swept_but_live_ones_are_kept(strategy, monkeypatch):
    """Finding: reservations freqtrade abandoned (timeout, refused stake,
    create_order error) held a slot for the life of the state file."""
    store = strategy.store
    old = NOW - timedelta(hours=2)
    store.try_reserve(intent_id="abandoned", pair="ETH/USDC", amount_base=dec("1"), risk_quote=dec("5"), notional_quote=dec("50"), risk_budget_remaining=dec("100"), notional_budget_remaining=dec("1000"), max_concurrent=3, existing_positions=0, now=old)
    store.try_reserve(intent_id="fresh", pair="SOL/USDC", amount_base=dec("1"), risk_quote=dec("5"), notional_quote=dec("50"), risk_budget_remaining=dec("100"), notional_budget_remaining=dec("1000"), max_concurrent=3, existing_positions=0, now=NOW - timedelta(minutes=10))
    store.try_reserve(intent_id="filling", pair=PAIR, amount_base=dec("1"), risk_quote=dec("5"), notional_quote=dec("50"), risk_budget_remaining=dec("100"), notional_budget_remaining=dec("1000"), max_concurrent=3, existing_positions=0, now=old)
    _set_open_trades(monkeypatch, [FakeTrade(PAIR, amount=1.0, open_rate=100.0, open_orders=[FakeOrder("buy", remaining=1.0, status="open")])])

    strategy._sweep_reservations(NOW)

    assert store.get_reservation("abandoned").state is ReservationState.RELEASED
    assert store.get_reservation("fresh").state is ReservationState.PENDING
    assert store.get_reservation("filling").state is ReservationState.PENDING


def test_audit_reconcile_accepts_the_bots_own_approved_position(strategy, monkeypatch):
    """Finding: reconcile compared freqtrade's positions with an EMPTY order
    ledger and flagged the bot's own first trade as foreign."""
    from BaselineTrend4h import META_INTENT

    strategy.store.set_state(BotState.RECONCILING, "start", NOW)
    trade = FakeTrade(PAIR, amount=1.0, open_rate=100.0)
    trade.set_custom_data(META_INTENT, "i1")
    _set_open_trades(monkeypatch, [trade])

    strategy._maybe_reconcile(NOW)

    assert strategy.store.get_state() is BotState.READY


def test_audit_reconcile_binds_a_stored_approval_after_a_restart_mid_fill(strategy, monkeypatch):
    from BaselineTrend4h import META_INTENT, META_STOP_PRICE

    store = strategy.store
    store.set_state(BotState.RECONCILING, "restart", NOW)
    store.try_reserve(intent_id="i1", pair=PAIR, amount_base=dec("1"), risk_quote=dec("5"), notional_quote=dec("100"), risk_budget_remaining=dec("100"), notional_budget_remaining=dec("1000"), max_concurrent=3, existing_positions=0, now=NOW)
    store.put_pending_entry(intent_id="i1", pair=PAIR, amount_base=dec("1"), entry_price=dec("100"), stop_price=dec("95"), atr=dec("2"), now=NOW)
    trade = FakeTrade(PAIR, amount=0.99999, open_rate=100.0)  # one step short, fully done
    _set_open_trades(monkeypatch, [trade])

    strategy._maybe_reconcile(NOW)

    assert trade.get_custom_data(META_INTENT) == "i1"
    assert dec(trade.get_custom_data(META_STOP_PRICE)) == dec("95")
    assert store.get_reservation("i1").state is ReservationState.FILLED
    assert store.get_pending_entry(PAIR) is None
    assert strategy.store.get_state() is BotState.READY


def test_audit_reconcile_flags_a_position_with_no_approval(strategy, monkeypatch):
    """The fail-open path (freqtrade traded the proposed stake) shows up as a
    position without any approval record. That IS an operator case."""
    strategy.store.set_state(BotState.RECONCILING, "start", NOW)
    _set_open_trades(monkeypatch, [FakeTrade(PAIR, amount=1.0, open_rate=100.0)])

    strategy._maybe_reconcile(NOW)

    assert strategy.store.get_state() is BotState.RECOVERY_REQUIRED


def test_audit_stop_exits_feed_the_consecutive_stop_lock_and_pair_cooldown(strategy, monkeypatch, policy):
    """Finding: record_stop and PAIR_COOLDOWN had no callers; two policy
    limits were inert."""
    store = strategy.store
    for n, pair in enumerate(["BTC/USDC", "ETH/USDC", "SOL/USDC"]):
        trade = FakeTrade(pair, amount=1.0, open_rate=100.0, is_open=False, exit_reason="stop_loss")
        strategy.order_filled(pair, trade, FakeOrder("sell", filled=1.0), NOW + timedelta(minutes=n))

    assert store.consecutive_stops() == 3
    cooldowns = [lock for lock in store.active_locks(NOW + timedelta(minutes=5)) if lock.kind is LockKind.PAIR_COOLDOWN]
    assert {lock.pair for lock in cooldowns} == {"BTC/USDC", "ETH/USDC", "SOL/USDC"}
    assert cooldowns[0].expires_at == NOW + timedelta(hours=8)

    _set_open_trades(monkeypatch, [])
    breaches = strategy.gate.observe(strategy._gate_context(None, NOW + timedelta(minutes=5)))
    assert "CONSECUTIVE_STOPS" in breaches

    # A non-stop exit resets the counter.
    strategy.order_filled(PAIR, FakeTrade(PAIR, 1.0, 100.0, is_open=False, exit_reason="exit_signal"), FakeOrder("sell", filled=1.0), NOW + timedelta(hours=30))
    assert store.consecutive_stops() == 0


def test_audit_approval_survives_between_callbacks_and_binds_by_pair(strategy, monkeypatch):
    """Findings: the approved stop lived in process dicts keyed by a
    wall-clock second, so a restart or a stamp mismatch lost it, and the
    fallback scan attached an OLDER trade's stop."""
    from BaselineTrend4h import META_INTENT, META_STOP_PRICE

    _set_open_trades(monkeypatch, [])
    monkeypatch.setattr(strategy, "_market_limits", lambda pair: {"amount_step": dec("0.00001"), "min_amount": dec("0.00001"), "min_cost": dec("10")})
    stake = strategy.custom_stake_amount(pair=PAIR, current_time=NOW, current_rate=100.0, proposed_stake=250.0, min_stake=10.0, max_stake=1000.0, leverage=1.0, entry_tag="trend_start", side="long")
    assert stake > 0
    pending = strategy.store.get_pending_entry(PAIR)
    assert pending is not None and pending["stop_price"] == dec("95")  # 100 - 2.5 * ATR 2

    # A different wall-clock second in the next callback changes nothing.
    assert strategy.confirm_trade_entry(pair=PAIR, order_type="limit", amount=float(pending["amount"]), rate=100.0, time_in_force="GTC", current_time=NOW + timedelta(seconds=7), entry_tag="trend_start", side="long")

    trade = FakeTrade(PAIR, amount=float(pending["amount"]) * 0.9999, open_rate=100.0)
    strategy.order_filled(PAIR, trade, FakeOrder("buy", filled=trade.amount), NOW + timedelta(minutes=3))
    assert dec(trade.get_custom_data(META_STOP_PRICE)) == dec("95")
    assert trade.get_custom_data(META_INTENT) == pending["intent_id"]
    assert strategy.store.get_reservation(pending["intent_id"]).state is ReservationState.FILLED
    assert strategy.store.get_pending_entry(PAIR) is None


def test_audit_a_gate_error_in_confirm_trade_entry_releases_the_reservation(strategy, monkeypatch):
    _set_open_trades(monkeypatch, [])
    store = strategy.store
    store.try_reserve(intent_id="i1", pair=PAIR, amount_base=dec("1"), risk_quote=dec("5"), notional_quote=dec("100"), risk_budget_remaining=dec("100"), notional_budget_remaining=dec("1000"), max_concurrent=3, existing_positions=0, now=NOW)
    store.put_pending_entry(intent_id="i1", pair=PAIR, amount_base=dec("1"), entry_price=dec("100"), stop_price=dec("95"), atr=dec("2"), now=NOW)
    monkeypatch.setattr(strategy, "_gate_context", lambda pair, now: (_ for _ in ()).throw(RuntimeError("boom")))

    assert strategy.confirm_trade_entry(pair=PAIR, order_type="limit", amount=1.0, rate=100.0, time_in_force="GTC", current_time=NOW, entry_tag=None, side="long") is False
    assert store.get_reservation("i1").state is ReservationState.RELEASED


def test_audit_losing_the_writer_lock_calls_an_operator_and_keeps_exits(strategy, monkeypatch):
    store = strategy.store
    strategy._writer_lock_owner = "me"
    store.acquire_writer_lock("me", NOW)
    store.acquire_writer_lock("intruder", NOW + timedelta(seconds=1), force=True)

    strategy._renew_writer_lock(NOW + timedelta(seconds=2))

    state = store.get_state()
    assert state is BotState.RECOVERY_REQUIRED
    assert state.exits_managed


# --------------------------------------------------------------------------
# Launcher and safe-run
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "overlay, path",
    [
        ({"exchange": {"ccxt_config": {"privateKey": "0x" + "ab" * 32}}}, "exchange.ccxt_config.privateKey"),
        ({"exchange": {"ccxt_async_config": {"walletAddress": "0x" + "cd" * 20}}}, "exchange.ccxt_async_config.walletAddress"),
        ({"exchange": {"apiKey": "k"}}, "exchange.apiKey"),
        ({"exchange": {"api_key": "k"}}, "exchange.api_key"),
        ({"exchange": {"accountId": "a"}}, "exchange.accountId"),
        ({"exchange": {"ccxt_config": {"headers": {"Authorization": "Bearer x"}}}}, "exchange.ccxt_config.headers.Authorization"),
    ],
)
def test_audit_credentials_nested_under_the_exchange_section_are_refused(tmp_path, overlay, path):
    """Finding: only eight top-level names were checked; a privateKey under
    exchange.ccxt_config passed as 'keyless' and reached ccxt's signer."""
    import json

    from kripto.launcher import audit_config, build_effective_config

    extra = tmp_path / "overlay.json"
    extra.write_text(json.dumps(overlay))
    config = build_effective_config([str(ROOT / "config" / "config.dry.json"), str(extra)], environ={})
    audit = audit_config(config, environ={}, config_files=["a", "b"])
    assert any(path in v for v in audit.violations), audit.violations


def test_audit_non_secret_nested_exchange_settings_are_still_allowed():
    from kripto.launcher import audit_config, build_effective_config

    config = build_effective_config(
        [str(ROOT / "config" / "config.dry.json"), str(ROOT / "config" / "proxy-overlay.json")], environ={}
    )
    audit = audit_config(config, environ={}, config_files=["a", "b"])
    assert audit.safe, audit.violations


def _safe_run():
    import importlib.util

    spec = importlib.util.spec_from_file_location("kripto_safe_run", ROOT / "scripts" / "safe-run.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(
    "argv, expected",
    [
        (["show-config", "-c", "a.json"], ["a.json"]),
        (["show-config", "-ca.json"], ["a.json"]),
        (["show-config", "--conf", "a.json", "--con", "b.json"], ["a.json", "b.json"]),
        (["show-config", "--config=a.json"], ["a.json"]),
    ],
)
def test_audit_every_config_spelling_freqtrade_accepts_is_audited(argv, expected):
    """Finding: --conf, --co and -cX were accepted by freqtrade but invisible
    to the audit, so an unaudited overlay could be merged in."""
    module = _safe_run()
    paths, forwarded = module.resolve_configs(argv)
    assert paths == expected
    assert forwarded == argv


def test_audit_no_config_means_the_shipped_dry_run_config_is_forwarded():
    """Finding: with no --config the audit read config/config.dry.json while
    freqtrade loaded ./config.json or user_data/config.json."""
    module = _safe_run()
    paths, forwarded = module.resolve_configs(["show-config"])
    assert paths == [str(module.DEFAULT_CONFIG)]
    assert forwarded[-2:] == ["--config", str(module.DEFAULT_CONFIG)]


def test_audit_bad_arguments_never_exit_zero(capsys):
    """Finding: freqtrade's main() turned an argparse error into exit 0."""
    module = _safe_run()
    assert module.main(["lookahead-analysis", "--bogus"]) == 2
    assert module.main(["new-config"]) == 2


def test_audit_analysis_commands_do_not_get_a_cache_flag_they_reject():
    module = _safe_run()
    assert "lookahead-analysis" not in module.UNCACHED_COMMANDS
    assert "recursive-analysis" not in module.UNCACHED_COMMANDS
    assert "backtesting" in module.UNCACHED_COMMANDS


# --------------------------------------------------------------------------
# Data collection
# --------------------------------------------------------------------------


def test_audit_the_forming_candle_is_never_persisted(tmp_path):
    """Finding: the window ended at now, so the still-forming candle was
    written as history and could be frozen there for good."""
    from test_collector import FakeClient, MARKET, NOW as COLLECT_NOW, STEP
    from kripto.data.collector import Collector
    from kripto.data.store import read_candles

    # The last candle opened at COLLECT_NOW; one hour later it is still forming.
    client = FakeClient(total_candles=100, last_open=COLLECT_NOW)
    result = Collector(client, tmp_path, now=COLLECT_NOW + timedelta(hours=1)).collect(MARKET, PAIR, "4h")

    stored = read_candles(tmp_path / "BTC_USDC-4h.feather")
    assert stored is not None, result.notes
    assert stored["date"].iloc[-1].to_pydatetime() == COLLECT_NOW - STEP
    assert len(stored) == 99
    assert any("still-forming" in n for n in result.notes)


def test_audit_a_stored_tail_that_cannot_be_reverified_is_dropped(tmp_path):
    from test_collector import FakeClient, MARKET, NOW as COLLECT_NOW, STEP
    from kripto.data.collector import Collector
    from kripto.data.store import atomic_write, read_candles

    client = FakeClient(total_candles=6000, last_open=COLLECT_NOW)
    first_run = Collector(client, tmp_path, now=COLLECT_NOW - 5500 * STEP)
    first_run.collect(MARKET, PAIR, "4h")
    stored = read_candles(tmp_path / "BTC_USDC-4h.feather")
    stored_last = stored["date"].iloc[-1]
    # Corrupt the stored last candle the way a forming write would have.
    stored.loc[stored.index[-1], "close"] = 1e9
    atomic_write(stored, tmp_path / "BTC_USDC-4h.feather")

    # Much later: the tail fetch (capped) does not reach back to stored_last.
    result = Collector(client, tmp_path, now=COLLECT_NOW).collect(MARKET, PAIR, "4h")

    after = read_candles(tmp_path / "BTC_USDC-4h.feather")
    assert (after["close"] == 1e9).sum() == 0, "the unverifiable candle must not survive"
    assert any("could not be re-verified" in n for n in result.notes)
    assert result.history_truncated_by_api is False
    assert any(n.startswith("tail fetch hit the per-call cap") for n in result.notes)


def test_audit_manifest_keeps_other_timeframes_records(tmp_path):
    """Finding: a run for one timeframe replaced the whole manifest."""
    from kripto.data.manifest import build_manifest, read_manifest, write_manifest

    path = tmp_path / "manifest.json"
    full = build_manifest(exchange="hyperliquid", source_url="x", results=[
        {"pair": PAIR, "timeframe": "4h", "file_hash": "h4"},
        {"pair": PAIR, "timeframe": "1h", "file_hash": "h1"},
    ], markets={"@142": {"a": 1}})
    write_manifest(full, path)
    partial = build_manifest(exchange="hyperliquid", source_url="x", results=[
        {"pair": PAIR, "timeframe": "4h", "file_hash": "h4-new"},
    ], markets={"@142": {"a": 2}})
    write_manifest(partial, path)

    merged = read_manifest(path)
    by_key = {(c["pair"], c["timeframe"]): c for c in merged["coverage"]}
    assert by_key[(PAIR, "4h")]["file_hash"] == "h4-new"
    assert by_key[(PAIR, "1h")]["file_hash"] == "h1"
    assert by_key[(PAIR, "1h")]["collected_at"] == full["generated_at"]
    assert merged["markets"]["@142"]["a"] == 2


def test_audit_pinned_market_ids_assert_their_token():
    import re

    source = (ROOT / "scripts" / "collect-data.py").read_text()
    assert re.search(r'EXPECTED_BASE_TOKENS = \{"@142": "UBTC", "@151": "UETH", "@156": "USOL"\}', source)
    assert "market.base_token != expected_token" in source


def test_audit_fatal_candle_quality_bars_the_pair_in_dry_run(strategy, monkeypatch):
    """Finding: quality.py's FATAL verdict only ever protected the offline
    files; the dataframe the bot traded on was never checked."""
    _set_open_trades(monkeypatch, [])
    last_open = datetime(2026, 9, 19, 8, 0, tzinfo=timezone.utc)
    frame = make_dataframe(last_open)
    frame["open"] = frame["close"]
    frame["high"] = frame["close"] + 1
    frame["low"] = frame["close"] - 1
    frame.loc[frame.index[-1], "low"] = frame.loc[frame.index[-1], "high"] + 5  # low above high
    strategy.dp = FakeDP(frame, book=good_book())

    ctx = strategy._gate_context(PAIR, NOW)

    assert not ctx.data_is_tradable
    assert "FATAL" in ctx.liquidity_detail


# --------------------------------------------------------------------------
# Second round of strategy findings
# --------------------------------------------------------------------------


def test_audit_a_restart_after_downtime_does_not_lock_the_bot_out(strategy, monkeypatch):
    """Finding: on the first loop the in-process watchdog judged the PREVIOUS
    process's heartbeat; >5 min of downtime meant permanent RECOVERY_REQUIRED."""
    from kripto.ops.health import HealthRecorder

    store = strategy.store
    HealthRecorder(store).heartbeat(NOW - timedelta(minutes=10))  # the old process
    store.set_state(BotState.RECONCILING, "restart", NOW)
    _set_open_trades(monkeypatch, [])

    strategy.bot_loop_start(current_time=NOW)

    assert store.get_state() is not BotState.RECOVERY_REQUIRED
    from kripto.ops.health import LOOP_HEARTBEAT, read_signal

    assert read_signal(store._conn, LOOP_HEARTBEAT).observed_at == NOW
    assert strategy._loops_completed == 1


def test_audit_after_its_first_loop_a_stuck_loop_is_still_caught(strategy, monkeypatch):
    from kripto.ops.watchdog import Action, Check, HealthReport, Level

    strategy._loops_completed = 3
    stuck = HealthReport(checks=[Check("loop_heartbeat", Level.CRITICAL, "stuck", Action.OPERATOR_REQUIRED)])
    monkeypatch.setattr(strategy.watchdog, "run", lambda now=None: stuck)
    _set_open_trades(monkeypatch, [])

    strategy.bot_loop_start(current_time=NOW)

    assert strategy.store.get_state() is BotState.RECOVERY_REQUIRED


def test_audit_simulated_runs_size_and_mark_from_closed_candles_only(tmp_path, monkeypatch):
    """Finding: in backtesting the dataframe's last row is the candle being
    traded, so ATR, stop, size and mark price used up to 4h of future data."""
    import sys

    sys.path.insert(0, str(ROOT / "user_data" / "strategies"))
    from BaselineTrend4h import BaselineTrend4h

    strat = BaselineTrend4h({"runmode": "backtest", "stake_currency": "USDC", "timeframe": "4h"})
    strat._store = RiskStore(tmp_path / "risk.sqlite")
    frame = make_dataframe(NOW, n=5)  # last row opens AT now: the traded candle
    frame.loc[frame.index[-1], "atr"] = 99.0
    frame.loc[frame.index[-1], "close"] = 500.0
    strat.dp = FakeDP(frame)

    atr, stop, candle_time = strat._current_atr_and_stop(PAIR, dec("100"), NOW)
    assert atr == dec("2") and stop == dec("95")
    assert candle_time == NOW - timedelta(hours=4)
    mark, _ = strat._mark_price(PAIR, NOW, fallback=dec("1"))
    assert mark == dec("100")
    strat._store.close()


def test_audit_dry_run_last_closed_candle_is_still_used(strategy):
    last_open = datetime(2026, 9, 19, 8, 0, tzinfo=timezone.utc)  # closed 12:00 = NOW
    atr, stop, candle_time = strategy._current_atr_and_stop(PAIR, dec("100"), NOW)
    assert candle_time == last_open and stop == dec("95")


def test_audit_three_stops_lock_for_a_day_not_for_ever(store, policy):
    """Finding: the stop counter never decayed, so the expired 24h lock was
    re-created on every loop until the end of time."""
    gate = EntryGate(store, policy)
    for _ in range(3):
        store.record_stop(PAIR, NOW)

    assert "CONSECUTIVE_STOPS" in gate.observe(_ctx("1000", NOW))
    assert store.consecutive_stops() == 0
    later = NOW + timedelta(hours=25)
    assert gate.observe(_ctx("1000", later)) == []
    assert not [lock for lock in store.active_locks(later) if lock.kind is LockKind.CONSECUTIVE_STOPS]


def test_audit_reconcile_does_not_mark_a_resting_entry_as_filled(strategy, monkeypatch):
    """Finding: Trade.amount is the REQUESTED amount, so a resting order was
    bound as FILLED and its budget released while nothing had bought."""
    from BaselineTrend4h import META_INTENT

    store = strategy.store
    store.set_state(BotState.RECONCILING, "restart", NOW)
    store.try_reserve(intent_id="i1", pair=PAIR, amount_base=dec("0.01"), risk_quote=dec("5"), notional_quote=dec("100"), risk_budget_remaining=dec("100"), notional_budget_remaining=dec("1000"), max_concurrent=3, existing_positions=0, now=NOW)
    store.put_pending_entry(intent_id="i1", pair=PAIR, amount_base=dec("0.01"), entry_price=dec("100"), stop_price=dec("95"), atr=dec("2"), now=NOW)
    resting = FakeTrade(PAIR, amount=0.01, open_rate=100.0, open_orders=[FakeOrder("buy", remaining=0.01, filled=0.0, status="open")])
    _set_open_trades(monkeypatch, [resting])

    strategy._maybe_reconcile(NOW)

    assert resting.get_custom_data(META_INTENT) == "i1"
    assert store.get_reservation("i1").state is ReservationState.PENDING
    assert store.reserved_risk() == dec("5")


def test_audit_a_pair_cooldown_does_not_hold_the_whole_bot_paused(strategy, monkeypatch):
    """Finding: the recovery check counted pair-scoped locks, so a BTC
    cooldown kept ETH and SOL refused with STATE_BLOCKS_ENTRY."""
    from kripto.ops.watchdog import HealthReport

    store = strategy.store
    store.set_state(BotState.ENTRY_PAUSED, "book was stale", NOW)
    store.add_lock(LockKind.PAIR_COOLDOWN, "cooldown", NOW, expires_at=NOW + timedelta(hours=8), pair=PAIR)
    strategy._loops_completed = 2
    monkeypatch.setattr(strategy.watchdog, "run", lambda now=None: HealthReport(checks=[]))
    _set_open_trades(monkeypatch, [])

    strategy.bot_loop_start(current_time=NOW + timedelta(minutes=1))

    assert store.get_state() is BotState.READY

    store.add_lock(LockKind.DAILY_LOSS, "portfolio", NOW, expires_at=NOW + timedelta(days=1))
    store.set_state(BotState.ENTRY_PAUSED, "again", NOW)
    strategy.bot_loop_start(current_time=NOW + timedelta(minutes=2))
    assert store.get_state() is BotState.ENTRY_PAUSED


# --------------------------------------------------------------------------
# Operations findings
# --------------------------------------------------------------------------


def test_audit_monitoring_never_rewrites_recovery_required(strategy, monkeypatch):
    """Finding: HALT_ENTRIES overwrote RECOVERY_REQUIRED with ENTRY_PAUSED and
    the auto-recovery then promoted an unreconciled bot to READY."""
    from kripto.ops.watchdog import Action, Check, HealthReport, Level

    store = strategy.store
    store.set_state(BotState.RECOVERY_REQUIRED, "reconciliation incomplete", NOW)
    strategy._loops_completed = 2
    _set_open_trades(monkeypatch, [])
    monkeypatch.setattr(strategy, "_maybe_reconcile", lambda now: None)

    halt = HealthReport(checks=[Check("orderbook", Level.CRITICAL, "stale", Action.HALT_ENTRIES)])
    monkeypatch.setattr(strategy.watchdog, "run", lambda now=None: halt)
    strategy.bot_loop_start(current_time=NOW + timedelta(minutes=1))
    assert store.get_state() is BotState.RECOVERY_REQUIRED

    monkeypatch.setattr(strategy.watchdog, "run", lambda now=None: HealthReport(checks=[]))
    strategy.bot_loop_start(current_time=NOW + timedelta(minutes=2))
    assert store.get_state() is BotState.RECOVERY_REQUIRED, "only an operator clears this"


def test_audit_monitoring_pauses_only_a_ready_bot(strategy, monkeypatch):
    from kripto.ops.watchdog import Action, Check, HealthReport, Level

    store = strategy.store
    strategy._loops_completed = 2
    _set_open_trades(monkeypatch, [])
    monkeypatch.setattr(strategy, "_maybe_reconcile", lambda now: None)
    halt = HealthReport(checks=[Check("orderbook", Level.CRITICAL, "stale", Action.HALT_ENTRIES)])
    monkeypatch.setattr(strategy.watchdog, "run", lambda now=None: halt)

    store.set_state(BotState.RECONCILING, "start", NOW)
    strategy.bot_loop_start(current_time=NOW)
    assert store.get_state() is BotState.RECONCILING

    store.set_state(BotState.READY, "ok", NOW)
    strategy.bot_loop_start(current_time=NOW)
    assert store.get_state() is BotState.ENTRY_PAUSED


def test_audit_clock_skew_sample_is_stamped_when_taken(strategy, monkeypatch):
    """Finding: the sample carried the loop-start time, so seconds spent on
    the order-book fetch (and its backoff) were reported as clock skew."""
    from kripto.ops.health import EXCHANGE_TIME, read_signal

    class Api:
        has = {"fetchTime": True}

        def fetch_time(self):
            return int((NOW + timedelta(seconds=12)).timestamp() * 1000)  # venue clock == wall clock

    strategy.dp._exchange = SimpleNamespace(_api=Api())
    real_now = datetime.now

    class FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return NOW + timedelta(seconds=12)  # 12s into the loop, after the book fetch

    monkeypatch.setattr("BaselineTrend4h.datetime", FrozenDatetime)

    strategy._sample_exchange_time(NOW)  # loop started at NOW

    signal = read_signal(strategy.store._conn, EXCHANGE_TIME)
    assert signal.observed_at == NOW + timedelta(seconds=12)
    assert datetime.fromisoformat(signal.value) == signal.observed_at  # zero skew, not 12s
    del real_now


def test_audit_backup_rotates_only_after_a_verified_backup(tmp_path, backup_module_for_audit):
    """Finding: rotation ran before --verify, so a failing new backup could
    delete the only verified one."""
    module = backup_module_for_audit
    state_dir = tmp_path / "state"
    state_dir.mkdir()
    store = RiskStore(state_dir / "risk_state.sqlite")
    store.set_state(BotState.READY, "test", NOW)
    store.close()
    out = tmp_path / "backups"
    args = ["--state-dir", str(state_dir), "--config-dir", str(ROOT / "config"), "--out", str(out), "--keep", "1", "--verify"]
    assert module.main(args) == 0
    first = sorted(p for p in out.iterdir() if p.is_dir())[0]

    real_verify = module.verify_backup
    module.verify_backup = lambda path: False
    try:
        assert module.main(args) == 1
    finally:
        module.verify_backup = real_verify

    assert first.is_dir(), "the verified backup was rotated out by a failing one"


def test_audit_backup_row_counts_come_from_the_source_and_cover_every_table(tmp_path, backup_module_for_audit):
    import json

    module = backup_module_for_audit
    state_dir = tmp_path / "state"
    state_dir.mkdir()
    store = RiskStore(state_dir / "risk_state.sqlite")
    store.set_state(BotState.READY, "test", NOW)
    store.put_pending_entry(intent_id="a", pair=PAIR, amount_base=dec("1"), entry_price=dec("100"), stop_price=dec("95"), atr=dec("2"), now=NOW)
    store.close()
    out = module.take_backup(SimpleNamespace(out=tmp_path / "backups", state_dir=state_dir, config_dir=ROOT / "config"))
    manifest = json.loads((out / "manifest.json").read_text())
    info = manifest["databases"]["risk_state.sqlite"]
    assert info["row_counts"]["pending_entries"] == 1
    assert "writer_lock" in info["row_counts"] and "meta" in info["row_counts"]
    assert info["source_changed_during_snapshot"] is False
    assert module.verify_backup(out) is True

    # A restored copy that does not match the source counts fails.
    info["row_counts"]["pending_entries"] = 5
    info["source_row_counts_before_snapshot"]["pending_entries"] = 5
    (out / "manifest.json").write_text(json.dumps(manifest))
    conn = sqlite3.connect(str(out / "risk_state.sqlite"))
    manifest["databases"]["risk_state.sqlite"]["hash"] = module.file_hash(out / "risk_state.sqlite")
    conn.close()
    (out / "manifest.json").write_text(json.dumps(manifest))
    assert module.verify_backup(out) is False


@pytest.fixture
def backup_module_for_audit():
    import importlib.util

    spec = importlib.util.spec_from_file_location("kripto_backup_audit", ROOT / "scripts" / "backup.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_audit_deadman_mask_hides_userinfo_and_token_hostnames():
    import importlib.util

    spec = importlib.util.spec_from_file_location("kripto_deadman_audit", ROOT / "scripts" / "deadman.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert "SECRETTOKEN" not in module.mask("https://apikey:SECRETTOKEN@monitor.example/ping")
    assert "SECRETTOKEN" not in module.mask("https://SECRETTOKEN.hc.example/")
    assert module.mask("https://hc.example/ping/abc") == "https://hc.example/***"


@pytest.mark.parametrize(
    "text, secret",
    [
        ("url: /api/webhooks/123456789012345678/AbCdEfGhIjKlMnOpQrStUvWxYz-_0123456789 on discord.com/api/webhooks/123456789012345678/AbCdEfGhIjKlMnOpQrStUvWxYz-_0123456789", "AbCdEfGhIjKlMnOpQrStUvWxYz-_0123456789"),
        ("hooks.slack.com/services/T0000/B0000/XXXXXXXXXXXXXXXXXXXXXXXX", "XXXXXXXXXXXXXXXXXXXXXXXX"),
        ("https://hc.example/ping/3f2a9b1c-1234-4abc-9def-0123456789ab", "3f2a9b1c-1234-4abc-9def-0123456789ab"),
        ("api.telegram.org/bot123456789:AAHfExampleTokenValue-xyz_0123456789012/sendMessage", "AAHfExampleTokenValue"),
    ],
)
def test_audit_webhook_capabilities_in_urls_are_redacted(text, secret):
    from kripto.redact import redact_text

    assert secret not in redact_text(text)


def test_audit_handlers_added_after_install_still_redact(capsys):
    """Finding: the root-logger filter never saw records from child loggers
    once freqtrade attached its own handlers."""
    import io
    import logging

    from kripto.redact import install_redaction

    install_redaction()
    stream = io.StringIO()
    late = logging.StreamHandler(stream)  # added AFTER install, no filter of its own
    child = logging.getLogger("kripto.audit.child")
    child.propagate = False
    child.addHandler(late)
    child.setLevel(logging.INFO)
    try:
        child.error("transport failed: url: /bot123456789:AAHfSecretTokenValue-xyz_0123456789012/sendMessage")
        try:
            raise ConnectionError("https://hooks.slack.com/services/T1/B1/SECRETSLACKTOKENVALUE")
        except ConnectionError:
            child.exception("delivery failed")
    finally:
        child.removeHandler(late)
    out = stream.getvalue()
    assert "AAHfSecretTokenValue" not in out
    assert "SECRETSLACKTOKENVALUE" not in out
    assert "REDACTED" in out


# --------------------------------------------------------------------------
# Reports findings
# --------------------------------------------------------------------------


def test_audit_weekly_report_period_starts_where_the_baseline_does(tmp_path, policy):
    """Finding: the baseline was the 00:00 day row while trades were summed
    from the nominal 06:00 start, so trades closed in between vanished."""
    from kripto.report.weekly import build_report

    store = RiskStore(tmp_path / "risk.sqlite")
    monday = datetime(2026, 9, 14, 0, 0, tzinfo=timezone.utc)
    store.open_period("day", monday, dec("1000"), monday)
    report = build_report(
        store=store, db_url="sqlite:///" + str(tmp_path / "missing.sqlite"), policy=policy,
        start=monday + timedelta(hours=6), end=monday + timedelta(days=7, hours=6),
        mode="dry_run", manifest_path=tmp_path / "none.json",
    )
    assert report.period_start == monday
    assert report.equity_start == dec("1000")
    store.close()


def test_audit_weekly_report_does_not_read_a_missing_ledger_as_no_trades(tmp_path, policy):
    from kripto.report.weekly import Assessment, build_report, render_markdown

    store = RiskStore(tmp_path / "risk.sqlite")
    start = datetime(2026, 8, 1, tzinfo=timezone.utc)
    report = build_report(
        store=store, db_url="sqlite:///" + str(tmp_path / "typo.sqlite"), policy=policy,
        start=start, end=start + timedelta(days=35), mode="dry_run",
        manifest_path=tmp_path / "none.json", observation_started=start - timedelta(days=60),
    )
    assert report.trades.error and "not found" in report.trades.error
    assert not (tmp_path / "typo.sqlite").exists(), "reporting must never create a ledger"
    assert report.assessment is Assessment.INSUFFICIENT_EVIDENCE
    text = render_markdown(report)
    assert "REPORT INCOMPLETE" in text
    assert "That is a result" not in text
    store.close()


def test_audit_weekly_drawdown_is_the_worst_point_on_the_path(tmp_path, policy, monkeypatch):
    """Finding: only the end-of-period drop was reported, so a mid-week 14%
    dip that recovered showed as 3%."""
    from kripto.report import weekly

    store = RiskStore(tmp_path / "risk.sqlite")
    start = datetime(2026, 8, 3, tzinfo=timezone.utc)
    store.open_period("day", start, dec("1000"), start)
    store.update_peak_equity(dec("1000"), start)

    def fake_collect(db_url, s, e):
        stats = weekly.TradeStats()
        pnls = [dec("-60"), dec("-50"), dec("-40"), dec("+80"), dec("+120")]
        for i, pnl in enumerate(pnls):
            stats.closed += 1
            stats.realised_pnl += pnl
            stats.closed_pnls.append((start + timedelta(days=i + 1), pnl))
            if pnl >= 0:
                stats.wins += 1
                stats.gross_profit += pnl
            else:
                stats.losses += 1
                stats.gross_loss += pnl
        return stats

    monkeypatch.setattr(weekly, "collect_trades", fake_collect)
    report = weekly.build_report(
        store=store, db_url="sqlite:///x", policy=policy, start=start,
        end=start + timedelta(days=7), mode="dry_run", manifest_path=tmp_path / "none.json",
    )
    assert report.equity_end == dec("1050")
    assert report.max_drawdown == dec("0.15")  # 1000 -> 850 on the way
    store.close()


def test_audit_weekly_drawdown_lock_in_period_rejects(tmp_path, policy):
    from kripto.report.weekly import Assessment, build_report

    from freqtrade.persistence import init_db

    store = RiskStore(tmp_path / "risk.sqlite")
    start = datetime(2026, 8, 3, tzinfo=timezone.utc)
    store.open_period("day", start, dec("1000"), start)
    store.add_lock(LockKind.MAX_DRAWDOWN, "drawdown 0.12", start + timedelta(days=2), expires_at=None)
    db_url = "sqlite:///" + str(tmp_path / "trades.sqlite")
    init_db(db_url)  # a real, empty ledger
    report = build_report(
        store=store, db_url=db_url, policy=policy,
        start=start, end=start + timedelta(days=7), mode="dry_run",
        manifest_path=tmp_path / "none.json", observation_started=start - timedelta(days=60),
    )
    assert report.trades.error is None
    assert report.drawdown_lock_raised
    # Too few trades to conclude, but the lock is named in the reasons.
    assert report.assessment is Assessment.INSUFFICIENT_EVIDENCE
    assert any("MAX_DRAWDOWN lock fired" in r for r in report.assessment_reasons)
    store.close()


def test_audit_dashboard_drawdown_is_mark_to_market():
    import importlib.util

    spec = importlib.util.spec_from_file_location("kripto_dashboard_audit", ROOT / "scripts" / "dashboard.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    source = (ROOT / "scripts" / "dashboard.py").read_text()
    assert "closed_trade_max_dd_pct" in source
    assert "running_peak = totals.cummax()" in source
    template = (ROOT / "src" / "kripto" / "report" / "dashboard_template.html").read_text()
    assert "eşik %10 — geçti', cls: 'pos' }" not in template, "the drawdown verdict must be computed, not hard-coded"


def test_audit_secret_overlays_and_stray_configs_are_ignored_by_git():
    import subprocess

    for name in ("config/telegram.local.json", "config/telegram.json", "config.json", "user_data/config.json"):
        result = subprocess.run(
            ["git", "check-ignore", "-q", name], cwd=ROOT, capture_output=True
        )
        assert result.returncode == 0, f"{name} is not git-ignored"


# --------------------------------------------------------------------------
# Test-quality findings
# --------------------------------------------------------------------------


def test_audit_reconcile_flags_foreign_orders_and_positions(store):
    """T14's claim had no test: an order or position the bot never placed
    must be reported and never adopted."""
    ledger = OrderLedger(store)
    result = ledger.reconcile(
        open_orders=[{"id": "X9", "clientOrderId": "someone-else", "filled": 0, "amount": 1, "status": "open"}],
        recent_fills=[], known_positions={"DOGE/USDC"}, now=NOW,
    )
    assert not result.consistent and result.requires_operator
    assert result.unrecognised_orders == ["X9"]
    assert result.unrecognised_positions == ["DOGE/USDC"]
    assert any("NOT adopted" in n for n in result.notes)
    assert ledger.all_orders() == [], "nothing was adopted into the ledger"


def test_audit_a_gap_through_the_stop_exits_at_the_next_tick(strategy):
    """The production behaviour behind T16's gap scenario: a price already
    below the stored stop makes custom_stoploss return the tightest ratio so
    freqtrade exits now; no stop recorded means the hard backstop."""
    from BaselineTrend4h import META_STOP_PRICE

    trade = FakeTrade(PAIR, amount=1.0, open_rate=100.0)
    trade.set_custom_data(META_STOP_PRICE, "95")
    gapped = strategy.custom_stoploss(pair=PAIR, trade=trade, current_time=NOW, current_rate=80.0, current_profit=-0.2, after_fill=False)
    assert gapped == -0.0001
    normal = strategy.custom_stoploss(pair=PAIR, trade=trade, current_time=NOW, current_rate=100.0, current_profit=0.0, after_fill=False)
    assert -0.06 < normal < -0.04
    unbound = FakeTrade(PAIR, amount=1.0, open_rate=100.0)
    assert strategy.custom_stoploss(pair=PAIR, trade=unbound, current_time=NOW, current_rate=100.0, current_profit=0.0, after_fill=False) is None
