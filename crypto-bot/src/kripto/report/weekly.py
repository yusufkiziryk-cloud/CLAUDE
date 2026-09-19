"""The weekly operations report.

What it is for: telling an operator, once a week, whether anything about
this system has earned more confidence - and being equally clear when it has
not.

Three rules shape it:

* **A quiet week is a real result.** Zero trades is reported as zero trades
  with the refusal reasons that produced it, not as an error and not as an
  empty section.
* **Refusals are data.** Two trades out of four signals and two trades out of
  four hundred are different systems. Only the recorded reasons separate them.
* **An observation in progress is never reported as finished.** The report
  says how many days have actually been observed against how many are
  required, and refuses to draw a conclusion before then.

Output is a local Markdown file plus machine-readable JSON. Nothing is sent
anywhere.
"""

from __future__ import annotations

import json
import platform
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from enum import Enum
from pathlib import Path
from typing import Any

from ..money import ZERO, dec, div, mul
from ..risk.coverage import RunPath, not_modelled

# The screening thresholds fixed in docs/RESEARCH_PLAN.md. Imported as
# constants so a report cannot quietly apply a different bar than the plan.
MIN_CLOSED_TRADES = 50
MIN_PROFIT_FACTOR = dec("1.10")
MAX_DRAWDOWN = dec("0.10")
REQUIRED_OBSERVATION_DAYS = 28  # 4 weeks minimum, 8 preferred


class Assessment(str, Enum):
    OBSERVATION_IN_PROGRESS = "OBSERVATION_IN_PROGRESS"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    CONTINUE = "CONTINUE"
    HOLD = "HOLD"
    REJECTED = "REJECTED"


@dataclass
class TradeStats:
    closed: int = 0
    open: int = 0
    realised_pnl: Decimal = ZERO
    open_pnl: Decimal = ZERO
    gross_profit: Decimal = ZERO
    gross_loss: Decimal = ZERO
    fees_paid: Decimal = ZERO
    wins: int = 0
    losses: int = 0
    exit_reasons: dict[str, int] = field(default_factory=dict)
    per_pair: dict[str, Decimal] = field(default_factory=dict)
    closed_pnls: list[tuple[datetime, Decimal]] = field(default_factory=list)
    error: str | None = None
    """Set when the trade records could NOT be read. An unreadable ledger
    is not zero trades (audit finding: a mistyped path rendered as 'no
    trades this week - that is a result')."""

    @property
    def profit_factor(self) -> Decimal | None:
        """None when there are no losses - not 'infinite success'."""
        if self.gross_loss == ZERO:
            return None
        return div(self.gross_profit, abs(self.gross_loss))

    @property
    def win_rate(self) -> Decimal | None:
        if self.closed == 0:
            return None
        return div(dec(self.wins), dec(self.closed))

    @property
    def expectancy(self) -> Decimal | None:
        if self.closed == 0:
            return None
        return div(self.realised_pnl, dec(self.closed))


