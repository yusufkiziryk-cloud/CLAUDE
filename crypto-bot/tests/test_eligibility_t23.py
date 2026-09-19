"""T23 - a deliberately bad strategy and insufficient data get the verdicts
they deserve, from code rather than from a person reading a table.

Also pins the thresholds to docs/RESEARCH_PLAN.md: moving one here without
moving it there (and saying why) fails.
"""

from __future__ import annotations

import glob
import re
from datetime import datetime
from pathlib import Path

import pytest

from kripto.money import dec
from kripto.research.eligibility import (
    EXPERIMENT_BUDGET,
    MAX_DRAWDOWN,
    MIN_CLOSED_TRADES,
    MIN_PROFIT_FACTOR,
    Evidence,
    Metrics,
    Outcome,
    Verdict,
    evaluate,
    load_backtest_stats,
    metrics_from_archive,
    render_markdown,
)

ROOT = Path(__file__).resolve().parent.parent
START = datetime(2025, 9, 1)
END = datetime(2026, 9, 1)


def metrics(trades=80, ret="0.12", pf="1.6", dd="0.06") -> Metrics:
    return Metrics(
        trades=trades, net_return=dec(ret),
        profit_factor=None if pf is None else dec(pf), max_drawdown=dec(dd),
        period_start=START, period_end=END,
    )


def good_evidence(**overrides) -> Evidence:
    base = dict(
        base=metrics(), double_cost=metrics(ret="0.05"), holdout_untouched=True,
        experiments_used=3,
    )
    base.update(overrides)
    return Evidence(**base)


# --------------------------------------------------------------------------
# The verdict a real archive gets - the same one the report reached by hand
# --------------------------------------------------------------------------


def _archives():
    """Archives that hold a BaselineTrend4h result; other strategies' runs
    (diagnostics) are not evidence about this one."""
    found = []
    for path in sorted(glob.glob(str(ROOT / "user_data" / "backtest_results" / "*.zip"))):
        try:
            load_backtest_stats(path, "BaselineTrend4h")
        except (KeyError, StopIteration, OSError):
            continue
        found.append(path)
    return found


@pytest.mark.skipif(not _archives(), reason="no backtest archive on this machine")
def test_t23_the_real_result_is_insufficient_evidence_not_a_pass():
    """12 trades, -5.33%, PF 0.13: the engine must say INSUFFICIENT_EVIDENCE
    and still list the failing criteria, exactly as reports/faz4 does."""
    one_year = [
        p for p in _archives()
        if load_backtest_stats(p, "BaselineTrend4h").get("timerange") == "20250901-20260901"
    ]
    if not one_year:
        pytest.skip("no 2025-09-01..2026-09-01 archive on this machine")
    base = metrics_from_archive(one_year[-1], "BaselineTrend4h")
    assert base.trades < 50, "this test assumes the reference run is below the review floor"

    result = evaluate(Evidence(base=base, experiments_used=1))

    assert result.verdict is Verdict.INSUFFICIENT_EVIDENCE
    assert 5 in {c.number for c in result.failing}
    assert any("below the 50 review floor" in r for r in result.reasons)
    # Whatever else fails on the evidence that exists is still named.
    for criterion in result.failing:
        if criterion.number != 5:
            assert any(f"criterion {criterion.number}" in r for r in result.reasons)


@pytest.mark.skipif(not _archives(), reason="no backtest archive on this machine")
def test_t23_freqtrade_field_names_still_exist():
    stats = load_backtest_stats(_archives()[-1], "BaselineTrend4h")
    for key in ("total_trades", "profit_total", "profit_factor", "max_drawdown_account", "losses"):
        assert key in stats, f"freqtrade renamed {key}; Metrics.from_backtest_stats is reading zeros"


# --------------------------------------------------------------------------
# Deliberately bad strategy
# --------------------------------------------------------------------------


def test_t23_a_losing_strategy_with_enough_trades_is_rejected():
    result = evaluate(good_evidence(base=metrics(trades=120, ret="-0.31", pf="0.6", dd="0.28")))
    assert result.verdict is Verdict.REJECTED
    assert {c.number for c in result.failing} == {1, 2, 3}


def test_t23_a_strategy_that_only_survives_at_1x_cost_is_rejected():
    """Positive at 1x, negative at 2x: the edge is the fee model."""
    result = evaluate(good_evidence(double_cost=metrics(ret="-0.02")))
    assert result.verdict is Verdict.REJECTED
    assert {c.number for c in result.failing} == {4}


def test_t23_one_failing_criterion_is_enough_to_reject():
    for field, value, number in (
        ("ret", "-0.001", 1), ("pf", "1.09", 2), ("dd", "0.1001", 3),
    ):
        result = evaluate(good_evidence(base=metrics(**{field: value})))
        assert result.verdict is Verdict.REJECTED, field
        assert [c.number for c in result.failing] == [number]


def test_t23_a_losing_strategy_with_few_trades_is_not_rejected_but_not_hidden():
    """12 trades cannot reject either. The failures are still listed."""
    result = evaluate(good_evidence(base=metrics(trades=12, ret="-0.05", pf="0.13")))
    assert result.verdict is Verdict.INSUFFICIENT_EVIDENCE
    assert {c.number for c in result.failing} == {1, 2, 5}
    assert sum("fails on the evidence that exists" in r for r in result.reasons) == 2


