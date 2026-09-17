"""Pure OHLCV quality checks.

Every function here takes a DataFrame and returns findings. Nothing repairs
data silently: a gap stays a gap, because forward-filling a missing candle
manufactures a price that never traded and then lets the strategy trade on it.

The DataFrame contract matches freqtrade's: columns
``date, open, high, low, close, volume`` with ``date`` being the UTC OPEN
time of the candle, tz-aware.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum

import pandas as pd

OHLCV_COLUMNS = ["date", "open", "high", "low", "close", "volume"]

TIMEFRAME_MINUTES = {
    "1m": 1,
    "3m": 3,
    "5m": 5,
    "15m": 15,
    "30m": 30,
    "1h": 60,
    "2h": 120,
    "4h": 240,
    "8h": 480,
    "12h": 720,
    "1d": 1440,
}


class Severity(str, Enum):
    """FATAL bars the pair from trading. WARN marks the affected region."""

    FATAL = "FATAL"
    WARN = "WARN"


@dataclass(frozen=True)
class Finding:
    code: str
    severity: Severity
    message: str
    rows: int = 0
    first_date: str = ""
    last_date: str = ""


@dataclass
class QualityReport:
    pair: str
    timeframe: str
    rows: int
    findings: list[Finding] = field(default_factory=list)
    first_date: str = ""
    last_date: str = ""
    gaps: list[tuple[str, str, int]] = field(default_factory=list)

    @property
    def fatal(self) -> list[Finding]:
        return [f for f in self.findings if f.severity is Severity.FATAL]

    @property
    def tradable(self) -> bool:
        """A pair with any FATAL finding must not produce entries."""
        return not self.fatal

    def as_dict(self) -> dict:
        return {
            "pair": self.pair,
            "timeframe": self.timeframe,
            "rows": self.rows,
            "first_date": self.first_date,
            "last_date": self.last_date,
            "tradable": self.tradable,
            "gaps": [
                {"from": start, "to": end, "missing_candles": count}
                for start, end, count in self.gaps
            ],
            "findings": [
                {
                    "code": f.code,
                    "severity": f.severity.value,
                    "message": f.message,
                    "rows": f.rows,
                    "first_date": f.first_date,
                    "last_date": f.last_date,
                }
                for f in self.findings
            ],
        }


def timeframe_delta(timeframe: str) -> timedelta:
    if timeframe not in TIMEFRAME_MINUTES:
        raise ValueError(f"unsupported timeframe: {timeframe!r}")
    return timedelta(minutes=TIMEFRAME_MINUTES[timeframe])


def _fmt(value) -> str:
    if isinstance(value, pd.Timestamp):
        return value.strftime("%Y-%m-%d %H:%M:%S%z")
    return str(value)


def check_candles(
    df: pd.DataFrame,
    pair: str,
    timeframe: str,
    *,
    now: datetime | None = None,
) -> QualityReport:
    """Run every structural check and return a report.

    ``now`` is injected rather than read from the clock so the incomplete-candle
    check is deterministic in tests.
    """
    report = QualityReport(pair=pair, timeframe=timeframe, rows=len(df))

    missing_columns = [c for c in OHLCV_COLUMNS if c not in df.columns]
    if missing_columns:
        report.findings.append(
            Finding(
                "MISSING_COLUMNS",
                Severity.FATAL,
                f"missing required column(s): {missing_columns}",
            )
        )
        return report

    if df.empty:
        report.findings.append(Finding("EMPTY", Severity.FATAL, "no candles at all"))
        return report

    dates = pd.to_datetime(df["date"], utc=True)
    report.first_date = _fmt(dates.iloc[0])
    report.last_date = _fmt(dates.iloc[-1])

    # --- 1. timezone and ordering ----------------------------------------
    if dates.dt.tz is None:
        report.findings.append(
            Finding("NAIVE_TIMESTAMPS", Severity.FATAL, "timestamps are not timezone aware")
        )
    if not dates.is_monotonic_increasing:
        out_of_order = int((dates.diff().dropna() <= pd.Timedelta(0)).sum())
        report.findings.append(
            Finding(
                "OUT_OF_ORDER",
                Severity.FATAL,
                f"{out_of_order} candle(s) are not in ascending time order",
                rows=out_of_order,
            )
        )

    # --- 2. duplicates on the uniqueness key ------------------------------
    duplicate_mask = dates.duplicated(keep=False)
    if duplicate_mask.any():
        dupes = int(duplicate_mask.sum())
        report.findings.append(
            Finding(
                "DUPLICATE_OPEN_TIME",
                Severity.FATAL,
                f"{dupes} row(s) share an open_time; (exchange, market_id, timeframe, "
                "open_time) must be unique",
                rows=dupes,
                first_date=_fmt(dates[duplicate_mask].iloc[0]),
            )
        )

    # --- 3. candle grid alignment ----------------------------------------
    delta = timeframe_delta(timeframe)
    step_ms = int(delta.total_seconds() * 1000)
    # Compute epoch milliseconds without depending on the Series' underlying
    # datetime resolution (pandas 3 does not always use nanoseconds).
    epoch_ms = (dates - pd.Timestamp(0, tz="UTC")) // pd.Timedelta(milliseconds=1)
    misaligned = int((epoch_ms % step_ms != 0).sum())
    if misaligned:
        report.findings.append(
            Finding(
                "MISALIGNED_OPEN_TIME",
                Severity.FATAL,
                f"{misaligned} candle(s) do not start on a {timeframe} boundary",
                rows=misaligned,
            )
        )

    # --- 4. gaps (reported, never filled) ---------------------------------
    if dates.is_monotonic_increasing and len(dates) > 1:
        diffs = dates.diff().dropna()
        gap_positions = diffs[diffs > delta]
        for position, gap in gap_positions.items():
            missing = int(gap / delta) - 1
            previous = dates.loc[position - 1] if position - 1 in dates.index else None
            report.gaps.append((_fmt(previous), _fmt(dates.loc[position]), missing))
        if report.gaps:
            total_missing = sum(g[2] for g in report.gaps)
            report.findings.append(
                Finding(
                    "GAPS",
                    Severity.WARN,
                    f"{len(report.gaps)} gap(s) totalling {total_missing} missing candle(s). "
                    "Gaps are marked, never forward-filled; entries are suppressed in the "
                    "affected region.",
                    rows=total_missing,
                    first_date=report.gaps[0][0],
                    last_date=report.gaps[-1][1],
                )
            )

    # --- 5. OHLC sanity ----------------------------------------------------
    numeric = df[["open", "high", "low", "close", "volume"]].astype("float64")

    nan_rows = int(numeric.isna().any(axis=1).sum())
    if nan_rows:
        report.findings.append(
            Finding("NAN_VALUES", Severity.FATAL, f"{nan_rows} row(s) contain NaN", rows=nan_rows)
        )

    non_finite = int((~numeric.apply(lambda s: s.abs() < float("inf")).all(axis=1)).sum())
    if non_finite:
        report.findings.append(
            Finding(
                "NON_FINITE", Severity.FATAL, f"{non_finite} row(s) contain Infinity", rows=non_finite
            )
        )

    non_positive = int(
        (numeric[["open", "high", "low", "close"]] <= 0).any(axis=1).sum()
    )
    if non_positive:
        report.findings.append(
            Finding(
                "NON_POSITIVE_PRICE",
                Severity.FATAL,
                f"{non_positive} row(s) have a zero or negative price",
                rows=non_positive,
            )
        )

    negative_volume = int((numeric["volume"] < 0).sum())
    if negative_volume:
        report.findings.append(
            Finding(
                "NEGATIVE_VOLUME",
                Severity.FATAL,
                f"{negative_volume} row(s) have negative volume",
                rows=negative_volume,
            )
        )

    impossible = (
        (numeric["high"] < numeric["low"])
        | (numeric["high"] < numeric["open"])
        | (numeric["high"] < numeric["close"])
        | (numeric["low"] > numeric["open"])
        | (numeric["low"] > numeric["close"])
    )
    impossible_rows = int(impossible.sum())
    if impossible_rows:
        report.findings.append(
            Finding(
                "IMPOSSIBLE_OHLC",
                Severity.FATAL,
                f"{impossible_rows} row(s) violate low <= open/close <= high",
                rows=impossible_rows,
                first_date=_fmt(dates[impossible].iloc[0]),
            )
        )

    # --- 6. the still-forming candle --------------------------------------
    reference = now or datetime.now(timezone.utc)
    last_open = dates.iloc[-1].to_pydatetime()
    if last_open + delta > reference:
        report.findings.append(
            Finding(
                "INCOMPLETE_LAST_CANDLE",
                Severity.WARN,
                f"the last candle opening {_fmt(dates.iloc[-1])} has not closed yet at "
                f"{reference.isoformat()}; it must be dropped before any signal is computed",
                rows=1,
                first_date=_fmt(dates.iloc[-1]),
            )
        )

    # --- 7. clock skew: data from the future ------------------------------
    future = int((dates > pd.Timestamp(reference) + delta).sum())
    if future:
        report.findings.append(
            Finding(
                "FUTURE_TIMESTAMPS",
                Severity.FATAL,
                f"{future} candle(s) open later than now+1 candle; clock skew or bad source",
                rows=future,
            )
        )

    return report


def drop_incomplete_candle(
    df: pd.DataFrame, timeframe: str, *, now: datetime | None = None
) -> pd.DataFrame:
    """Return only candles that have definitely closed.

    Signals are computed on completed candles only. Leaving the forming candle
    in is one of the easiest ways to produce a backtest that cannot be
    reproduced live.
    """
    if df.empty:
        return df
    reference = now or datetime.now(timezone.utc)
    delta = timeframe_delta(timeframe)
    dates = pd.to_datetime(df["date"], utc=True)
    return df.loc[dates + delta <= pd.Timestamp(reference)].reset_index(drop=True)