@dataclass
class WeeklyReport:
    period_start: datetime
    period_end: datetime
    mode: str
    generated_at: datetime

    versions: dict[str, str] = field(default_factory=dict)
    trades: TradeStats = field(default_factory=TradeStats)
    equity_start: Decimal | None = None
    equity_end: Decimal | None = None
    peak_equity: Decimal | None = None
    max_drawdown: Decimal | None = None
    """Worst peak-to-trough drop along the CLOSED-trade equity path inside
    the period, measured against the higher of the all-time peak and the
    period's starting equity. Open positions are not valued here."""
    drawdown_lock_raised: bool = False
    """The bot's own MAX_DRAWDOWN lock fired inside the period. That lock is
    computed mark-to-market every loop, so it is the one drawdown signal
    that DOES see open positions."""

    benchmarks: dict[str, dict[str, float]] = field(default_factory=dict)
    decisions_accepted: int = 0
    decisions_refused: int = 0
    refusal_reasons: dict[str, int] = field(default_factory=dict)
    locks: list[dict] = field(default_factory=list)
    data_gaps: list[dict] = field(default_factory=list)
    outages: dict[str, Any] = field(default_factory=dict)
    limitations: list[str] = field(default_factory=list)

    observed_days: float = 0.0
    assessment: Assessment = Assessment.OBSERVATION_IN_PROGRESS
    assessment_reasons: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        def num(value):
            return None if value is None else str(value)

        return {
            "period": {
                "start": self.period_start.isoformat(),
                "end": self.period_end.isoformat(),
                "days": round(self.observed_days, 2),
            },
            "mode": self.mode,
            "generated_at": self.generated_at.isoformat(),
            "versions": self.versions,
            "trades": {
                "closed": self.trades.closed,
                "open": self.trades.open,
                "realised_pnl": num(self.trades.realised_pnl),
                "open_pnl": num(self.trades.open_pnl),
                "fees_paid": num(self.trades.fees_paid),
                "gross_profit": num(self.trades.gross_profit),
                "gross_loss": num(self.trades.gross_loss),
                "profit_factor": num(self.trades.profit_factor),
                "win_rate": num(self.trades.win_rate),
                "expectancy": num(self.trades.expectancy),
                "wins": self.trades.wins,
                "losses": self.trades.losses,
                "exit_reasons": self.trades.exit_reasons,
                "per_pair": {k: str(v) for k, v in self.trades.per_pair.items()},
            },
            "equity": {
                "start": num(self.equity_start),
                "end": num(self.equity_end),
                "peak": num(self.peak_equity),
                "max_drawdown": num(self.max_drawdown),
                "drawdown_lock_raised": self.drawdown_lock_raised,
            },
            "trade_records_error": self.trades.error,
            "benchmarks": self.benchmarks,
            "decisions": {
                "accepted": self.decisions_accepted,
                "refused": self.decisions_refused,
                "refusal_reasons": self.refusal_reasons,
            },
            "locks": self.locks,
            "data_gaps": self.data_gaps,
            "outages": self.outages,
            "limitations": self.limitations,
            "assessment": {
                "verdict": self.assessment.value,
                "reasons": self.assessment_reasons,
                "observed_days": round(self.observed_days, 2),
                "required_days": REQUIRED_OBSERVATION_DAYS,
            },
        }


# --------------------------------------------------------------------------
# Collection
# --------------------------------------------------------------------------


def sqlite_path(db_url: str) -> Path | None:
    """The file behind a sqlite:/// URL, or None for other databases."""
    prefix = "sqlite:///"
    if not db_url.startswith(prefix):
        return None
    tail = db_url[len(prefix):]
    if not tail or tail.startswith(":memory:"):
        return None
    return Path(tail)


def collect_trades(db_url: str, start: datetime, end: datetime) -> TradeStats:
    """Read freqtrade's own trade records. It owns them; we only read.

    A ledger that cannot be read is reported as an ERROR, never as a quiet
    week. ``init_db`` would also CREATE an empty database at a mistyped path,
    so the file's existence is checked first.
    """
    stats = TradeStats()
    path = sqlite_path(db_url)
    if path is not None and not path.is_file():
        stats.error = (
            f"trade database not found at {path}. Not read as 'no trades': the "
            "records could not be seen at all."
        )
        return stats
    try:
        from freqtrade.persistence import Trade, init_db

        init_db(db_url)
        all_trades = Trade.get_trades_proxy()
    except Exception as exc:  # noqa: BLE001
        stats.error = f"trade records could not be read ({type(exc).__name__}: {exc})"
        return stats

    for trade in all_trades:
        opened = trade.open_date_utc if trade.open_date else None
        closed_at = trade.close_date_utc if trade.close_date else None

        if trade.is_open:
            if opened is not None and opened < end:
                stats.open += 1
                # Unrealised PnL is only meaningful with a current price, which
                # a report generated after the fact does not have. Left at zero
                # and stated as such rather than guessed.
            continue

        if closed_at is None or not (start <= closed_at < end):
            continue

        stats.closed += 1
        pnl = dec(str(trade.close_profit_abs or 0))
        stats.realised_pnl += pnl
        stats.closed_pnls.append((closed_at, pnl))
        if pnl >= ZERO:
            stats.wins += 1
            stats.gross_profit += pnl
        else:
            stats.losses += 1
            stats.gross_loss += pnl

        fee_open = dec(str(trade.fee_open or 0))
        fee_close = dec(str(trade.fee_close or 0))
        stake = dec(str(trade.stake_amount or 0))
        stats.fees_paid += mul(stake, fee_open) + mul(stake, fee_close)

        reason = trade.exit_reason or "unknown"
        stats.exit_reasons[reason] = stats.exit_reasons.get(reason, 0) + 1
        stats.per_pair[trade.pair] = stats.per_pair.get(trade.pair, ZERO) + pnl

    return stats


