"""T22 - one risk scenario, several execution paths, consistent decisions.

The pure policy layer is shared by backtest, replay and dry-run. This file
pins that sharing: the same sequence of market and account events must
produce the same sequence of decisions no matter which path drives it, and
the places where the paths genuinely differ must be declared rather than
discovered later.
"""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timedelta, timezone

import pytest

from kripto.money import dec
from kripto.policy import load_policy
from kripto.risk.coverage import COVERAGE, PATH_INDEPENDENT, Coverage, RunPath, not_modelled
from kripto.risk.equity import AssetHolding, compute_equity
from kripto.risk.gate import EntryGate, GateContext
from kripto.risk.state import BotState, RiskStore

NOW = datetime(2026, 9, 17, 0, 0, tzinfo=timezone.utc)

# One scripted scenario: an opening equity, three entry attempts, a drawdown,
# a recovery inside the same day, and a new day.
SCENARIO = [
    # (hours_from_start, equity, entry_price, stop_price, label)
    (0, "1000", "100", "90", "first entry"),
    (4, "1000", "100", "90", "second entry"),
    (8, "1000", "100", "90", "third entry - budget should now be tight"),
    (12, "1000", "100", "90", "fourth entry - must be refused"),
    (16, "965", "100", "90", "unrealised loss crosses the 3% daily limit"),
    (20, "1005", "100", "90", "recovery inside the same day must NOT unlock"),
    (28, "1005", "100", "90", "new UTC day - entries may resume"),
]


@pytest.fixture
def policy():
    return load_policy("config/policy.yaml")


def build_ctx(now, equity_total, *, open_positions=0, open_risk="0"):
    snapshot = compute_equity(
        free_quote=dec(equity_total), locked_quote=dec("0"), holdings=[],
        max_price_age_seconds=900,
    )
    snapshot = replace(snapshot, total=dec(equity_total))
    return GateContext(
        now=now,
        equity=snapshot,
        open_positions=open_positions,
        open_position_risk_quote=dec(open_risk),
        pair_notional_quote=dec("0"),
        data_is_tradable=True,
        liquidity_ok=True,
    )


def run_scenario(store: RiskStore, policy, *, pair_cycle=("BTC/USDC", "ETH/USDC", "SOL/USDC")):
    """Drive the shared risk policy through the scripted scenario."""
    store.set_state(BotState.READY, "scenario start", NOW)
    gate = EntryGate(store, policy)
    decisions = []

    for index, (hours, equity, entry_price, stop_price, label) in enumerate(SCENARIO):
        now = NOW + timedelta(hours=hours)
        ctx = build_ctx(now, equity)
        gate.evaluate_locks(ctx)
        decision = gate.evaluate_entry(
            pair=pair_cycle[index % len(pair_cycle)],
            intent_id=f"scenario-{index}",
            entry_price=dec(entry_price),
            stop_price=dec(stop_price),
            amount_step=dec("0.00001"),
            min_order_amount=dec("0"),
            min_order_cost=dec("10"),
            ctx=ctx,
        )
        decisions.append((label, decision.code, str(decision.amount_base)))
    return decisions


# --------------------------------------------------------------------------
# Determinism and path independence
# --------------------------------------------------------------------------


def test_t22_scenario_is_deterministic(tmp_path, policy):
    """Same inputs, clean state, same decisions - twice."""
    first = RiskStore(tmp_path / "a.sqlite")
    second = RiskStore(tmp_path / "b.sqlite")

    run_a = run_scenario(first, policy)
    run_b = run_scenario(second, policy)

    assert run_a == run_b
    first.close()
    second.close()


def test_t22_backtest_and_dry_run_paths_agree(tmp_path, policy):
    """The two paths differ in how they START (a backtest has no exchange to
    reconcile with) but must not differ in what they DECIDE."""
    backtest_store = RiskStore(tmp_path / "backtest.sqlite")
    backtest_store.set_state(BotState.READY, "backtest: nothing to reconcile", NOW)

    dry_run_store = RiskStore(tmp_path / "dryrun.sqlite")
    # The dry-run path goes through reconciliation first.
    dry_run_store.set_state(BotState.RECONCILING, "process start", NOW)
    dry_run_store.set_state(BotState.READY, "records agree", NOW)

    assert run_scenario(backtest_store, policy) == run_scenario(dry_run_store, policy)
    backtest_store.close()
    dry_run_store.close()


