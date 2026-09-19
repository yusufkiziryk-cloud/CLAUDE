"""The research eligibility engine: fixed thresholds applied by code, not by hand.

docs/RESEARCH_PLAN.md fixes five acceptance criteria and two admissibility
rules (an experiment budget and an untouched hold-out). Until now they were
applied by reading numbers off a report. This module applies them
mechanically, so that:

* the same evidence always produces the same verdict,
* a threshold cannot be quietly relaxed to let a result through (the
  numbers live here, in one place, under test), and
* a deliberately bad strategy and an insufficient data set produce the
  verdicts they deserve - which is what T23 asks for.

Three verdicts, in the order they are checked:

``INSUFFICIENT_EVIDENCE``
    The evidence cannot support a conclusion either way: too few trades, a
    missing cost-stress run, a contaminated hold-out, or an exhausted
    experiment budget. Failing criteria are still listed, because "we
    cannot conclude" must never read as "it passed".
``REJECTED``
    Enough evidence exists and the strategy fails at least one criterion.
``CANDIDATE_FOR_OBSERVATION``
    Every criterion holds on admissible evidence. This is NOT live approval;
    it is eligibility for the 4-8 week dry-run observation, which is a
    separate gate (docs/LIVE_READINESS.md).

The engine never runs a backtest and never touches an exchange. It reads
numbers it is given.
"""

from __future__ import annotations

import io
import json
import zipfile
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum
from pathlib import Path

from ..money import ZERO, dec

# --------------------------------------------------------------------------
# Thresholds. These are the numbers from docs/RESEARCH_PLAN.md, and the
# test suite pins them: changing one here without changing the plan (and
# saying why) fails a test.
# --------------------------------------------------------------------------

MIN_NET_RETURN = ZERO
MIN_PROFIT_FACTOR = dec("1.10")
MAX_DRAWDOWN = dec("0.10")
MIN_NET_RETURN_AT_2X_COST = ZERO
MIN_CLOSED_TRADES = 50
EXPERIMENT_BUDGET = 30


class Verdict(str, Enum):
    CANDIDATE_FOR_OBSERVATION = "CANDIDATE_FOR_OBSERVATION"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    REJECTED = "REJECTED"


class Outcome(str, Enum):
    PASS = "pass"
    FAIL = "FAIL"
    NOT_RUN = "NOT_RUN"


@dataclass(frozen=True)
class Metrics:
    """The handful of numbers the criteria need, from one backtest."""

    trades: int
    net_return: Decimal
    """Net return as a fraction of starting capital, after fees."""
    profit_factor: Decimal | None
    """Gross profit / gross loss. ``None`` when there were no losing trades,
    which is *undefined*, not infinite, and never counts as a pass."""
    max_drawdown: Decimal
    """Peak-to-trough drawdown on account equity, as a fraction."""
    period_start: datetime | None = None
    period_end: datetime | None = None
    source: str = ""

    @classmethod
    def from_backtest_stats(cls, stats: dict, *, source: str = "") -> Metrics:
        """Map freqtrade's per-strategy result dict to the fields we use.

        Field names come from freqtrade 2026.8's ``generate_strategy_stats``;
        tests/test_eligibility_t23.py reads a real archive so a renamed field
        is caught rather than silently read as zero.
        """
        losses = int(stats.get("losses", 0))
        raw_factor = stats.get("profit_factor")
        factor = dec(str(raw_factor)) if losses > 0 and raw_factor is not None else None
        return cls(
            trades=int(stats["total_trades"]),
            net_return=dec(str(stats["profit_total"])),
            profit_factor=factor,
            max_drawdown=dec(str(stats.get("max_drawdown_account", 0))),
            period_start=_parse_dt(stats.get("backtest_start")),
            period_end=_parse_dt(stats.get("backtest_end")),
            source=source,
        )


@dataclass(frozen=True)
class Evidence:
    """Everything the verdict depends on. Nothing here is inferred."""

    base: Metrics
    """The 1x-cost result."""
    double_cost: Metrics | None = None
    """The 2x-cost result of the SAME configuration and period. ``None``
    means the stress run was not done, which is NOT_RUN, not a pass."""
    holdout_untouched: bool = False
    """Asserted by the human. The engine cannot know whether a result was
    looked at before the hold-out was frozen, so the default is the honest
    one: contaminated until someone says otherwise."""
    experiments_used: int = 0
    experiments_budget: int = EXPERIMENT_BUDGET
    strategy: str = ""


@dataclass(frozen=True)
class Criterion:
    number: int
    name: str
    threshold: str
    measured: str
    outcome: Outcome

    @property
    def passed(self) -> bool:
        return self.outcome is Outcome.PASS


