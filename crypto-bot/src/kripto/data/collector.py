"""Incremental OHLCV collection with an honest coverage manifest.

The collector never claims more history than the exchange actually gave it.
Two behaviours encode that:

* A response at the per-call cap is treated as TRUNCATED, not complete. The
  collector then probes backwards to find out whether earlier history exists
  at all, rather than assuming pagination works or assuming it does not.
* Whatever it could not fetch is recorded as a coverage boundary in the
  manifest, so a later report can say "12 months of 4h" and "17 days of 5m"
  separately instead of implying one from the other.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

import pandas as pd

from .hyperliquid_client import MAX_CANDLES_PER_CALL, HyperliquidInfoClient, SpotMarket
from .quality import QualityReport, check_candles, timeframe_delta
from .store import atomic_write, file_hash, merge_candles, pair_to_filename, read_candles

logger = logging.getLogger(__name__)

# How many recent candles to re-fetch on every run. The most recent candles
# can still be settling, so re-fetching and merging them is cheaper than
# reasoning about when they became final.
OVERLAP_CANDLES = 10


def candles_to_frame(raw: Iterable[dict]) -> pd.DataFrame:
    """Convert Hyperliquid's candle dicts into the canonical frame.

    Hyperliquid keys: t=open time ms, T=close time ms, o/h/l/c, v=base volume,
    n=trade count, s=coin, i=interval.
    """
    rows = [
        {
            "date": pd.Timestamp(item["t"], unit="ms", tz="UTC"),
            "open": float(item["o"]),
            "high": float(item["h"]),
            "low": float(item["l"]),
            "close": float(item["c"]),
            "volume": float(item["v"]),
        }
        for item in raw
    ]
    if not rows:
        return pd.DataFrame(columns=["date", "open", "high", "low", "close", "volume"])
    return pd.DataFrame(rows)


@dataclass
class CoverageResult:
    pair: str
    market_id: str
    timeframe: str
    rows: int = 0
    first_date: str = ""
    last_date: str = ""
    span_days: float = 0.0
    requests_made: int = 0
    history_truncated_by_api: bool = False
    earliest_reachable: str = ""
    file_path: str = ""
    file_hash: str = ""
    quality: QualityReport | None = None
    notes: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "pair": self.pair,
            "market_id": self.market_id,
            "timeframe": self.timeframe,
            "rows": self.rows,
            "first_date": self.first_date,
            "last_date": self.last_date,
            "span_days": round(self.span_days, 2),
            "requests_made": self.requests_made,
            "history_truncated_by_api": self.history_truncated_by_api,
            "earliest_reachable": self.earliest_reachable,
            "file_path": self.file_path,
            "file_hash": self.file_hash,
            "notes": self.notes,
            "quality": self.quality.as_dict() if self.quality else None,
        }


class Collector:
    def __init__(
        self,
        client: HyperliquidInfoClient,
        datadir: Path,
        *,
        now: datetime | None = None,
    ):
        self.client = client
        self.datadir = Path(datadir)
        self._now = now

    def now(self) -> datetime:
        return self._now or datetime.now(timezone.utc)

    def collect(
        self,
        market: SpotMarket,
        pair: str,
        timeframe: str,
        *,
        max_backward_probes: int = 6,
    ) -> CoverageResult:
        """Fetch, merge and persist one (pair, timeframe)."""
        result = CoverageResult(pair=pair, market_id=market.market_id, timeframe=timeframe)
        delta = timeframe_delta(timeframe)
        step_ms = int(delta.total_seconds() * 1000)
        now = self.now()
        now_ms = int(now.timestamp() * 1000)

        target = self.datadir / pair_to_filename(pair, timeframe)
        existing = read_candles(target)

        start_requests = self.client.request_count

        # --- choose the fetch window ---------------------------------------
        # First collection: ask for the widest window the API accepts, then
        # probe backwards to find the true start of history.
        # Later collections: ask only for a small overlapping tail. History
        # does not grow backwards, so re-probing it every run would re-download
        # the whole series forever.
        window_ms = MAX_CANDLES_PER_CALL * step_ms
        is_first_collection = existing is None or existing.empty

        if is_first_collection:
            start_ms = now_ms - window_ms
        else:
            last_open = existing["date"].iloc[-1].to_pydatetime()
            start_ms = int((last_open - OVERLAP_CANDLES * delta).timestamp() * 1000)

        raw = self.client.candles(market.market_id, timeframe, start_ms, now_ms)
        frame = candles_to_frame(raw)
        truncated = self.client.response_is_truncated(raw)

        # --- probe backwards: does earlier history exist? -----------------
        # The docs say only the most recent 5000 candles are available. That is
        # a claim about one call, not necessarily about the whole endpoint, so
        # we measure instead of assuming in either direction.
        if is_first_collection and not frame.empty:
            probes = 0
            while probes < max_backward_probes:
                earliest_ms = int(frame["date"].iloc[0].timestamp() * 1000)
                probe_start = earliest_ms - window_ms
                probe_end = earliest_ms - step_ms
                if probe_end <= probe_start:
                    break
                older_raw = self.client.candles(
                    market.market_id, timeframe, probe_start, probe_end
                )
                older = candles_to_frame(older_raw)
                if older.empty:
                    # Nothing earlier is reachable. Either the market started
                    # here, or the API refuses to look further back.
                    break
                new_earliest = older["date"].iloc[0]
                frame = merge_candles(frame, older)
                probes += 1
                if new_earliest >= pd.Timestamp(earliest_ms, unit="ms", tz="UTC"):
                    break  # no progress; stop rather than loop forever
            if probes:
                result.notes.append(
                    f"backward probing recovered earlier history in {probes} extra call(s)"
                )
            if probes >= max_backward_probes:
                result.notes.append(
                    "backward probe limit reached; earlier history may still exist"
                )

        merged = merge_candles(existing, frame)

        if merged.empty:
            result.notes.append("no candles returned by the exchange")
            return result

        # --- quality gate before anything is written ----------------------
        report = check_candles(merged, pair, timeframe, now=now)
        result.quality = report

        result.rows = len(merged)
        first, last = merged["date"].iloc[0], merged["date"].iloc[-1]
        result.first_date = first.isoformat()
        result.last_date = last.isoformat()
        result.span_days = (last - first).total_seconds() / 86400.0
        result.history_truncated_by_api = truncated
        result.earliest_reachable = first.isoformat()
        result.requests_made = self.client.request_count - start_requests

        if report.fatal:
            result.notes.append(
                "FATAL data findings - file NOT written: "
                + "; ".join(f.code for f in report.fatal)
            )
            return result

        result.file_hash = atomic_write(merged, target)
        result.file_path = str(target)
        return result