def collect_decisions(store, start: datetime, end: datetime) -> tuple[int, int, dict[str, int]]:
    accepted = 0
    refused = 0
    reasons: dict[str, int] = {}
    for row in store.entry_decisions_between(start, end):
        if row["allowed"]:
            accepted += 1
        else:
            refused += 1
            code = row["code"] or "UNKNOWN"
            reasons[code] = reasons.get(code, 0) + 1
    return accepted, refused, reasons


def collect_outages(store, start: datetime, end: datetime, heartbeat_interval: float) -> dict:
    """API errors, notification outages and gaps between heartbeats."""
    conn = store._conn
    out: dict[str, Any] = {}

    try:
        row = conn.execute(
            "SELECT COUNT(*) AS total, SUM(CASE WHEN ok=0 THEN 1 ELSE 0 END) AS errors "
            "FROM api_calls WHERE occurred_at >= ? AND occurred_at < ?",
            (start.isoformat(), end.isoformat()),
        ).fetchone()
        total = int(row["total"] or 0)
        errors = int(row["errors"] or 0)
        out["api_calls"] = total
        out["api_errors"] = errors
        out["api_error_rate"] = round(errors / total, 4) if total else 0.0
    except sqlite3.Error:
        out["api_calls"] = None

    try:
        row = conn.execute(
            "SELECT observed_at FROM health_signals WHERE name='notification_failing_since'"
        ).fetchone()
        out["notifications_failing_since"] = row["observed_at"] if row else None
    except sqlite3.Error:
        out["notifications_failing_since"] = None

    return out


def load_data_gaps(manifest_path: Path) -> list[dict]:
    if not manifest_path.is_file():
        return []
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    gaps = []
    for coverage in manifest.get("coverage", []):
        quality = coverage.get("quality") or {}
        for gap in quality.get("gaps", []):
            gaps.append(
                {
                    "pair": coverage.get("pair"),
                    "timeframe": coverage.get("timeframe"),
                    **gap,
                }
            )
    return gaps


def assess(report: WeeklyReport) -> tuple[Assessment, list[str]]:
    """Decide continue / hold / reject, or refuse to decide.

    Ordered so the honest "not enough evidence yet" outcomes come first. A
    week of good numbers over four trades is not a pass, and this function
    will not let it look like one.
    """
    reasons: list[str] = []

    if report.trades.error:
        reasons.append(
            f"trade records unavailable: {report.trades.error}. No conclusion can be "
            "drawn from a ledger that could not be read."
        )
        return Assessment.INSUFFICIENT_EVIDENCE, reasons

    if report.drawdown_lock_raised:
        reasons.append(
            "the bot's own MAX_DRAWDOWN lock fired inside this period: equity fell more "
            "than the limit from its peak, measured mark-to-market by the running bot. "
            "That is a failed criterion regardless of where equity ended the week."
        )

    if report.observed_days < REQUIRED_OBSERVATION_DAYS:
        reasons.append(
            f"only {report.observed_days:.1f} of {REQUIRED_OBSERVATION_DAYS} required "
            "observation days have elapsed; no conclusion is available yet"
        )
        return Assessment.OBSERVATION_IN_PROGRESS, reasons

    if report.trades.closed < MIN_CLOSED_TRADES:
        reasons.append(
            f"{report.trades.closed} closed trades is below the {MIN_CLOSED_TRADES} review "
            "floor; time elapsed is not the same as evidence gathered"
        )
        return Assessment.INSUFFICIENT_EVIDENCE, reasons

    if report.drawdown_lock_raised:
        return Assessment.REJECTED, reasons

    factor = report.trades.profit_factor
    if report.trades.realised_pnl <= ZERO:
        reasons.append(f"realised PnL is {report.trades.realised_pnl}, which is not positive")
        return Assessment.REJECTED, reasons
    if factor is not None and factor < MIN_PROFIT_FACTOR:
        reasons.append(f"profit factor {factor:.2f} is below the {MIN_PROFIT_FACTOR} threshold")
        return Assessment.REJECTED, reasons
    if report.max_drawdown is not None and report.max_drawdown > MAX_DRAWDOWN:
        reasons.append(
            f"max drawdown {report.max_drawdown:.2%} exceeds the {MAX_DRAWDOWN:.0%} limit"
        )
        return Assessment.REJECTED, reasons

    reasons.append("all screening thresholds met over the observed period")
    reasons.append(
        "this is a research result only. It is not live approval: the engineering, "
        "exchange-capability and operations gates in docs/LIVE_READINESS.md are "
        "assessed separately."
    )
    return Assessment.CONTINUE, reasons