@dataclass
class Result:
    verdict: Verdict
    criteria: list[Criterion] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)

    @property
    def failing(self) -> list[Criterion]:
        return [c for c in self.criteria if c.outcome is Outcome.FAIL]

    @property
    def not_run(self) -> list[Criterion]:
        return [c for c in self.criteria if c.outcome is Outcome.NOT_RUN]

    def as_dict(self) -> dict:
        return {
            "verdict": self.verdict.value,
            "criteria": [
                {
                    "number": c.number, "name": c.name, "threshold": c.threshold,
                    "measured": c.measured, "outcome": c.outcome.value,
                }
                for c in self.criteria
            ],
            "reasons": list(self.reasons),
        }


# --------------------------------------------------------------------------
# The criteria
# --------------------------------------------------------------------------


def _pct(value: Decimal) -> str:
    return f"{value * 100:.2f}%"


def criteria_for(evidence: Evidence) -> list[Criterion]:
    base = evidence.base

    c1 = Criterion(
        1, "OOS net return", f"> {_pct(MIN_NET_RETURN)}", _pct(base.net_return),
        Outcome.PASS if base.net_return > MIN_NET_RETURN else Outcome.FAIL,
    )

    if base.profit_factor is None:
        c2 = Criterion(
            2, "Net profit factor", f">= {MIN_PROFIT_FACTOR}",
            "undefined (no losing trades)", Outcome.NOT_RUN,
        )
    else:
        c2 = Criterion(
            2, "Net profit factor", f">= {MIN_PROFIT_FACTOR}", f"{base.profit_factor:.2f}",
            Outcome.PASS if base.profit_factor >= MIN_PROFIT_FACTOR else Outcome.FAIL,
        )

    c3 = Criterion(
        3, "Max drawdown", f"<= {_pct(MAX_DRAWDOWN)}", _pct(base.max_drawdown),
        Outcome.PASS if base.max_drawdown <= MAX_DRAWDOWN else Outcome.FAIL,
    )

    if evidence.double_cost is None:
        c4 = Criterion(
            4, "Net result at 2x modelled cost", f"> {_pct(MIN_NET_RETURN_AT_2X_COST)}",
            "no 2x-cost run supplied", Outcome.NOT_RUN,
        )
    else:
        two = evidence.double_cost.net_return
        c4 = Criterion(
            4, "Net result at 2x modelled cost", f"> {_pct(MIN_NET_RETURN_AT_2X_COST)}",
            _pct(two), Outcome.PASS if two > MIN_NET_RETURN_AT_2X_COST else Outcome.FAIL,
        )

    c5 = Criterion(
        5, "Closed OOS trades (review floor)", f">= {MIN_CLOSED_TRADES}", str(base.trades),
        Outcome.PASS if base.trades >= MIN_CLOSED_TRADES else Outcome.FAIL,
    )
    return [c1, c2, c3, c4, c5]


# --------------------------------------------------------------------------
# The verdict
# --------------------------------------------------------------------------


def evaluate(evidence: Evidence) -> Result:
    """Apply the plan. Admissibility first, then sufficiency, then merit.

    The ordering is the point. A losing strategy with 12 trades is
    INSUFFICIENT_EVIDENCE, not REJECTED, because 12 trades cannot reject
    anything either - and a winning strategy with 12 trades is
    INSUFFICIENT_EVIDENCE for exactly the same reason. Failures are always
    listed so the reader sees what the evidence, such as it is, says.
    """
    criteria = criteria_for(evidence)
    result = Result(Verdict.INSUFFICIENT_EVIDENCE, criteria)
    base = evidence.base
    failing = [c for c in criteria if c.outcome is Outcome.FAIL and c.number != 5]

    def note_failures() -> None:
        for c in failing:
            result.reasons.append(
                f"criterion {c.number} ({c.name}) fails on the evidence that exists: "
                f"{c.measured} vs {c.threshold}"
            )

    # -- admissibility ----------------------------------------------------
    if evidence.experiments_used > evidence.experiments_budget:
        result.reasons.append(
            f"experiment budget exceeded: {evidence.experiments_used} of "
            f"{evidence.experiments_budget} combinations used. A result found after "
            "the budget is a search result, not evidence; it is inadmissible."
        )
        note_failures()
        return result

    if base.trades == 0:
        result.reasons.append(
            "the backtest produced no trades. An analysis that produces no trades "
            "has not been tested; it has not passed."
        )
        return result

    # -- sufficiency ------------------------------------------------------
    if base.trades < MIN_CLOSED_TRADES:
        result.reasons.append(
            f"{base.trades} closed trades is below the {MIN_CLOSED_TRADES} review floor; "
            "no conclusion in either direction is available"
        )
        note_failures()
        return result

    # -- merit (enough trades to reject on) --------------------------------
    if failing:
        result.verdict = Verdict.REJECTED
        note_failures()
        return result

    not_run = [c for c in criteria if c.outcome is Outcome.NOT_RUN]
    if not_run:
        for c in not_run:
            result.reasons.append(
                f"criterion {c.number} ({c.name}) was not evaluated: {c.measured}. "
                "A criterion that was not run has not passed."
            )
        return result

    if not evidence.holdout_untouched:
        result.reasons.append(
            "every threshold holds, but the hold-out is not attested as untouched. "
            "A result that was seen before the hold-out was frozen cannot be "
            "promoted; the strongest available verdict is INSUFFICIENT_EVIDENCE."
        )
        return result

    result.verdict = Verdict.CANDIDATE_FOR_OBSERVATION
    result.reasons.append("all five criteria hold on admissible evidence")
    result.reasons.append(
        "this is eligibility for the 4-8 week dry-run observation only. It is not "
        "live approval; the engineering, exchange-capability and operations gates in "
        "docs/LIVE_READINESS.md are assessed separately."
    )
    return result


