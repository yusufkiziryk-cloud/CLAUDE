"""T19 - broken, gapped, duplicated and out-of-order candles are refused or
marked, and the still-forming candle never reaches a signal."""

from datetime import datetime, timedelta, timezone

import pandas as pd
import pytest

from kripto.data.quality import (
    Severity,
    check_candles,
    drop_incomplete_candle,
)
from kripto.data.store import merge_candles, normalise

START = datetime(2026, 1, 1, tzinfo=timezone.utc)
STEP = timedelta(hours=4)
# "Now" is well after the last generated candle so the incomplete-candle check
# does not fire unless a test wants it to.
NOW = START + timedelta(days=30)


def make_frame(count=10, start=START, step=STEP):
    rows = []
    for i in range(count):
        base = 100.0 + i
        rows.append(
            {
                "date": start + i * step,
                "open": base,
                "high": base + 2,
                "low": base - 2,
                "close": base + 1,
                "volume": 10.0 + i,
            }
        )
    return pd.DataFrame(rows)


def codes(report):
    return {f.code for f in report.findings}


def test_clean_data_produces_no_findings():
    report = check_candles(make_frame(), "BTC/USDC", "4h", now=NOW)

    assert report.findings == []
    assert report.tradable
    assert report.rows == 10


def test_duplicate_open_time_is_fatal():
    df = make_frame()
    df = pd.concat([df, df.iloc[[3]]], ignore_index=True).sort_values("date")

    report = check_candles(df, "BTC/USDC", "4h", now=NOW)

    assert "DUPLICATE_OPEN_TIME" in codes(report)
    assert not report.tradable


def test_out_of_order_candles_are_fatal():
    df = make_frame()
    df.iloc[[2, 5]] = df.iloc[[5, 2]].values

    report = check_candles(df, "BTC/USDC", "4h", now=NOW)

    assert "OUT_OF_ORDER" in codes(report)
    assert not report.tradable


def test_gap_is_reported_and_never_filled():
    df = make_frame(10).drop(index=[4, 5]).reset_index(drop=True)

    report = check_candles(df, "BTC/USDC", "4h", now=NOW)

    assert "GAPS" in codes(report)
    assert len(report.gaps) == 1
    assert report.gaps[0][2] == 2, "two candles are missing"
    # A gap is a WARN, not a FATAL: the data is usable outside the gap.
    assert report.rows == 8, "the missing candles must NOT have been invented"


def test_misaligned_open_time_is_fatal():
    df = make_frame()
    df.loc[3, "date"] = df.loc[3, "date"] + timedelta(minutes=17)

    report = check_candles(df, "BTC/USDC", "4h", now=NOW)

    assert "MISALIGNED_OPEN_TIME" in codes(report)


@pytest.mark.parametrize(
    "column,value,code",
    [
        ("volume", -1.0, "NEGATIVE_VOLUME"),
        ("close", 0.0, "NON_POSITIVE_PRICE"),
        ("open", -5.0, "NON_POSITIVE_PRICE"),
        ("close", float("nan"), "NAN_VALUES"),
        ("high", float("inf"), "NON_FINITE"),
    ],
)
def test_impossible_values_are_fatal(column, value, code):
    df = make_frame()
    df.loc[4, column] = value

    report = check_candles(df, "BTC/USDC", "4h", now=NOW)

    assert code in codes(report)
    assert not report.tradable


def test_high_below_low_is_fatal():
    df = make_frame()
    df.loc[6, "high"] = df.loc[6, "low"] - 1

    report = check_candles(df, "BTC/USDC", "4h", now=NOW)

    assert "IMPOSSIBLE_OHLC" in codes(report)


def test_close_outside_high_low_is_fatal():
    df = make_frame()
    df.loc[2, "close"] = df.loc[2, "high"] + 10

    report = check_candles(df, "BTC/USDC", "4h", now=NOW)

    assert "IMPOSSIBLE_OHLC" in codes(report)


def test_future_timestamps_are_fatal():
    """Clock skew, or data from a source that is not this exchange."""
    df = make_frame()
    report = check_candles(df, "BTC/USDC", "4h", now=START - timedelta(days=5))

    assert "FUTURE_TIMESTAMPS" in codes(report)


def test_incomplete_last_candle_is_flagged():
    df = make_frame(5)
    last_open = df["date"].iloc[-1]
    # Two hours into a four-hour candle: it has not closed.
    report = check_candles(df, "BTC/USDC", "4h", now=last_open.to_pydatetime() + timedelta(hours=2))

    assert "INCOMPLETE_LAST_CANDLE" in codes(report)
    finding = next(f for f in report.findings if f.code == "INCOMPLETE_LAST_CANDLE")
    assert finding.severity is Severity.WARN


def test_drop_incomplete_candle_removes_only_the_forming_one():
    df = make_frame(5)
    last_open = df["date"].iloc[-1].to_pydatetime()

    trimmed = drop_incomplete_candle(df, "4h", now=last_open + timedelta(hours=2))

    assert len(trimmed) == 4
    assert trimmed["date"].iloc[-1] == df["date"].iloc[-2]


def test_drop_incomplete_candle_keeps_everything_once_closed():
    df = make_frame(5)
    last_open = df["date"].iloc[-1].to_pydatetime()

    trimmed = drop_incomplete_candle(df, "4h", now=last_open + timedelta(hours=4))

    assert len(trimmed) == 5


def test_empty_frame_is_fatal():
    report = check_candles(pd.DataFrame(columns=["date", "open", "high", "low", "close", "volume"]),
                           "BTC/USDC", "4h", now=NOW)

    assert "EMPTY" in codes(report)


# --------------------------------------------------------------------------
# T26 support: merging must be idempotent
# --------------------------------------------------------------------------


def test_merge_is_idempotent():
    df = make_frame(10)

    once = merge_candles(None, df)
    twice = merge_candles(once, df)
    thrice = merge_candles(twice, df)

    pd.testing.assert_frame_equal(once, twice)
    pd.testing.assert_frame_equal(twice, thrice)
    assert len(thrice) == 10


def test_merge_with_overlap_does_not_duplicate():
    first = make_frame(10)
    # A second fetch that re-covers the last 4 candles and adds 3 new ones.
    second = make_frame(7, start=START + 6 * STEP)

    merged = merge_candles(first, second)

    assert len(merged) == 13
    assert merged["date"].is_monotonic_increasing
    assert not merged["date"].duplicated().any()


def test_merge_prefers_the_newer_copy_of_a_repeated_candle():
    first = make_frame(5)
    second = first.copy()
    second.loc[4, "close"] = 999.0

    merged = merge_candles(first, second)

    assert merged.loc[4, "close"] == 999.0


def test_normalise_sorts_and_deduplicates():
    df = make_frame(5)
    shuffled = pd.concat([df.iloc[[3, 1, 4]], df.iloc[[1]]], ignore_index=True)

    result = normalise(shuffled)

    assert result["date"].is_monotonic_increasing
    assert len(result) == 3
