"""T07 (fees and dust) and T15 (exits are never vetoed)."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from kripto.money import dec
from kripto.risk.fills import Fill, FillError, apply_buy_fill, classify_remainder, combine

NOW = datetime(2026, 9, 17, 12, 0, tzinfo=timezone.utc)


# --------------------------------------------------------------------------
# T07 - fee currency changes what we actually hold
# --------------------------------------------------------------------------


def test_t07_fee_in_quote_leaves_the_base_amount_intact():
    """1 BTC at 100, fee 0.07 USDC: we hold 1 BTC and spent 100.07."""
    net = apply_buy_fill(
        Fill(dec("1"), dec("100"), dec("0.07"), "USDC"), base_asset="BTC", quote_asset="USDC"
    )

    assert net.net_base == dec("1")
    assert net.quote_spent == dec("100.07")
    assert net.fee_in_quote == dec("0.07")
    assert net.fee_in_base == 0


def test_t07_fee_in_base_reduces_what_we_can_sell():
    """The expensive mistake: buying 1 BTC with a 0.0007 BTC fee leaves
    0.9993 BTC. A stop sized for 1 BTC would not be fully coverable."""
    net = apply_buy_fill(
        Fill(dec("1"), dec("100"), dec("0.0007"), "BTC"), base_asset="BTC", quote_asset="USDC"
    )

    assert net.gross_base == dec("1")
    assert net.net_base == dec("0.9993")
    assert net.fee_in_base == dec("0.0007")
    assert net.quote_spent == dec("100")


def test_t07_fee_in_a_third_token_touches_neither_side():
    net = apply_buy_fill(
        Fill(dec("1"), dec("100"), dec("5"), "HYPE"), base_asset="BTC", quote_asset="USDC"
    )

    assert net.net_base == dec("1")
    assert net.quote_spent == dec("100")
    assert net.fee_other == {"HYPE": dec("5")}


def test_t07_effective_price_uses_the_amount_actually_received():
    net = apply_buy_fill(
        Fill(dec("1"), dec("100"), dec("0.0007"), "BTC"), base_asset="BTC", quote_asset="USDC"
    )

    # 100 quote spent for 0.9993 base actually held.
    assert net.effective_price > dec("100")
    assert abs(net.effective_price - dec("100.07005")) < dec("0.001")


def test_t07_a_fee_that_consumes_the_whole_fill_is_an_error():
    with pytest.raises(FillError, match="consumes the whole fill"):
        apply_buy_fill(
            Fill(dec("1"), dec("100"), dec("1"), "BTC"), base_asset="BTC", quote_asset="USDC"
        )


def test_t07_partial_fills_combine_into_one_position_view():
    fills = [
        apply_buy_fill(
            Fill(dec("0.5"), dec("100"), dec("0.00035"), "BTC"),
            base_asset="BTC", quote_asset="USDC",
        ),
        apply_buy_fill(
            Fill(dec("0.5"), dec("102"), dec("0.00035"), "BTC"),
            base_asset="BTC", quote_asset="USDC",
        ),
    ]

    total = combine(fills)

    assert total.gross_base == dec("1")
    assert total.net_base == dec("0.9993")
    assert total.quote_spent == dec("101")
    assert total.fee_in_base == dec("0.0007")


# --------------------------------------------------------------------------
# T07 - dust is recorded, never bought away
# --------------------------------------------------------------------------


def test_t07_remainder_below_the_minimum_cost_is_dust():
    dust = classify_remainder(
        asset="BTC", remaining_base=dec("0.00005"), price=dec("100000"),
        amount_step=dec("0.00001"), min_order_amount=dec("0"), min_order_cost=dec("10"),
    )

    assert dust is not None
    assert dust.is_dust
    assert dust.value_quote == dec("5.00000")
    assert "minimum cost" in dust.reason


def test_t07_remainder_below_the_amount_step_is_dust():
    dust = classify_remainder(
        asset="BTC", remaining_base=dec("0.000001"), price=dec("100000"),
        amount_step=dec("0.00001"), min_order_amount=dec("0"), min_order_cost=dec("0"),
    )

    assert dust is not None
    assert "amount step" in dust.reason


def test_t07_a_sellable_remainder_is_not_dust():
    assert classify_remainder(
        asset="BTC", remaining_base=dec("0.01"), price=dec("100000"),
        amount_step=dec("0.00001"), min_order_amount=dec("0"), min_order_cost=dec("10"),
    ) is None


def test_t07_zero_remainder_is_not_dust():
    assert classify_remainder(
        asset="BTC", remaining_base=dec("0"), price=dec("100000"),
        amount_step=dec("0.00001"), min_order_amount=dec("0"), min_order_cost=dec("10"),
    ) is None


# --------------------------------------------------------------------------
# T15 - exits are never vetoed by entry-side conditions
# --------------------------------------------------------------------------


@pytest.fixture(scope="module")
def strategy():
    import sys
    from pathlib import Path

    root = Path(__file__).resolve().parent.parent
    sys.path.insert(0, str(root / "user_data" / "strategies"))
    from BaselineTrend4h import BaselineTrend4h

    return BaselineTrend4h({"runmode": "backtest", "stake_currency": "USDC", "timeframe": "4h"})


class _Trade:
    pair = "BTC/USDC"
    amount = 1.0
    open_rate = 100.0

    def get_custom_data(self, key, default=None):
        return None


@pytest.mark.parametrize(
    "exit_reason",
    [
        "stop_loss",
        "stoploss",
        "emergency_exit",
        "trailing_stop_loss",
        "exit_signal",
        "trend_end",
        "force_exit",
        "liquidation",
    ],
)
def test_t15_no_exit_reason_is_ever_vetoed(strategy, exit_reason):
    """freqtrade's own docs warn that confirm_trade_exit "can prevent
    stoploss exits, causing significant losses". The only safe implementation
    is one that cannot say no."""
    assert strategy.confirm_trade_exit(
        pair="BTC/USDC", trade=_Trade(), order_type="limit", amount=1.0, rate=50.0,
        time_in_force="GTC", exit_reason=exit_reason, current_time=NOW,
    ) is True


def test_t15_a_deeply_losing_exit_is_not_vetoed(strategy):
    """A 60% loss must still exit. An entry-side "don't sell at a loss" rule
    here is how an account gets destroyed."""
    assert strategy.confirm_trade_exit(
        pair="BTC/USDC", trade=_Trade(), order_type="market", amount=1.0, rate=40.0,
        time_in_force="IOC", exit_reason="stop_loss", current_time=NOW,
    ) is True


def test_t15_confirm_trade_exit_takes_no_decision_path(strategy):
    """Structural guarantee: the method body must have no branch that can
    return False, so no future edit adds one by accident without this test
    noticing."""
    import inspect

    source = inspect.getsource(strategy.__class__.confirm_trade_exit)

    assert "return False" not in source
    assert source.rstrip().endswith("return True")