# --------------------------------------------------------------------------
# Insufficient data
# --------------------------------------------------------------------------


def test_t23_a_winning_strategy_with_few_trades_is_insufficient_evidence():
    """Good numbers over 30 trades are not a pass. Same rule, other direction."""
    result = evaluate(good_evidence(base=metrics(trades=30)))
    assert result.verdict is Verdict.INSUFFICIENT_EVIDENCE
    assert [c.number for c in result.failing] == [5]


def test_t23_no_trades_is_not_a_pass():
    result = evaluate(good_evidence(base=metrics(trades=0, ret="0", pf=None, dd="0")))
    assert result.verdict is Verdict.INSUFFICIENT_EVIDENCE
    assert any("no trades" in r for r in result.reasons)


def test_t23_a_missing_cost_stress_run_is_not_run_not_passed():
    result = evaluate(good_evidence(double_cost=None))
    assert result.verdict is Verdict.INSUFFICIENT_EVIDENCE
    assert [c.number for c in result.not_run] == [4]
    assert any("has not passed" in r for r in result.reasons)


def test_t23_an_undefined_profit_factor_is_not_infinite():
    """No losing trades over 80 trades is suspicious, not perfect."""
    result = evaluate(good_evidence(base=metrics(pf=None)))
    assert result.verdict is Verdict.INSUFFICIENT_EVIDENCE
    c2 = next(c for c in result.criteria if c.number == 2)
    assert c2.outcome is Outcome.NOT_RUN
    assert "undefined" in c2.measured


def test_t23_a_contaminated_holdout_caps_the_verdict():
    result = evaluate(good_evidence(holdout_untouched=False))
    assert result.verdict is Verdict.INSUFFICIENT_EVIDENCE
    assert not result.failing
    assert any("hold-out" in r for r in result.reasons)


def test_t23_the_default_is_a_contaminated_holdout():
    """The engine cannot know; the human must say so explicitly."""
    assert Evidence(base=metrics()).holdout_untouched is False


def test_t23_an_exhausted_experiment_budget_makes_the_result_inadmissible():
    result = evaluate(good_evidence(experiments_used=EXPERIMENT_BUDGET + 1))
    assert result.verdict is Verdict.INSUFFICIENT_EVIDENCE
    assert any("inadmissible" in r for r in result.reasons)
    # Exactly at the budget is still admissible.
    assert evaluate(good_evidence(experiments_used=EXPERIMENT_BUDGET)).verdict is (
        Verdict.CANDIDATE_FOR_OBSERVATION
    )


def test_t23_contamination_does_not_rescue_a_failing_strategy():
    """A contaminated hold-out and a losing result: REJECTED, not merely
    'insufficient' - the contamination cannot make the loss go away."""
    result = evaluate(good_evidence(holdout_untouched=False, base=metrics(ret="-0.1", pf="0.5")))
    assert result.verdict is Verdict.REJECTED


# --------------------------------------------------------------------------
# The pass, and what it does not mean
# --------------------------------------------------------------------------


def test_t23_only_a_full_pass_on_admissible_evidence_is_a_candidate():
    result = evaluate(good_evidence())
    assert result.verdict is Verdict.CANDIDATE_FOR_OBSERVATION
    assert all(c.passed for c in result.criteria)
    assert any("not live approval" in r for r in result.reasons)


def test_t23_the_boundaries_are_inclusive_where_the_plan_says_so():
    assert evaluate(good_evidence(base=metrics(pf="1.10"))).verdict is Verdict.CANDIDATE_FOR_OBSERVATION
    assert evaluate(good_evidence(base=metrics(dd="0.10"))).verdict is Verdict.CANDIDATE_FOR_OBSERVATION
    assert evaluate(good_evidence(base=metrics(trades=MIN_CLOSED_TRADES))).verdict is (
        Verdict.CANDIDATE_FOR_OBSERVATION
    )
    # "> 0" is strict: exactly zero is not a positive return.
    assert evaluate(good_evidence(base=metrics(ret="0"))).verdict is Verdict.REJECTED


def test_t23_the_markdown_names_every_criterion_and_the_verdict():
    evidence = good_evidence(base=metrics(trades=12, ret="-0.05", pf="0.13"))
    text = render_markdown(evaluate(evidence), evidence)
    assert "INSUFFICIENT_EVIDENCE" in text
    for number in range(1, 6):
        assert f"| {number} |" in text
    assert "**FAIL**" in text


# --------------------------------------------------------------------------
# Thresholds are pinned to the plan
# --------------------------------------------------------------------------


def test_t23_thresholds_match_the_research_plan():
    plan = (ROOT / "docs" / "RESEARCH_PLAN.md").read_text(encoding="utf-8")
    table = plan[plan.index("## Acceptance thresholds"):]
    rows = dict(re.findall(r"^\| (\d) \| .*? \| ([^|]+?) \|$", table, flags=re.M))
    assert rows["2"].strip() == f">= {MIN_PROFIT_FACTOR}"
    assert rows["3"].strip() == f"<= {int(MAX_DRAWDOWN * 100)}%"
    assert rows["5"].strip().startswith(f">= {MIN_CLOSED_TRADES}")
    assert f"At most **{EXPERIMENT_BUDGET} parameter combinations" in plan
