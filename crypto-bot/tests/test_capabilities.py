"""Pin the exchange capability facts this project's safety design rests on.

These are not tests of our code. They are tripwires on freqtrade's. Every
assertion here corresponds to a decision recorded in docs/CAPABILITIES.md;
if an upgrade changes one, the test fails and the decision gets re-made
deliberately instead of silently inherited.
"""

import pytest

pytest.importorskip("freqtrade")

import freqtrade  # noqa: E402
from freqtrade.exchange.hyperliquid import Hyperliquid  # noqa: E402

PINNED_FREQTRADE = "2026.8"


def test_freqtrade_version_is_the_pinned_one():
    assert freqtrade.__version__ == PINNED_FREQTRADE, (
        f"expected freqtrade {PINNED_FREQTRADE}, got {freqtrade.__version__}. "
        "Re-verify docs/CAPABILITIES.md before changing this pin."
    )


def test_hyperliquid_spot_has_no_stoploss_on_exchange():
    """THE live blocker. If this ever becomes True, docs/LIVE_READINESS.md
    gets a gate unblocked - but only after verifying it on spot, not futures."""
    assert Hyperliquid._ft_has["stoploss_on_exchange"] is False


def test_hyperliquid_futures_stoploss_is_not_mistaken_for_spot_support():
    """The freqtrade docs carry a prominent 'Hyperliquid supports
    stoploss_on_exchange' tip. It is true only for futures. This test pins
    the distinction so the docs tip cannot be misread into the spot path."""
    assert Hyperliquid._ft_has_futures["stoploss_on_exchange"] is True
    assert Hyperliquid._ft_has["stoploss_on_exchange"] is False


def test_hyperliquid_market_orders_require_a_price():
    """ccxt emulates market orders as limit orders with a slippage cap, so
    every 'market' order is really a limit order with a hidden price bound."""
    assert Hyperliquid._ft_has["marketOrderRequiresPrice"] is True


def test_hyperliquid_tickers_have_no_bid_ask():
    """Spread gates cannot be fed from fetch_tickers; they need an L2 call."""
    assert Hyperliquid._ft_has["tickers_have_bid_ask"] is False


def test_hyperliquid_order_book_depth_is_limited_to_20_levels():
    assert Hyperliquid._ft_has["l2_limit_range"] == [20]


def test_hyperliquid_declares_no_ohlcv_history():
    """Drives the decision to run our own incremental collector rather than
    relying on `freqtrade download-data`."""
    assert Hyperliquid._ft_has["ohlcv_has_history"] is False
    assert Hyperliquid._ft_has["trades_has_history"] is False


def test_spot_is_a_supported_trading_mode_and_margin_is_not_used():
    from freqtrade.enums import MarginMode, TradingMode

    assert (TradingMode.SPOT, MarginMode.NONE) in Hyperliquid._supported_trading_mode_margin_pairs


def test_custom_stake_amount_still_falls_back_to_proposed_stake():
    """The documented fail-OPEN behaviour that T04's extra gate compensates for.

    freqtradebot.execute_entry calls:
        strategy_safe_wrapper(self.strategy.custom_stake_amount,
                              default_retval=stake_amount)(...)

    so a raising risk calculation does NOT prevent the trade - it silently
    restores the proposed stake. This test measures that behaviour rather than
    grepping for it, so it stays meaningful across refactors.
    """
    from freqtrade.strategy.strategy_wrapper import strategy_safe_wrapper

    def exploding_risk_calculation(**kwargs):
        raise ZeroDivisionError("ATR was zero")

    wrapped = strategy_safe_wrapper(exploding_risk_calculation, default_retval=123.45)

    assert wrapped(pair="BTC/USDC") == 123.45, (
        "freqtrade no longer falls back to proposed_stake on exception. "
        "Re-evaluate whether the extra entry gate in T04 is still required."
    )


def test_returning_zero_from_custom_stake_amount_prevents_the_trade():
    """The safe escape hatch our risk gate uses: 0/None means no trade."""
    from freqtrade.wallets import Wallets

    import inspect

    source = inspect.getsource(Wallets.validate_stake_amount)
    assert "return 0" in source, (
        "validate_stake_amount no longer has a zero path; re-verify how a "
        "refused entry is signalled to freqtrade"
    )


def test_environment_variable_merge_hook_still_exists():
    """launcher.build_effective_config depends on this private helper. If it
    disappears in an upgrade, the T01 env-var protection would silently stop
    inspecting environment overrides."""
    from freqtrade.configuration.environment_vars import _flat_vars_to_nested_dict

    merged = _flat_vars_to_nested_dict({"FREQTRADE__DRY_RUN": "false"}, "FREQTRADE__")
    assert merged == {"dry_run": False}
