"""T20 - causality: changing the FUTURE must never change the PAST.

This is the decisive leak test and it is deliberately independent of
freqtrade's lookahead-analysis tool. That tool re-runs a whole backtest over
different time ranges and compares outcomes, which makes it sensitive to any
state a strategy carries between runs - our risk store carries plenty. Here
we test the property itself: recompute indicators and signals on a truncated
series and on a mutated-future series, and require the overlapping past to
be bit-identical.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "user_data" / "strategies"))

from kripto.data.store import read_candles  # noqa: E402

DATA = REPO_ROOT / "user_data" / "data" / "hyperliquid" / "BTC_USDC-4h.feather"
INDICATORS = ["ema_fast", "ema_slow", "adx", "atr"]
SIGNALS = ["eligible", "enter_long", "exit_long"]


@pytest.fixture(scope="module")
def strategy():
    from BaselineTrend4h import BaselineTrend4h

    return BaselineTrend4h(
        {"runmode": "backtest", "stake_currency": "USDC", "timeframe": "4h"}
    )


@pytest.fixture(scope="module")
def candles():
    if not DATA.is_file():
        pytest.skip(f"collected data not present: {DATA}")
    return read_candles(DATA)


def analyze(strategy, df):
    out = strategy.populate_indicators(df.copy(), {"pair": "BTC/USDC"})
    out = strategy.populate_entry_trend(out, {"pair": "BTC/USDC"})
    out = strategy.populate_exit_trend(out, {"pair": "BTC/USDC"})
    for column in SIGNALS:
        if column not in out.columns:
            out[column] = 0
    return out.fillna({"enter_long": 0, "exit_long": 0})


def compare_past(full, truncated, cutoff, label):
    """Every indicator and signal up to ``cutoff`` must match exactly."""
    left = full.iloc[:cutoff]
    right = truncated.iloc[:cutoff]
    for column in INDICATORS + SIGNALS:
        a = pd.to_numeric(left[column], errors="coerce").to_numpy(dtype="float64")
        b = pd.to_numeric(right[column], errors="coerce").to_numpy(dtype="float64")
        mismatches = int(np.sum(~((a == b) | (np.isnan(a) & np.isnan(b)))))
        assert mismatches == 0, (
            f"{label}: column '{column}' changed in {mismatches} past row(s) when the "
            f"future changed - this is a look-ahead leak"
        )


def test_t20_truncating_the_future_does_not_change_the_past(strategy, candles):
    """The strongest form: the last 300 candles simply do not exist yet."""
    cutoff = len(candles) - 300
    full = analyze(strategy, candles)
    truncated = analyze(strategy, candles.iloc[:cutoff].copy())

    compare_past(full, truncated, cutoff, "truncation")


def test_t20_mutating_future_prices_does_not_change_past_signals(strategy, candles):
    """A violent, implausible future: prices tripled from the cutoff onward."""
    cutoff = len(candles) - 300
    mutated = candles.copy()
    tail = mutated.index[cutoff:]
    for column in ("open", "high", "low", "close"):
        mutated.loc[tail, column] = mutated.loc[tail, column] * 3.0
    mutated.loc[tail, "volume"] = mutated.loc[tail, "volume"] * 7.0

    full = analyze(strategy, candles)
    changed = analyze(strategy, mutated)

    compare_past(full, changed, cutoff, "future mutation")


def test_t20_mutating_a_single_future_candle_does_not_change_the_past(strategy, candles):
    """A subtler probe: one candle, far in the future, made extreme."""
    cutoff = len(candles) - 50
    mutated = candles.copy()
    idx = mutated.index[-10]
    mutated.loc[idx, "high"] = mutated.loc[idx, "high"] * 10
    mutated.loc[idx, "close"] = mutated.loc[idx, "close"] * 10

    full = analyze(strategy, candles)
    changed = analyze(strategy, mutated)

    compare_past(full, changed, cutoff, "single future candle")


def test_t20_entry_signal_only_fires_on_the_transition(strategy, candles):
    """Regression guard for the object-dtype `~shift()` bug.

    `bool_series.shift(1).fillna(False)` yields OBJECT dtype, on which `~`
    performs integer bitwise NOT (True -> -2, False -> -1). Both are truthy,
    so the transition filter silently passed everything through and every
    eligible candle produced an entry.
    """
    analyzed = analyze(strategy, candles)

    eligible = int(analyzed["eligible"].astype(bool).sum())
    entries = int(pd.to_numeric(analyzed["enter_long"], errors="coerce").fillna(0).sum())

    assert entries > 0, "no entry signals at all; the strategy would never trade"
    assert entries < eligible / 3, (
        f"{entries} entries for {eligible} eligible candles - the transition filter is "
        "not filtering. Check the shift()/dtype handling in populate_entry_trend."
    )

    # And the property itself: an entry requires the previous candle to have
    # been ineligible.
    flags = analyzed["eligible"].astype(bool).to_numpy()
    entry_rows = np.flatnonzero(
        pd.to_numeric(analyzed["enter_long"], errors="coerce").fillna(0).to_numpy() == 1
    )
    for row in entry_rows:
        assert flags[row], f"entry at row {row} on an ineligible candle"
        if row > 0:
            assert not flags[row - 1], (
                f"entry at row {row} although the previous candle was already eligible"
            )


def test_t20_shift_dtype_pitfall_is_documented_by_a_direct_check():
    """Pin the pandas behaviour that caused the bug, so an upgrade that
    changes it does not quietly invalidate the fix's rationale."""
    series = pd.Series([False, True, True, False, True])

    broken = series.shift(1).fillna(False)
    correct = series.shift(1, fill_value=False).astype(bool)

    assert broken.dtype == object
    assert correct.dtype == bool
    assert list(series & ~correct) == [False, True, False, False, True]


