"""T03/T04/T05 - position sizing correctness and fail-closed behaviour.

Expected values here are computed by hand in the docstrings rather than by
re-running the implementation's own formula, so a bug in sizing.py cannot
make its own test pass.
"""

from decimal import Decimal

import pytest

from kripto.money import dec
from kripto.risk.sizing import (
    SizingInputs,
    SizingRejection,
    compute_position_size,
)

STEP = dec("0.00001")


def make_inputs(**overrides) -> SizingInputs:
    base = dict(
        equity=dec("1000"),
        risk_per_trade=dec("0.01"),
        entry_price=dec("100"),
        stop_price=dec("90"),
        exit_slippage=dec("0"),
        entry_fee=dec("0.0007"),
        exit_fee=dec("0.0007"),
        free_quote=dec("1000"),
        asset_notional_cap=dec("250"),
        portfolio_notional_cap=dec("750"),
        remaining_risk_budget=dec("30"),
        amount_step=STEP,
        min_order_amount=dec("0"),
        min_order_cost=dec("0"),
    )
    base.update(overrides)
    return SizingInputs(**base)


# --------------------------------------------------------------------------
# T03 - the amount actually reflects risk, units and stop distance
# --------------------------------------------------------------------------


def test_t03_baseline_amount_matches_hand_calculation():
    """E=1000, risk=1% -> R=10.
    P_in=100, P_stop=90, slippage=0 -> P_out=90.
    L = (100-90) + 100*0.0007 + 90*0.0007 = 10 + 0.07 + 0.063 = 10.133
    q = 10 / 10.133 = 0.986874...  -> floor to 0.00001 = 0.98687
    """
    result = compute_position_size(make_inputs())

    assert result.accepted
    assert result.modelled_loss_per_unit == dec("10.133")
    assert result.amount == dec("0.98687")
    assert result.binding_cap == "risk_per_trade"


def test_t03_narrower_stop_gives_larger_quantity():
    """Same 10 USDC of risk over a 5-point stop instead of a 10-point stop.
    L = (100-95) + 100*0.0007 + 95*0.0007 = 5 + 0.07 + 0.0665 = 5.1365
    q = 10 / 5.1365 = 1.946851...  -> 1.94685
    """
    wide = compute_position_size(make_inputs())
    narrow = compute_position_size(make_inputs(stop_price=dec("95")))

    assert narrow.modelled_loss_per_unit == dec("5.1365")
    assert narrow.amount == dec("1.94685")
    # Halving the stop distance must roughly double the size, never shrink it.
    assert narrow.amount > wide.amount


def test_t03_modelled_risk_never_exceeds_budget():
    """The whole point of the formula: q * L <= R."""
    for stop in ("80", "90", "95", "99", "99.9"):
        result = compute_position_size(make_inputs(stop_price=dec(stop)))
        if result.accepted:
            assert result.modelled_risk_quote <= dec("10"), f"stop={stop}"


def test_t03_exit_slippage_increases_modelled_loss_and_shrinks_size():
    """slippage=1% -> P_out = 90*0.99 = 89.1
    L = (100-89.1) + 100*0.0007 + 89.1*0.0007 = 10.9 + 0.07 + 0.06237 = 11.03237
    q = 10/11.03237 = 0.906422... -> 0.90642
    """
    result = compute_position_size(make_inputs(exit_slippage=dec("0.01")))

    assert result.modelled_loss_per_unit == dec("11.03237")
    assert result.amount == dec("0.90642")
    assert result.amount < dec("0.98687")


def test_t03_fees_are_counted_on_both_sides():
    """Zero fees: L = 10 exactly, q = 10/10 = 1."""
    result = compute_position_size(make_inputs(entry_fee=dec("0"), exit_fee=dec("0")))

    assert result.modelled_loss_per_unit == dec("10")
    assert result.amount == dec("1")


def test_t03_percent_instead_of_ratio_is_rejected():
    """A caller passing 1 (meaning "1 percent") must not get 100x the risk."""
    result = compute_position_size(make_inputs(risk_per_trade=dec("1")))

    assert not result.accepted
    assert result.rejection is SizingRejection.INVALID_RISK_FRACTION


# --------------------------------------------------------------------------
# T03 - caps are compared in base units, not mixed with quote units
# --------------------------------------------------------------------------


def test_t03_asset_notional_cap_binds_in_base_units():
    """Asset cap 50 USDC at price 100 -> 0.5 base, tighter than the 0.98687
    the risk budget would allow."""
    result = compute_position_size(make_inputs(asset_notional_cap=dec("50")))

    assert result.accepted
    assert result.amount == dec("0.5")
    assert result.binding_cap == "asset_notional"


def test_t03_cash_cap_accounts_for_entry_fee():
    """free_quote=50, cost per unit = 100 * 1.0007 = 100.07
    q = 50/100.07 = 0.499650... -> 0.49965 (NOT 0.5, the fee must bite)
    """
    result = compute_position_size(make_inputs(free_quote=dec("50")))

    assert result.amount == dec("0.49965")
    assert result.binding_cap == "cash"


def test_t03_fee_reserve_is_held_back_from_cash():
    """free_quote=50 with a 10 reserve -> only 40 spendable.
    q = 40/100.07 = 0.399720... -> 0.39972
    """
    result = compute_position_size(make_inputs(free_quote=dec("50"), fee_reserve=dec("10")))

    assert result.amount == dec("0.39972")


