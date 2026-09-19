"""T06, T07, T12, T13 - budgets, reservations, locks and restart safety."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from kripto.money import dec
from kripto.policy import load_policy
from kripto.risk.equity import (
    AssetHolding,
    compute_equity,
    drawdown_from_peak,
    period_loss_fraction,
)
from kripto.risk.gate import EntryGate, GateContext
from kripto.risk.state import (
    BotState,
    LockKind,
    ReservationState,
    RiskStore,
    utc_day_start,
    utc_week_start,
)

NOW = datetime(2026, 9, 17, 12, 0, tzinfo=timezone.utc)


@pytest.fixture
def policy():
    return load_policy("config/policy.yaml")


@pytest.fixture
def store(tmp_path):
    s = RiskStore(tmp_path / "risk.sqlite")
    s.set_state(BotState.READY, "test", NOW)
    yield s
    s.close()


@pytest.fixture
def gate(store, policy):
    return EntryGate(store, policy)


def make_ctx(
    *, equity_total="1000", free="1000", holdings_value="0", open_positions=0,
    open_risk="0", pair_notional="0", now=NOW, stale=(),
):
    snapshot = compute_equity(
        free_quote=dec(free),
        locked_quote=dec("0"),
        holdings=(
            [AssetHolding("BTC", dec(holdings_value), dec("1"), 0.0)]
            if dec(holdings_value) > 0
            else []
        ),
        max_price_age_seconds=900,
    )
    # Force a specific total when the test wants an equity that differs from
    # the wallet split (e.g. an open position that has lost value).
    if dec(equity_total) != snapshot.total:
        from dataclasses import replace

        snapshot = replace(snapshot, total=dec(equity_total), stale_prices=list(stale))
    elif stale:
        from dataclasses import replace

        snapshot = replace(snapshot, stale_prices=list(stale))

    return GateContext(
        now=now,
        equity=snapshot,
        open_positions=open_positions,
        open_position_risk_quote=dec(open_risk),
        pair_notional_quote=dec(pair_notional),
        data_is_tradable=True,
        liquidity_ok=True,
    )


def entry(gate, ctx, intent_id="i1", pair="BTC/USDC", entry_price="100", stop_price="90"):
    return gate.evaluate_entry(
        pair=pair,
        intent_id=intent_id,
        entry_price=dec(entry_price),
        stop_price=dec(stop_price),
        amount_step=dec("0.00001"),
        min_order_amount=dec("0"),
        min_order_cost=dec("10"),
        ctx=ctx,
    )


# --------------------------------------------------------------------------
# Baseline
# --------------------------------------------------------------------------


def test_clean_entry_is_accepted_and_reserves_budget(gate, store):
    decision = entry(gate, make_ctx())

    assert decision.allowed
    assert decision.amount_base > 0
    assert store.reserved_risk() == decision.sizing.modelled_risk_quote
    assert len(store.open_reservations()) == 1


# --------------------------------------------------------------------------
# T06 - two simultaneous signals must not double-spend the last budget
# --------------------------------------------------------------------------


def test_t06_two_signals_cannot_both_take_the_last_risk_budget(gate, store):
    """Budget is 3% of 1000 = 30 USDC. With a 10% stop distance each entry
    models ~10 USDC of risk on ~100 USDC of notional - far below the 25%
    per-asset cap - so the RISK budget is what binds: three fit, a fourth
    must not. (The earlier version used a tight stop; the asset cap bound
    first and the risk-budget check could be deleted without failing it -
    audit finding.)"""
    # All five are still PENDING orders, so open_positions stays 0 - the
    # reservations themselves are what must exhaust the budget.
    accepted, refused = [], []
    pairs = ["BTC/USDC", "ETH/USDC", "SOL/USDC", "AVAX/USDC", "LINK/USDC"]
    for n, pair in enumerate(pairs):
        decision = gate.evaluate_entry(
            pair=pair, intent_id=f"i{n}", entry_price=dec("100"), stop_price=dec("90"),
            amount_step=dec("0.0001"), min_order_amount=dec("0.0001"),
            min_order_cost=dec("1"), ctx=make_ctx(),
        )
        (accepted if decision.allowed else refused).append(decision)

    assert len(accepted) == 3, f"expected exactly 3 entries, got {len(accepted)}"
    total_reserved = sum((d.sizing.modelled_risk_quote for d in accepted), Decimal(0))
    assert dec("29") < total_reserved <= dec("30"), total_reserved
    for d in accepted:
        assert d.sizing.notional < dec("250"), "the asset cap must not be what binds here"
    # The fourth and fifth are refused BECAUSE of the risk budget: either
    # outright (NO_RISK_BUDGET / RESERVATION_REFUSED) or because the sliver
    # of budget left sizes to less than the exchange minimum, in which case
    # the sizing result names portfolio_risk as the binding cap.
    assert len(refused) == 2
    for d in refused:
        assert (
            d.code in ("NO_RISK_BUDGET", "RESERVATION_REFUSED")
            or d.checks.get("binding_cap") == "portfolio_risk"
        ), (d.code, d.reason, d.checks)


def test_t06_position_slot_limit_counts_pending_entries(gate, store):
    """A pending buy occupies a slot; it is not free until it resolves.

    Distinct pairs are used so the per-asset notional cap cannot bind first
    and mask the slot limit we are actually testing.
    """
    pairs = ["BTC/USDC", "ETH/USDC", "SOL/USDC", "AVAX/USDC"]
    for n, pair in enumerate(pairs[:3]):
        assert entry(gate, make_ctx(), intent_id=f"i{n}", pair=pair).allowed

    fourth = entry(gate, make_ctx(), intent_id="i3", pair=pairs[3])

    assert fourth.refused
    assert fourth.code in ("RESERVATION_REFUSED", "NO_RISK_BUDGET"), fourth.reason


def test_t06_per_asset_cap_binds_before_the_slot_limit_on_one_pair(gate, store):
    """Four entries on the SAME pair are stopped by the 25% asset cap, which
    is a tighter and earlier limit than the position-slot count."""
    for n in range(3):
        entry(gate, make_ctx(), intent_id=f"s{n}")

    fourth = entry(gate, make_ctx(), intent_id="s3")

    assert fourth.refused
    assert fourth.checks["binding_cap"] == "asset_notional"


def test_t06_open_positions_and_reservations_share_one_slot_budget(gate, store):
    """Two already-open positions plus one pending leaves no room."""
    assert entry(gate, make_ctx(open_positions=2, open_risk="20"), intent_id="a").allowed

    second = entry(gate, make_ctx(open_positions=2, open_risk="20"), intent_id="b")

    assert second.refused


def test_t06_replaying_the_same_intent_does_not_double_book(gate, store):
    first = entry(gate, make_ctx(), intent_id="same")
    second = entry(gate, make_ctx(), intent_id="same")

    assert first.allowed
    assert second.refused
    assert "already reserved" in second.reason
    assert len(store.open_reservations()) == 1


def test_t06_reservation_survives_a_store_reopen(tmp_path, policy):
    """A crash between reserving and filling must not free the budget."""
    path = tmp_path / "risk.sqlite"
    store = RiskStore(path)
    store.set_state(BotState.READY, "test", NOW)
    gate = EntryGate(store, policy)
    decision = entry(gate, make_ctx(), intent_id="crash")
    assert decision.allowed
    reserved_before = store.reserved_risk()
    store.close()

    reopened = RiskStore(path)
    assert reopened.reserved_risk() == reserved_before
    assert len(reopened.open_reservations()) == 1
    reopened.close()


# --------------------------------------------------------------------------
# T07 - partial fills move risk, they do not release it
# --------------------------------------------------------------------------


def test_t07_partial_fill_keeps_the_remainder_reserved(gate, store):
    decision = entry(gate, make_ctx(), intent_id="p1")
    half = decision.amount_base / 2

    store.record_partial_fill("p1", half, NOW)
    reservation = store.get_reservation("p1")

    assert reservation.state is ReservationState.PARTIALLY_FILLED
    assert reservation.filled_base == half
    assert reservation.unfilled_base == decision.amount_base - half
    # Budget is still held: the rest of the order may yet fill.
    assert store.reserved_risk() > 0


def test_t07_full_fill_marks_the_reservation_filled(gate, store):
    decision = entry(gate, make_ctx(), intent_id="p2")

    store.record_partial_fill("p2", decision.amount_base, NOW)

    assert store.get_reservation("p2").state is ReservationState.FILLED


def test_t07_budget_is_released_only_after_a_confirmed_cancel(gate, store):
    entry(gate, make_ctx(), intent_id="p3")
    assert store.reserved_risk() > 0

    store.release("p3", "exchange confirmed cancellation", NOW)

    assert store.reserved_risk() == 0


def test_t07_out_of_order_fill_events_never_reduce_the_filled_amount(gate, store):
    decision = entry(gate, make_ctx(), intent_id="p4")
    store.record_partial_fill("p4", decision.amount_base, NOW)

    # A stale, smaller fill event arrives late.
    store.record_partial_fill("p4", decision.amount_base / 4, NOW + timedelta(seconds=1))

    assert store.get_reservation("p4").filled_base == decision.amount_base


def test_t07_fill_larger_than_reserved_is_an_error_not_a_silent_accept(gate, store):
    decision = entry(gate, make_ctx(), intent_id="p5")

    with pytest.raises(Exception, match="exceeds reserved amount"):
        store.record_partial_fill("p5", decision.amount_base * 2, NOW)


def test_t07_unknown_outcome_keeps_the_budget_held(gate, store):
    """T08 support: an order we cannot resolve must stay accounted for."""
    entry(gate, make_ctx(), intent_id="p6")
    held = store.reserved_risk()

    store.mark_unknown("p6", "timeout after submit", NOW)

    assert store.get_reservation("p6").state is ReservationState.UNKNOWN
    assert store.reserved_risk() == held, "UNKNOWN must not free the budget"


# --------------------------------------------------------------------------
# T12 - an OPEN position's loss trips the daily limit
# --------------------------------------------------------------------------


def test_t12_open_position_loss_locks_new_entries(gate, store):
    """The day opens at 1000. Unrealised losses take equity to 960, i.e. a
    4% loss against a 3% daily limit - with nothing closed at all."""
    gate.evaluate_locks(make_ctx(equity_total="1000"))

    decision = entry(gate, make_ctx(equity_total="960"), intent_id="t12")

    assert decision.refused
    assert decision.code == "RISK_LOCKED"
    assert "DAILY_LOSS" in decision.reason


def test_t12_entry_lock_does_not_stop_exit_management(gate, store):
    gate.evaluate_locks(make_ctx(equity_total="1000"))
    entry(gate, make_ctx(equity_total="960"), intent_id="t12b")

    assert store.get_state().exits_managed, "exits must keep running while entries are locked"
    assert store.get_state() is not BotState.STOPPED


def test_t12_equity_recovery_inside_the_same_period_does_not_unlock(gate, store):
    gate.evaluate_locks(make_ctx(equity_total="1000"))
    gate.evaluate_locks(make_ctx(equity_total="960"))  # breach

    # Price bounces back within the same UTC day.
    recovered = entry(gate, make_ctx(equity_total="1005"), intent_id="t12c")

    assert recovered.refused
    assert "DAILY_LOSS" in recovered.reason


def test_t12_weekly_limit_binds_even_when_daily_does_not(gate, store):
    """Down 5% on the week but only 1% today: weekly must still lock."""
    week_start = utc_week_start(NOW)
    store.open_period("week", week_start, dec("1000"), NOW)
    store.open_period("day", utc_day_start(NOW), dec("950"), NOW)

    decision = entry(gate, make_ctx(equity_total="940"), intent_id="t12d")

    assert decision.refused
    assert "WEEKLY_LOSS" in decision.reason


def test_t12_max_drawdown_lock_requires_an_operator(gate, store):
    gate.evaluate_locks(make_ctx(equity_total="1200"))  # sets the peak
    gate.evaluate_locks(make_ctx(equity_total="1000"))  # -16.7% from peak

    locks = [l for l in store.active_locks(NOW) if l.kind is LockKind.MAX_DRAWDOWN]
    assert locks, "drawdown lock was not raised"

    # Time cannot clear it, and neither can a naive clear() call.
    assert locks[0].is_active(NOW + timedelta(days=365))
    with pytest.raises(Exception, match="operator acknowledgement"):
        store.clear_lock(locks[0].lock_id, NOW, operator_ack=False)
    store.clear_lock(locks[0].lock_id, NOW, operator_ack=True)  # explicit ack works


# --------------------------------------------------------------------------
# T13 - period rollover, restart, and missing state
# --------------------------------------------------------------------------


def test_t13_period_baseline_is_never_overwritten_within_a_period(store):
    day_start = utc_day_start(NOW)
    store.open_period("day", day_start, dec("1000"), NOW)

    # A restart four hours later, after a 5% loss, must not re-baseline.
    store.open_period("day", day_start, dec("950"), NOW + timedelta(hours=4))

    assert store.get_period("day", day_start).starting_equity == dec("1000")


def test_t13_new_day_gets_a_fresh_baseline(gate, store):
    gate.evaluate_locks(make_ctx(equity_total="1000"))
    gate.evaluate_locks(make_ctx(equity_total="960"))  # locked for today

    tomorrow = NOW + timedelta(days=1)
    decision = entry(gate, make_ctx(equity_total="960", now=tomorrow), intent_id="t13")

    assert decision.allowed, f"new day should re-open entries, got {decision.reason}"


def test_t13_daily_lock_expires_exactly_at_the_period_boundary(gate, store):
    gate.evaluate_locks(make_ctx(equity_total="1000"))
    gate.evaluate_locks(make_ctx(equity_total="960"))

    day_start = utc_day_start(NOW)
    assert store.active_locks(day_start + timedelta(hours=23, minutes=59))
    assert not [
        l for l in store.active_locks(day_start + timedelta(days=1)) if l.kind is LockKind.DAILY_LOSS
    ]


def test_t13_locks_survive_a_restart(tmp_path, policy):
    path = tmp_path / "risk.sqlite"
    store = RiskStore(path)
    store.set_state(BotState.READY, "test", NOW)
    gate = EntryGate(store, policy)
    gate.evaluate_locks(make_ctx(equity_total="1000"))
    gate.evaluate_locks(make_ctx(equity_total="960"))
    store.close()

    reopened = RiskStore(path)
    assert [l for l in reopened.active_locks(NOW) if l.kind is LockKind.DAILY_LOSS]
    reopened.close()


def test_t13_peak_equity_survives_a_restart_and_never_falls(tmp_path):
    path = tmp_path / "risk.sqlite"
    store = RiskStore(path)
    store.update_peak_equity(dec("1500"), NOW)
    store.update_peak_equity(dec("1200"), NOW)  # a drop must not lower the peak
    assert store.get_peak_equity() == dec("1500")
    store.close()

    reopened = RiskStore(path)
    assert reopened.get_peak_equity() == dec("1500")
    reopened.close()


def test_t13_a_fresh_store_starts_in_reconciling_not_ready(tmp_path):
    """A brand-new state file has never agreed with the exchange about
    anything, so it must not begin by taking trades."""
    store = RiskStore(tmp_path / "risk.sqlite")

    assert store.get_state() is BotState.RECONCILING
    assert not store.get_state().entries_allowed
    store.close()


def test_t13_unknown_schema_version_is_refused(tmp_path):
    path = tmp_path / "risk.sqlite"
    store = RiskStore(path)
    store._conn.execute("UPDATE meta SET value='99' WHERE key='schema_version'")
    store.close()

    with pytest.raises(Exception, match="schema version"):
        RiskStore(path)


def test_t13_consecutive_stops_lock_and_survive_restart(tmp_path, policy):
    path = tmp_path / "risk.sqlite"
    store = RiskStore(path)
    store.set_state(BotState.READY, "test", NOW)
    gate = EntryGate(store, policy)
    for _ in range(3):
        store.record_stop("BTC/USDC", NOW)

    decision = entry(gate, make_ctx(), intent_id="stops")
    assert decision.refused
    assert "CONSECUTIVE_STOPS" in decision.reason
    # The lock consumed the count (otherwise the same three stops re-lock
    # the bot every 24h for ever - audit finding). The LOCK is what must
    # survive a restart, and it does: the reopened store still refuses.
    assert store.consecutive_stops() == 0
    store.close()

    reopened = RiskStore(path)
    assert [lock.kind for lock in reopened.active_locks(NOW)] == [LockKind.CONSECUTIVE_STOPS]
    again = entry(EntryGate(reopened, policy), make_ctx(), intent_id="stops-after-restart")
    assert again.refused and "CONSECUTIVE_STOPS" in again.reason
    reopened.close()


# --------------------------------------------------------------------------
# States, data and liquidity gates
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "state", [BotState.RECONCILING, BotState.RECOVERY_REQUIRED, BotState.STOPPED,
              BotState.ENTRY_PAUSED]
)
def test_non_ready_states_refuse_entries(gate, store, state):
    store.set_state(state, "test", NOW)

    decision = entry(gate, make_ctx(), intent_id="s")

    assert decision.refused
    assert decision.code == "STATE_BLOCKS_ENTRY"


def test_only_stopped_halts_exit_management():
    assert BotState.ENTRY_PAUSED.exits_managed
    assert BotState.RECOVERY_REQUIRED.exits_managed
    assert BotState.RECONCILING.exits_managed
    assert not BotState.STOPPED.exits_managed


def test_untradable_data_refuses_entry(gate):
    from dataclasses import replace

    ctx = replace(make_ctx(), data_is_tradable=False)
    assert entry(gate, ctx, intent_id="d").code == "DATA_NOT_TRADABLE"


def test_missing_liquidity_data_refuses_entry(gate):
    from dataclasses import replace

    ctx = replace(make_ctx(), liquidity_ok=False, liquidity_detail="no book")
    assert entry(gate, ctx, intent_id="l").code == "LIQUIDITY_GATE"


def test_stale_price_makes_equity_unusable(gate):
    decision = entry(gate, make_ctx(stale=("BTC",)), intent_id="stale")

    assert decision.refused
    assert decision.code == "EQUITY_UNUSABLE"


# --------------------------------------------------------------------------
# The second gate (compensating for freqtrade's fail-open stake handling)
# --------------------------------------------------------------------------


def test_second_gate_refuses_an_order_the_framework_enlarged(gate, store):
    decision = entry(gate, make_ctx(), intent_id="g1")
    inflated = decision.amount_base * dec("1.3")  # freqtrade's 30% min-stake bump

    ok, message = gate.confirm_final_order(
        intent_id="g1", final_amount=inflated, final_price=dec("100"), ctx=make_ctx()
    )

    assert not ok
    assert "enlarged" in message


def test_second_gate_accepts_the_exact_reserved_order(gate, store):
    decision = entry(gate, make_ctx(), intent_id="g2")

    ok, _ = gate.confirm_final_order(
        intent_id="g2", final_amount=decision.amount_base, final_price=dec("100"), ctx=make_ctx()
    )

    assert ok


def test_second_gate_refuses_an_order_with_no_reservation(gate):
    ok, message = gate.confirm_final_order(
        intent_id="never-reserved", final_amount=dec("1"), final_price=dec("100"), ctx=make_ctx()
    )

    assert not ok
    assert "no reservation" in message


# --------------------------------------------------------------------------
# Pure equity maths
# --------------------------------------------------------------------------


def test_locked_quote_is_counted_once_not_twice():
    snapshot = compute_equity(
        free_quote=dec("400"),
        locked_quote=dec("100"),
        holdings=[AssetHolding("BTC", dec("0.005"), dec("100000"))],
        max_price_age_seconds=900,
    )

    assert snapshot.total == dec("1000")
    assert snapshot.free_quote == dec("400")
    assert snapshot.holdings_value == dec("500")


def test_period_loss_fraction_matches_the_documented_formula():
    # (1000 + 0 - 970) / 1000 = 0.03
    assert period_loss_fraction(
        starting_equity=dec("1000"), net_external_flow=dec("0"), current_equity=dec("970")
    ) == dec("0.03")


def test_period_loss_fraction_is_floored_at_zero_when_up():
    assert period_loss_fraction(
        starting_equity=dec("1000"), net_external_flow=dec("0"), current_equity=dec("1100")
    ) == 0


def test_period_loss_fraction_adjusts_for_an_external_deposit():
    """Depositing 200 must not look like a 200 profit.
    (1000 + 200 - 1150) / 1000 = 0.05 loss, not a gain."""
    assert period_loss_fraction(
        starting_equity=dec("1000"), net_external_flow=dec("200"), current_equity=dec("1150")
    ) == dec("0.05")


def test_drawdown_from_peak():
    assert drawdown_from_peak(peak_equity=dec("1200"), current_equity=dec("1080")) == dec("0.1")
    assert drawdown_from_peak(peak_equity=dec("1200"), current_equity=dec("1300")) == 0


# --------------------------------------------------------------------------
# Decision recording (feeds the weekly report)
# --------------------------------------------------------------------------


def test_every_entry_decision_is_recorded(gate, store):
    """Refusals are the more informative half of the record. Keeping them only
    in the log file means they vanish the first time logs rotate."""
    entry(gate, make_ctx(), intent_id="rec-1")                       # accepted
    entry(gate, make_ctx(stale=("BTC",)), intent_id="rec-2")         # refused

    rows = store.entry_decisions_between(NOW - timedelta(hours=1), NOW + timedelta(hours=1))

    assert len(rows) == 2
    assert {r["code"] for r in rows} == {"ACCEPTED", "EQUITY_UNUSABLE"}
    accepted = next(r for r in rows if r["allowed"])
    assert accepted["pair"] == "BTC/USDC"
    assert accepted["binding_cap"], "the binding cap should be recorded for accepted entries"


def test_decision_recording_never_breaks_a_trade(gate, store, monkeypatch):
    """Reporting is not allowed to block trading. If recording fails, the
    decision still stands - but it must be logged loudly, not silently."""
    def explode(**_kwargs):
        raise RuntimeError("disk full")

    monkeypatch.setattr(store, "record_entry_decision", explode)

    decision = entry(gate, make_ctx(), intent_id="rec-3")

    assert decision.allowed, "a reporting failure must not veto an approved entry"


def test_refused_decisions_carry_their_reason(gate, store):
    entry(gate, make_ctx(), intent_id="r1")
    entry(gate, make_ctx(), intent_id="r1")  # duplicate intent -> refused

    rows = store.entry_decisions_between(NOW - timedelta(hours=1), NOW + timedelta(hours=1))
    refused = [r for r in rows if not r["allowed"]]

    assert refused
    assert "already reserved" in refused[0]["reason"]