# --------------------------------------------------------------------------
# Reading freqtrade's archives
# --------------------------------------------------------------------------


def load_backtest_stats(path: str | Path, strategy: str) -> dict:
    """Return the per-strategy stats dict from a freqtrade backtest zip."""
    path = Path(path)
    with zipfile.ZipFile(path) as archive:
        main = next(
            n for n in archive.namelist()
            if n.endswith(".json") and "_config" not in n and "market_change" not in n
        )
        payload = json.loads(archive.read(main))
    strategies = payload.get("strategy", {})
    if strategy not in strategies:
        raise KeyError(
            f"{path.name} holds results for {sorted(strategies)}, not {strategy!r}"
        )
    return strategies[strategy]


def wallet_max_drawdown(path: str | Path) -> Decimal | None:
    """Mark-to-market drawdown from the wallet series freqtrade saves.

    ``max_drawdown_account`` counts closed trades only. The policy's limit is
    on equity including open positions, and the two can differ by a lot
    (8.60% closed-trade vs 10.97% mark-to-market on the reference run). The
    wallet frame has one row per currency per timestamp; sum first.
    """
    import pandas as pd

    with zipfile.ZipFile(Path(path)) as archive:
        wallet_name = next((n for n in archive.namelist() if "wallet" in n), None)
        if wallet_name is None:
            return None
        wallet = pd.read_feather(io.BytesIO(archive.read(wallet_name)))
    if wallet.empty or "total_quote" not in wallet:
        return None
    frame = wallet[["date", "currency", "total_quote"]].copy()
    frame["date"] = pd.to_datetime(frame["date"], utc=True)
    totals = frame.groupby("date")["total_quote"].sum().sort_index()
    if totals.empty:
        return None
    peak = totals.cummax()
    drawdown = ((peak - totals) / peak).max()
    return dec(str(float(drawdown)))


def metrics_from_archive(path: str | Path, strategy: str) -> Metrics:
    """Metrics for the criteria, with drawdown taken mark-to-market.

    The larger of freqtrade's closed-trade drawdown and the wallet-series
    drawdown is used, because the policy limit applies to equity including
    open positions and a threshold judged on the smaller number would pass
    runs the running bot would have locked.
    """
    metrics = Metrics.from_backtest_stats(
        load_backtest_stats(path, strategy), source=str(Path(path).name)
    )
    mtm = wallet_max_drawdown(path)
    if mtm is not None and mtm > metrics.max_drawdown:
        from dataclasses import replace

        metrics = replace(metrics, max_drawdown=mtm)
    return metrics


def render_markdown(result: Result, evidence: Evidence) -> str:
    out = io.StringIO()
    out.write(f"## Eligibility verdict: `{result.verdict.value}`\n\n")
    if evidence.strategy:
        out.write(f"Strategy: `{evidence.strategy}`  \n")
    if evidence.base.period_start and evidence.base.period_end:
        out.write(
            f"Period: {evidence.base.period_start:%Y-%m-%d} → "
            f"{evidence.base.period_end:%Y-%m-%d}  \n"
        )
    out.write(f"Hold-out attested untouched: **{'yes' if evidence.holdout_untouched else 'no'}**  \n")
    out.write(
        f"Experiments used: {evidence.experiments_used} / {evidence.experiments_budget}\n\n"
    )
    out.write("| # | Criterion | Threshold | Measured | Outcome |\n|---|---|---|---|---|\n")
    for c in result.criteria:
        label = f"**{c.outcome.value}**" if c.outcome is not Outcome.PASS else c.outcome.value
        out.write(f"| {c.number} | {c.name} | {c.threshold} | {c.measured} | {label} |\n")
    out.write("\n")
    for reason in result.reasons:
        out.write(f"- {reason}\n")
    return out.getvalue()


def _parse_dt(value) -> datetime | None:
    if value in (None, ""):
        return None
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None
