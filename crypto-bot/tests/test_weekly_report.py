"""The weekly report must never make a quiet week look like a good one, or
an unfinished observation look finished."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from kripto.money import dec
from kripto.policy import load_policy
from kripto.report.weekly import (
    MIN_CLOSED_TRADES,
    REQUIRED_OBSERVATION_DAYS,
    Assessment,
    TradeStats,
    WeeklyReport,
    assess,
    build_report,
    collect_decisions,
    render_markdown,
    write_report,
)
from kripto.risk.state import BotState, LockKind, RiskStore

NOW = datetime(2026, 9, 17, 12, 0, tzinfo=timezone.utc)


@pytest.fixture
def policy():
    return load_policy("config/policy.yaml")


@pytest.fixture
def store(tmp_path):
    s = RiskStore(tmp_path / "risk.sqlite")
    s.set_state(BotState.READY, "test", NOW)
    yield s
    s.close()


def make_report(**overrides) -> WeeklyReport:
    base = dict(
        period_start=NOW - timedelta(days=7),
        period_end=NOW,
        mode="dry-run",
        generated_at=NOW,
        observed_days=float(REQUIRED_OBSERVATION_DAYS),
    )
    base.update(overrides)
    return WeeklyReport(**base)


def with_trades(closed, pnl, gross_profit, gross_loss, drawdown=None, **kw):
    stats = TradeStats(
        closed=closed,
        realised_pnl=dec(pnl),
        gross_profit=dec(gross_profit),
        gross_loss=dec(gross_loss),
        wins=closed // 2,
        losses=closed - closed // 2,
    )
    report = make_report(trades=stats, **kw)
    report.max_drawdown = dec(drawdown) if drawdown is not None else None
    return report


# --------------------------------------------------------------------------
# Assessment
# --------------------------------------------------------------------------


def test_an_unfinished_observation_is_never_reported_as_finished():
    report = with_trades(100, "500", "800", "-300", observed_days=10.0)

    verdict, reasons = assess(report)

    assert verdict is Assessment.OBSERVATION_IN_PROGRESS
    assert "10.0 of 28" in reasons[0]


def test_elapsed_time_alone_does_not_produce_a_verdict():
    """28 days with four trades is not evidence; it is four trades."""
    report = with_trades(4, "50", "80", "-30")

    verdict, reasons = assess(report)

    assert verdict is Assessment.INSUFFICIENT_EVIDENCE
    assert str(MIN_CLOSED_TRADES) in reasons[0]


def test_a_losing_period_is_rejected():
    report = with_trades(60, "-120", "200", "-320")

    verdict, reasons = assess(report)

    assert verdict is Assessment.REJECTED
    assert "not positive" in reasons[0]


def test_a_weak_profit_factor_is_rejected():
    # PF = 210/200 = 1.05, below the 1.10 threshold, despite positive PnL.
    report = with_trades(60, "10", "210", "-200")

    verdict, reasons = assess(report)

    assert verdict is Assessment.REJECTED
    assert "profit factor" in reasons[0]


def test_an_excessive_drawdown_is_rejected():
    report = with_trades(60, "100", "400", "-300", drawdown="0.15")

    verdict, reasons = assess(report)

    assert verdict is Assessment.REJECTED
    assert "drawdown" in reasons[0]


def test_all_thresholds_met_gives_continue_and_still_refuses_live_approval():
    report = with_trades(60, "300", "700", "-300", drawdown="0.04")

    verdict, reasons = assess(report)

    assert verdict is Assessment.CONTINUE
    joined = " ".join(reasons)
    assert "not live approval" in joined
    assert "LIVE_READINESS" in joined


def test_thresholds_match_the_research_plan():
    """The report must apply the plan's bar, not its own."""
    plan = Path("docs/RESEARCH_PLAN.md").read_text(encoding="utf-8")

    assert str(MIN_CLOSED_TRADES) in plan
    assert "1.10" in plan


# --------------------------------------------------------------------------
# Honest handling of edge cases
# --------------------------------------------------------------------------