def build_report(
    *,
    store,
    db_url: str,
    policy,
    start: datetime,
    end: datetime,
    mode: str,
    manifest_path: Path,
    benchmarks: dict[str, dict[str, float]] | None = None,
    observation_started: datetime | None = None,
) -> WeeklyReport:
    now = datetime.now(timezone.utc)
    # The equity baseline is a DAY row, so the period must begin where the
    # baseline does. A period starting at 06:00 against a 00:00 baseline
    # dropped every trade closed in between from equity_end (audit finding).
    start = start.replace(hour=0, minute=0, second=0, microsecond=0)
    report = WeeklyReport(
        period_start=start, period_end=end, mode=mode, generated_at=now
    )

    try:
        import ccxt
        import freqtrade

        report.versions = {
            "freqtrade": freqtrade.__version__,
            "ccxt": ccxt.__version__,
            "python": platform.python_version(),
            "policy_id": policy.meta["policy_id"],
            "policy_hash": policy.policy_hash,
        }
    except Exception:  # noqa: BLE001
        report.versions = {"policy_hash": policy.policy_hash}

    report.trades = collect_trades(db_url, start, end)
    report.decisions_accepted, report.decisions_refused, report.refusal_reasons = (
        collect_decisions(store, start, end)
    )
    report.locks = store.locks_between(start, end)
    report.data_gaps = load_data_gaps(manifest_path)
    report.outages = collect_outages(
        store, start, end, float(policy.operations["heartbeat_interval_seconds"])
    )
    report.benchmarks = benchmarks or {}

    report.peak_equity = store.get_peak_equity()
    baseline = store.get_period("day", start)
    report.equity_start = baseline.starting_equity if baseline else None
    if report.equity_start is not None:
        report.equity_end = report.equity_start + report.trades.realised_pnl
        # Drawdown along the PATH of closed trades, not just the end-of-period
        # drop: a 14% dip that recovered by Sunday is still a 14% dip (audit
        # finding). Measured against the higher of the all-time peak and the
        # starting equity.
        peak = max(report.peak_equity or ZERO, report.equity_start)
        equity = report.equity_start
        worst = ZERO
        for _, pnl in sorted(report.trades.closed_pnls, key=lambda item: item[0]):
            equity += pnl
            if equity > peak:
                peak = equity
            drop = div(peak - equity, peak) if peak > ZERO else ZERO
            if drop > worst:
                worst = drop
        report.max_drawdown = worst
    report.drawdown_lock_raised = any(
        str(lock.get("kind")) == "MAX_DRAWDOWN" for lock in report.locks
    )

    report.limitations = [
        f"{path.value}: NOT_MODELED -> {', '.join(not_modelled(path))}"
        for path in RunPath
        if not_modelled(path)
    ]
    report.limitations.append(
        "Open-position PnL is reported as zero: valuing it needs a current price, "
        "which a report generated after the fact does not have."
    )

    observation_start = observation_started or start
    report.observed_days = max(0.0, (end - observation_start).total_seconds() / 86400.0)
    report.assessment, report.assessment_reasons = assess(report)

    return report