def test_t22_the_scenario_actually_exercises_the_limits(tmp_path, policy):
    """Guard against the agreement tests passing vacuously by comparing two
    runs that both refuse everything."""
    store = RiskStore(tmp_path / "r.sqlite")
    decisions = run_scenario(store, policy)
    codes = [code for _, code, _ in decisions]

    assert "ACCEPTED" in codes, "the scenario never accepted an entry"
    assert "RISK_LOCKED" in codes, "the scenario never tripped a lock"
    assert len(set(codes)) >= 3, f"scenario is too uniform to be meaningful: {codes}"
    store.close()


def test_t22_recovery_inside_a_period_does_not_unlock_on_any_path(tmp_path, policy):
    store = RiskStore(tmp_path / "r.sqlite")
    decisions = dict((label, code) for label, code, _ in run_scenario(store, policy))

    assert decisions["unrealised loss crosses the 3% daily limit"] == "RISK_LOCKED"
    assert decisions["recovery inside the same day must NOT unlock"] == "RISK_LOCKED"

    # The new day clears the PERIOD lock. It is still refused, but for an
    # unrelated and legitimate reason: the three earlier entries were never
    # filled or cancelled in this scenario, so their reservations still hold
    # the budget. Asserting "ACCEPTED" here would have been asserting that
    # unresolved reservations quietly expire, which is exactly what must not
    # happen.
    new_day = decisions["new UTC day - entries may resume"]
    assert new_day != "RISK_LOCKED", (
        f"the daily lock did not expire with the period (got {new_day})"
    )
    store.close()


def test_t22_a_new_day_accepts_again_once_the_budget_is_free(tmp_path, policy):
    """The other half of the previous test: with the stale reservations
    resolved, the new day really does re-open entries."""
    store = RiskStore(tmp_path / "r.sqlite")
    run_scenario(store, policy)

    # Whatever the venue confirmed about those orders - here, cancelled.
    for reservation in store.open_reservations():
        store.release(reservation.intent_id, "confirmed cancelled", NOW + timedelta(hours=27))

    gate = EntryGate(store, policy)
    next_day = NOW + timedelta(hours=28)
    ctx = build_ctx(next_day, "1005")
    gate.evaluate_locks(ctx)
    decision = gate.evaluate_entry(
        pair="BTC/USDC", intent_id="fresh-day", entry_price=dec("100"), stop_price=dec("90"),
        amount_step=dec("0.00001"), min_order_amount=dec("0"), min_order_cost=dec("10"),
        ctx=ctx,
    )

    assert decision.allowed, f"new day still refused: [{decision.code}] {decision.reason}"
    store.close()


def test_t22_a_replay_of_the_same_events_reproduces_the_same_state(tmp_path, policy):
    """Replaying the scenario into a fresh store reaches the same end state -
    which is what makes an incident reproducible after the fact."""
    live = RiskStore(tmp_path / "live.sqlite")
    run_scenario(live, policy)
    live_locks = sorted(l.kind.value for l in live.active_locks(NOW + timedelta(hours=20)))
    live_peak = live.get_peak_equity()
    live.close()

    replay = RiskStore(tmp_path / "replay.sqlite")
    run_scenario(replay, policy)
    replay_locks = sorted(l.kind.value for l in replay.active_locks(NOW + timedelta(hours=20)))

    assert replay_locks == live_locks
    assert replay.get_peak_equity() == live_peak
    replay.close()


# --------------------------------------------------------------------------
# The differences must be declared, not discovered
# --------------------------------------------------------------------------


def test_t22_path_independent_features_are_modelled_everywhere():
    for feature in PATH_INDEPENDENT:
        for path in RunPath:
            assert COVERAGE[feature][path] is Coverage.MODELLED, (
                f"{feature} is declared path-independent but is "
                f"{COVERAGE[feature][path].value} on {path.value}"
            )


def test_t22_backtest_declares_what_it_cannot_model():
    missing = not_modelled(RunPath.BACKTEST)

    # These are the ones a backtest genuinely cannot speak to.
    for feature in (
        "order_lifecycle_states",
        "reconciliation_on_restart",
        "cancel_fill_race",
        "slippage",
        "intra_candle_fill_order",
    ):
        assert feature in missing, f"{feature} must be declared NOT_MODELED for backtest"


def test_t22_exchange_side_stop_is_not_modelled_on_any_path():
    """It does not exist on this venue, so no path may imply otherwise."""
    for path in RunPath:
        assert COVERAGE["exchange_side_stop"][path] is Coverage.NOT_MODELLED


def test_t22_every_feature_declares_every_path():
    for feature, paths in COVERAGE.items():
        for path in RunPath:
            assert path in paths, f"{feature} does not declare coverage for {path.value}"