def test_profit_factor_with_no_losses_is_undefined_not_infinite():
    """An undefined ratio must never be rendered as a perfect score."""
    stats = TradeStats(closed=3, gross_profit=dec("100"), gross_loss=dec("0"))

    assert stats.profit_factor is None

    report = make_report(trades=stats)
    assert "undefined (no losing trades)" in render_markdown(report)


def test_a_zero_trade_week_is_reported_as_a_result_not_an_error():
    report = make_report(trades=TradeStats(), decisions_refused=40,
                         refusal_reasons={"RISK_LOCKED": 40})

    markdown = render_markdown(report)

    assert "No trades were opened or closed" in markdown
    assert "That is a result, not a" in markdown
    assert "RISK_LOCKED" in markdown


def test_win_rate_and_expectancy_are_absent_rather_than_zero_when_undefined():
    stats = TradeStats()

    assert stats.win_rate is None
    assert stats.expectancy is None


def test_the_markdown_names_the_mode_loudly():
    markdown = render_markdown(make_report(mode="dry-run"))

    assert "**Mode: DRY-RUN**" in markdown
    assert "no real orders were placed" in markdown


def test_the_report_states_what_it_cannot_tell_you():
    report = make_report()
    report.limitations = ["backtest: NOT_MODELED -> slippage"]

    markdown = render_markdown(report)

    assert "What this report cannot tell you" in markdown
    assert "not live approval" in markdown
    assert "NOT_MODELED" in markdown


def test_open_pnl_is_not_guessed():
    markdown = render_markdown(make_report(trades=TradeStats(open=2)))

    assert "not valued" in markdown


# --------------------------------------------------------------------------
# Collection from real state
# --------------------------------------------------------------------------


def test_decisions_are_collected_with_their_reasons(store):
    for n in range(3):
        store.record_entry_decision(
            now=NOW, pair="BTC/USDC", intent_id=f"a{n}", allowed=False,
            code="ASSET_CAP_REACHED", reason="per-asset notional cap",
        )
    store.record_entry_decision(
        now=NOW, pair="ETH/USDC", intent_id="ok", allowed=True, code="ACCEPTED",
    )

    accepted, refused, reasons = collect_decisions(
        store, NOW - timedelta(hours=1), NOW + timedelta(hours=1)
    )

    assert accepted == 1
    assert refused == 3
    assert reasons == {"ASSET_CAP_REACHED": 3}


def test_decisions_outside_the_period_are_excluded(store):
    store.record_entry_decision(
        now=NOW - timedelta(days=30), pair="BTC/USDC", intent_id="old",
        allowed=False, code="OLD",
    )
    store.record_entry_decision(
        now=NOW, pair="BTC/USDC", intent_id="new", allowed=False, code="NEW",
    )

    _, refused, reasons = collect_decisions(
        store, NOW - timedelta(days=7), NOW + timedelta(hours=1)
    )

    assert refused == 1
    assert reasons == {"NEW": 1}


def test_locks_raised_in_the_period_are_reported(store):
    store.add_lock(LockKind.DAILY_LOSS, "daily limit breached", NOW)

    locks = store.locks_between(NOW - timedelta(hours=1), NOW + timedelta(hours=1))

    assert len(locks) == 1
    assert locks[0]["kind"] == "DAILY_LOSS"


def test_a_missing_trade_database_yields_zero_trades_not_a_crash(store, policy, tmp_path):
    report = build_report(
        store=store,
        db_url=f"sqlite:///{tmp_path / 'does-not-exist.sqlite'}",
        policy=policy,
        start=NOW - timedelta(days=7),
        end=NOW,
        mode="dry-run",
        manifest_path=tmp_path / "no-manifest.json",
    )

    assert report.trades.closed == 0
    assert report.assessment is Assessment.OBSERVATION_IN_PROGRESS


def test_report_writes_markdown_and_json_side_by_side(tmp_path):
    report = make_report(trades=TradeStats(closed=2, realised_pnl=dec("5")))

    md_path, json_path = write_report(report, tmp_path)

    assert md_path.is_file() and json_path.is_file()
    payload = json.loads(json_path.read_text(encoding="utf-8"))
    assert payload["trades"]["closed"] == 2
    assert payload["assessment"]["required_days"] == REQUIRED_OBSERVATION_DAYS
    assert payload["mode"] == "dry-run"