# --------------------------------------------------------------------------
# T21 - warm-up length must not change the signals we act on
# --------------------------------------------------------------------------


def test_t21_configured_warmup_produces_stable_signals(strategy, candles):
    """The configured warm-up must be long enough that lengthening it further
    does not change a single entry or exit signal.

    Indicator drift alone is not the test: an EMA that differs by 0.2% may or
    may not flip a crossover. What matters is whether the DECISIONS change.
    """
    import pandas as pd

    configured = strategy.startup_candle_count
    reference = 1600

    def signals_for(warmup, eval_window):
        start = len(candles) - eval_window - warmup
        assert start >= 0, "not enough history for this warm-up comparison"
        analyzed = analyze(strategy, candles.iloc[start:].reset_index(drop=True))
        tail = analyzed.iloc[warmup:].reset_index(drop=True)
        return (
            pd.to_numeric(tail["enter_long"], errors="coerce").fillna(0).to_numpy(),
            pd.to_numeric(tail["exit_long"], errors="coerce").fillna(0).to_numpy(),
        )

    # Several windows, because a single one can converge by luck: warm-up 600
    # looked stable at 800 and 1500 candles and was still off by 2 at 1200.
    for eval_window in (800, 1200, 1500):
        entries_cfg, exits_cfg = signals_for(configured, eval_window)
        entries_ref, exits_ref = signals_for(reference, eval_window)

        n = min(len(entries_cfg), len(entries_ref))
        entry_diff = int((entries_cfg[-n:] != entries_ref[-n:]).sum())
        exit_diff = int((exits_cfg[-n:] != exits_ref[-n:]).sum())

        assert entry_diff == 0, (
            f"warm-up {configured} produces {entry_diff} different entry signal(s) "
            f"than warm-up {reference} over a {eval_window}-candle window; the "
            "warm-up is too short"
        )
        assert exit_diff == 0, (
            f"warm-up {configured} produces {exit_diff} different exit signal(s) "
            f"than warm-up {reference} over a {eval_window}-candle window"
        )


def test_t21_a_deliberately_short_warmup_is_detectably_worse(strategy, candles):
    """Guard against the previous test passing vacuously: a 200-candle
    warm-up must actually be measurable as different."""
    import pandas as pd

    eval_window = 1200

    def signals_for(warmup):
        start = len(candles) - eval_window - warmup
        analyzed = analyze(strategy, candles.iloc[start:].reset_index(drop=True))
        tail = analyzed.iloc[warmup:].reset_index(drop=True)
        return pd.to_numeric(tail["enter_long"], errors="coerce").fillna(0).to_numpy()

    short = signals_for(200)
    long = signals_for(1600)
    n = min(len(short), len(long))

    assert int((short[-n:] != long[-n:]).sum()) > 0, (
        "a 200-candle warm-up shows no signal difference on this data, so the "
        "stability test above proves nothing here"
    )