def test_t03_remaining_portfolio_risk_binds():
    """Only 2 USDC of open-risk budget left: q = 2/10.133 = 0.197374... -> 0.19737"""
    result = compute_position_size(make_inputs(remaining_risk_budget=dec("2")))

    assert result.amount == dec("0.19737")
    assert result.binding_cap == "portfolio_risk"


def test_t03_liquidity_cap_binds_in_base_units():
    result = compute_position_size(make_inputs(liquidity_cap_base=dec("0.1")))

    assert result.amount == dec("0.1")
    assert result.binding_cap == "liquidity"


# --------------------------------------------------------------------------
# T04 - bad inputs produce NO trade, never a fallback stake
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "overrides,expected",
    [
        ({"equity": dec("0")}, SizingRejection.INVALID_EQUITY),
        ({"equity": dec("-1")}, SizingRejection.INVALID_EQUITY),
        ({"risk_per_trade": dec("0")}, SizingRejection.INVALID_RISK_FRACTION),
        ({"risk_per_trade": dec("-0.01")}, SizingRejection.INVALID_RISK_FRACTION),
        ({"entry_price": dec("0")}, SizingRejection.INVALID_PRICES),
        ({"stop_price": dec("0")}, SizingRejection.INVALID_PRICES),
        ({"stop_price": dec("-5")}, SizingRejection.INVALID_PRICES),
        ({"entry_fee": dec("-0.001")}, SizingRejection.INVALID_FEES),
        ({"exit_fee": dec("1")}, SizingRejection.INVALID_FEES),
        ({"exit_slippage": dec("1")}, SizingRejection.INVALID_SLIPPAGE),
        ({"exit_slippage": dec("-0.01")}, SizingRejection.INVALID_SLIPPAGE),
        ({"remaining_risk_budget": dec("-1")}, SizingRejection.NO_RISK_BUDGET),
    ],
)
def test_t04_invalid_inputs_are_rejected(overrides, expected):
    result = compute_position_size(make_inputs(**overrides))

    assert not result.accepted
    assert result.amount == Decimal(0)
    assert result.rejection is expected


def test_t04_stop_at_or_above_entry_is_rejected():
    """A zero or negative ATR collapses the stop onto the entry price. That is
    a division-by-near-zero away from an unbounded position size."""
    for stop in ("100", "100.0001", "150"):
        result = compute_position_size(make_inputs(stop_price=dec(stop)))
        assert not result.accepted, f"stop={stop} must be rejected"
        assert result.rejection is SizingRejection.INVALID_PRICES


def test_t04_zero_cash_yields_no_trade():
    result = compute_position_size(make_inputs(free_quote=dec("0")))

    assert not result.accepted
    assert result.rejection is SizingRejection.NO_CASH


def test_t04_exhausted_risk_budget_yields_no_trade():
    result = compute_position_size(make_inputs(remaining_risk_budget=dec("0")))

    assert not result.accepted
    assert result.rejection is SizingRejection.NO_RISK_BUDGET


def test_t04_nan_and_infinity_never_reach_the_formula():
    from kripto.money import MoneyError, dec as convert

    for bad in ("nan", "inf", "-inf"):
        with pytest.raises(MoneyError):
            convert(bad)
    with pytest.raises(MoneyError):
        convert(float("nan"))


# --------------------------------------------------------------------------
# T05 - exchange minimums and precision must never inflate risk
# --------------------------------------------------------------------------


def test_t05_amount_below_min_order_is_skipped_not_enlarged():
    """Risk allows 0.98687 but the exchange minimum is 2.0 base units.
    Trading 2.0 would carry 2.0 * 10.133 = 20.27 USDC of risk, i.e. 2x budget."""
    result = compute_position_size(make_inputs(min_order_amount=dec("2")))

    assert not result.accepted
    assert result.amount == Decimal(0)
    assert result.rejection is SizingRejection.MIN_ORDER_EXCEEDS_RISK


def test_t05_notional_below_min_cost_is_skipped_not_enlarged():
    """0.98687 * 100 = 98.687 USDC notional, below a 500 USDC minimum cost."""
    result = compute_position_size(make_inputs(min_order_cost=dec("500")))

    assert not result.accepted
    assert result.rejection is SizingRejection.MIN_ORDER_EXCEEDS_RISK


def test_t05_amount_is_always_rounded_down_to_step():
    """step 0.01 -> 0.98687 must become 0.98, never 0.99."""
    result = compute_position_size(make_inputs(amount_step=dec("0.01")))

    assert result.amount == dec("0.98")
    assert result.modelled_risk_quote <= dec("10")


def test_t05_coarse_step_rounding_to_zero_is_a_rejection():
    """step 1.0 -> 0.98687 floors to 0. That is no trade, not a 1-unit trade."""
    result = compute_position_size(make_inputs(amount_step=dec("1")))

    assert not result.accepted
    assert result.amount == Decimal(0)
    assert result.rejection is SizingRejection.QUANTITY_ROUNDS_TO_ZERO


def test_t05_rounding_never_increases_risk_across_many_steps():
    for step in ("0.1", "0.01", "0.001", "0.0001", "0.00001"):
        result = compute_position_size(make_inputs(amount_step=dec(step)))
        if result.accepted:
            assert result.modelled_risk_quote <= dec("10"), f"step={step}"
            # and the rounded amount is genuinely a multiple of the step
            assert result.amount % dec(step) == Decimal(0), f"step={step}"