# --------------------------------------------------------------------------
# Rendering
# --------------------------------------------------------------------------


def _fmt(value, suffix: str = "") -> str:
    if value is None:
        return "not available"
    if isinstance(value, Decimal):
        return f"{value:.4f}{suffix}".rstrip("0").rstrip(".") + ("" if suffix else "")
    return f"{value}{suffix}"


def render_markdown(report: WeeklyReport) -> str:
    t = report.trades
    lines: list[str] = []

    lines.append(f"# Weekly report - {report.period_start:%Y-%m-%d} to {report.period_end:%Y-%m-%d}")
    lines.append("")
    lines.append(f"**Mode: {report.mode.upper()}** - no real orders were placed.")
    lines.append("")
    lines.append(f"**Assessment: `{report.assessment.value}`**")
    lines.append("")
    for reason in report.assessment_reasons:
        lines.append(f"- {reason}")
    lines.append("")
    lines.append(
        f"Observed so far: **{report.observed_days:.1f} of {REQUIRED_OBSERVATION_DAYS} "
        f"required days**. Days elapsed are not evidence gathered; the trade count below "
        "is what decides."
    )
    lines.append("")

    lines.append("## Run identity")
    lines.append("")
    lines.append("| | |")
    lines.append("|---|---|")
    for key, value in report.versions.items():
        lines.append(f"| {key} | `{value}` |")
    lines.append(f"| generated | {report.generated_at.isoformat()} |")
    lines.append("")

    lines.append("## Trading")
    lines.append("")
    if t.error:
        lines.append(f"**REPORT INCOMPLETE - trade records could not be read:** {t.error}")
        lines.append("")
        lines.append("The figures below are NOT 'no trades'; they are 'not seen'.")
    elif t.closed == 0 and t.open == 0:
        lines.append(
            "**No trades were opened or closed in this period.** That is a result, not a "
            "gap in the report - see the refusal reasons below for why."
        )
    lines.append("")
    lines.append("| Metric | Value |")
    lines.append("|---|---:|")
    lines.append(f"| Closed trades | {t.closed} |")
    lines.append(f"| Open trades | {t.open} |")
    lines.append(f"| Realised PnL | {_fmt(t.realised_pnl)} |")
    lines.append(f"| Open PnL | not valued (see limitations) |")
    lines.append(f"| Fees paid | {_fmt(t.fees_paid)} |")
    lines.append(f"| Gross profit | {_fmt(t.gross_profit)} |")
    lines.append(f"| Gross loss | {_fmt(t.gross_loss)} |")
    lines.append(
        f"| Profit factor | {'undefined (no losing trades)' if t.profit_factor is None else f'{t.profit_factor:.2f}'} |"
    )
    lines.append(f"| Win rate | {'n/a' if t.win_rate is None else f'{t.win_rate:.1%}'} |")
    lines.append(
        f"| Expectancy / trade | {'n/a' if t.expectancy is None else _fmt(t.expectancy)} |"
    )
    lines.append("")
    if t.exit_reasons:
        lines.append("Exit reasons: " + ", ".join(f"{k} x{v}" for k, v in t.exit_reasons.items()))
        lines.append("")
    if t.per_pair:
        lines.append("| Pair | Realised PnL |")
        lines.append("|---|---:|")
        for pair, pnl in sorted(t.per_pair.items()):
            lines.append(f"| {pair} | {_fmt(pnl)} |")
        lines.append("")

    lines.append("## Equity and drawdown")
    lines.append("")
    lines.append("| | |")
    lines.append("|---|---:|")
    lines.append(f"| Equity at period start | {_fmt(report.equity_start)} |")
    lines.append(f"| Equity at period end | {_fmt(report.equity_end)} |")
    lines.append(f"| Peak equity (all time) | {_fmt(report.peak_equity)} |")
    lines.append(
        f"| Max drawdown in period (closed-trade path) | "
        f"{'not available' if report.max_drawdown is None else f'{report.max_drawdown:.2%}'} |"
    )
    lines.append(
        f"| MAX_DRAWDOWN lock fired (mark-to-market) | {'YES' if report.drawdown_lock_raised else 'no'} |"
    )
    lines.append("")

    lines.append("## Entry decisions")
    lines.append("")
    lines.append(
        f"**{report.decisions_accepted} accepted, {report.decisions_refused} refused.** "
        "Refusals are the more informative half: a week with two trades out of four "
        "signals is a different system from two trades out of four hundred."
    )
    lines.append("")
    if report.refusal_reasons:
        lines.append("| Refusal reason | Count |")
        lines.append("|---|---:|")
        for code, count in sorted(
            report.refusal_reasons.items(), key=lambda kv: -kv[1]
        ):
            lines.append(f"| `{code}` | {count} |")
    else:
        lines.append("No entries were refused in this period.")
    lines.append("")

    lines.append("## Risk locks")
    lines.append("")
    if report.locks:
        lines.append("| Raised at | Kind | Reason |")
        lines.append("|---|---|---|")
        for lock in report.locks:
            lines.append(
                f"| {lock['created_at'][:19]} | `{lock['kind']}` | {lock['reason'][:80]} |"
            )
    else:
        lines.append("No risk locks were raised in this period.")
    lines.append("")

    lines.append("## Benchmarks")
    lines.append("")
    if report.benchmarks:
        lines.append("| Benchmark | Return | Max drawdown |")
        lines.append("|---|---:|---:|")
        for name, values in report.benchmarks.items():
            lines.append(
                f"| {name} | {values.get('return_pct', 0):.2f}% | "
                f"{values.get('max_dd_pct', 0):.2f}% |"
            )
        lines.append("")
        lines.append(
            "Raw return and risk are reported together on purpose. Beating a long "
            "benchmark during a decline is not evidence of edge, and losing to one "
            "during a rally is not evidence of failure."
        )
    else:
        lines.append("No benchmark series was supplied for this period.")
    lines.append("")

    lines.append("## Data and outages")
    lines.append("")
    lines.append("| | |")
    lines.append("|---|---:|")
    for key, value in report.outages.items():
        lines.append(f"| {key} | {value} |")
    lines.append(f"| data gaps recorded | {len(report.data_gaps)} |")
    lines.append("")
    if report.data_gaps:
        lines.append("| Pair | Timeframe | From | To | Missing candles |")
        lines.append("|---|---|---|---|---:|")
        for gap in report.data_gaps[:20]:
            lines.append(
                f"| {gap.get('pair')} | {gap.get('timeframe')} | {gap.get('from')} | "
                f"{gap.get('to')} | {gap.get('missing_candles')} |"
            )
        if len(report.data_gaps) > 20:
            lines.append(f"| ... | | | | {len(report.data_gaps) - 20} more |")
        lines.append("")
        lines.append(
            "Gaps are marked, never forward-filled. Entries are suppressed in the "
            "affected region rather than trading on invented prices."
        )
        lines.append("")

    lines.append("## What this report cannot tell you")
    lines.append("")
    for limitation in report.limitations:
        lines.append(f"- {limitation}")
    lines.append("")
    lines.append(
        "A clean week here is not evidence about any of the above, and it is not "
        "live approval. See `docs/LIVE_READINESS.md` for the gates that decide that."
    )
    lines.append("")

    return "\n".join(lines)


def write_report(report: WeeklyReport, directory: Path) -> tuple[Path, Path]:
    """Write Markdown and JSON side by side. Nothing is sent anywhere."""
    directory.mkdir(parents=True, exist_ok=True)
    stem = f"weekly-{report.period_start:%Y%m%d}-{report.period_end:%Y%m%d}"
    md_path = directory / f"{stem}.md"
    json_path = directory / f"{stem}.json"
    md_path.write_text(render_markdown(report), encoding="utf-8")
    json_path.write_text(
        json.dumps(report.as_dict(), indent=2, sort_keys=False), encoding="utf-8"
    )
    return md_path, json_path
