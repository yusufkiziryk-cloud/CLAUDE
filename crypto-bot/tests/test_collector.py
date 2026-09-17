"""Collector behaviour, driven by a deterministic fake exchange.

The fake reproduces the two properties that actually shape our design:
it returns at most 5000 candles per call, and it always returns the MOST
RECENT candles inside the requested window.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import pytest

from kripto.data.collector import Collector, candles_to_frame
from kripto.data.hyperliquid_client import MAX_CANDLES_PER_CALL, SpotMarket
from kripto.data.store import frame_hash, read_candles

STEP = timedelta(hours=4)
LISTING = datetime(2025, 2, 3, tzinfo=timezone.utc)
NOW = datetime(2026, 9, 17, 20, tzinfo=timezone.utc)

MARKET = SpotMarket(
    market_id="@142",
    base_token="UBTC",
    quote_token="USDC",
    base_token_index=197,
    quote_token_index=0,
    is_canonical=False,
    base_size_decimals=5,
    base_wei_decimals=10,
    base_token_id="0xdeadbeef",
    evm_contract={"address": "0xabc"},
    full_name="Unit Bitcoin",
)


class FakeClient:
    """Deterministic stand-in for the public info endpoint."""

    def __init__(self, total_candles=3551, cap=MAX_CANDLES_PER_CALL, last_open=NOW):
        self.cap = cap
        self.request_count = 0
        self.windows: list[tuple[int, int]] = []
        first_open = last_open - (total_candles - 1) * STEP
        self.candles_all = [
            {
                "t": int((first_open + i * STEP).timestamp() * 1000),
                "o": 100 + i * 0.1,
                "h": 101 + i * 0.1,
                "l": 99 + i * 0.1,
                "c": 100.5 + i * 0.1,
                "v": 5.0 + i,
            }
            for i in range(total_candles)
        ]

    def candles(self, market_id, interval, start_ms, end_ms):
        self.request_count += 1
        self.windows.append((start_ms, end_ms))
        inside = [c for c in self.candles_all if start_ms <= c["t"] <= end_ms]
        # The real endpoint returns the most recent candles when capped.
        return inside[-self.cap :]

    @staticmethod
    def response_is_truncated(candles):
        return len(candles) >= MAX_CANDLES_PER_CALL


def collect(tmp_path, client, timeframe="4h"):
    collector = Collector(client, Path(tmp_path), now=NOW)
    return collector.collect(MARKET, "BTC/USDC", timeframe)


def test_first_run_fetches_the_whole_listed_history(tmp_path):
    client = FakeClient(total_candles=3551)

    result = collect(tmp_path, client)

    assert result.rows == 3551
    assert result.file_path, "a clean collection must be written to disk"
    assert not result.history_truncated_by_api
    assert result.quality.tradable


def test_rerun_is_idempotent(tmp_path):
    """T26 support: same inputs, same output file, no row multiplication."""
    client = FakeClient(total_candles=3551)

    first = collect(tmp_path, client)
    first_hash = frame_hash(read_candles(Path(first.file_path)))

    second = collect(tmp_path, FakeClient(total_candles=3551))
    second_hash = frame_hash(read_candles(Path(second.file_path)))

    assert second.rows == first.rows == 3551
    assert second_hash == first_hash


def test_incremental_run_only_requests_a_recent_window(tmp_path):
    """After a full history exists, a refresh must not re-download everything."""
    client = FakeClient(total_candles=3551)
    collect(tmp_path, client)

    fresh = FakeClient(total_candles=3551)
    collect(tmp_path, fresh)

    first_window = fresh.windows[0]
    requested_span_days = (first_window[1] - first_window[0]) / 86_400_000
    full_history_days = 3551 * 4 / 24
    assert requested_span_days < full_history_days, (
        "incremental refresh still asked for the entire history"
    )


def test_new_candles_are_appended_without_duplicates(tmp_path):
    client = FakeClient(total_candles=3551, last_open=NOW - 10 * STEP)
    collect(tmp_path, client)

    grown = FakeClient(total_candles=3561, last_open=NOW)  # ten new candles appeared
    result = collect(tmp_path, grown)

    frame = read_candles(Path(result.file_path))
    assert len(frame) == 3561
    assert not frame["date"].duplicated().any()
    assert frame["date"].is_monotonic_increasing


def test_per_call_cap_is_treated_as_truncation(tmp_path):
    """A full response means "there may be more", never "that is all"."""
    client = FakeClient(total_candles=12000)

    result = collect(tmp_path, client)

    assert result.history_truncated_by_api is True
    # Backward probing must have recovered more than one call's worth.
    assert result.rows > MAX_CANDLES_PER_CALL
    assert any("backward probing" in note for note in result.notes)


def test_fatal_quality_finding_prevents_the_file_from_being_written(tmp_path):
    client = FakeClient(total_candles=200)
    client.candles_all[50]["h"] = 1.0  # high below low: impossible candle

    result = collect(tmp_path, client)

    assert result.file_path == "", "corrupt data must not be persisted"
    assert not result.quality.tradable
    assert any("FATAL" in note for note in result.notes)


def test_empty_exchange_response_is_reported_not_faked(tmp_path):
    client = FakeClient(total_candles=0)

    result = collect(tmp_path, client)

    assert result.rows == 0
    assert result.file_path == ""
    assert any("no candles" in note for note in result.notes)


def test_candles_to_frame_maps_hyperliquid_fields_correctly():
    raw = [{"t": 1767225600000, "o": "1.5", "h": "2.5", "l": "1.0", "c": "2.0", "v": "42"}]

    frame = candles_to_frame(raw)

    assert frame["date"].iloc[0] == pd.Timestamp("2026-01-01T00:00:00Z")
    assert frame["open"].iloc[0] == 1.5
    assert frame["high"].iloc[0] == 2.5
    assert frame["low"].iloc[0] == 1.0
    assert frame["close"].iloc[0] == 2.0
    assert frame["volume"].iloc[0] == 42.0


def test_bridged_wrapper_is_visible_on_the_market_object():
    """The naming trap: ccxt says BTC, the exchange trades UBTC."""
    assert MARKET.display_symbol == "BTC/USDC"
    assert MARKET.base_token == "UBTC"
    assert MARKET.is_bridged_wrapper is True
