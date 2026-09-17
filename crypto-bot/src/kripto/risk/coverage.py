"""What each run path actually exercises.

A backtest, a dry run and a future live run do not test the same things, and
the honest way to handle that is to write the differences down rather than
let a green backtest imply coverage it never had.

Anything listed as NOT_MODELED here must appear as NOT_MODELED in reports.
"""

from __future__ import annotations

from enum import Enum


class RunPath(str, Enum):
    BACKTEST = "backtest"
    REPLAY = "replay"
    DRY_RUN = "dry_run"


class Coverage(str, Enum):
    MODELLED = "MODELLED"
    NOT_MODELLED = "NOT_MODELED"
    PARTIAL = "PARTIAL"


# feature -> {path: coverage}
COVERAGE: dict[str, dict[RunPath, Coverage]] = {
    "position_sizing": {
        RunPath.BACKTEST: Coverage.MODELLED,
        RunPath.REPLAY: Coverage.MODELLED,
        RunPath.DRY_RUN: Coverage.MODELLED,
    },
    "period_loss_locks": {
        RunPath.BACKTEST: Coverage.MODELLED,
        RunPath.REPLAY: Coverage.MODELLED,
        RunPath.DRY_RUN: Coverage.MODELLED,
    },
    "drawdown_lock": {
        RunPath.BACKTEST: Coverage.MODELLED,
        RunPath.REPLAY: Coverage.MODELLED,
        RunPath.DRY_RUN: Coverage.MODELLED,
    },
    "atomic_reservations": {
        RunPath.BACKTEST: Coverage.PARTIAL,
        RunPath.REPLAY: Coverage.MODELLED,
        RunPath.DRY_RUN: Coverage.MODELLED,
    },
    "order_lifecycle_states": {
        # A backtest fills at the requested price inside the candle; it never
        # produces a SUBMITTED-then-timeout, so the UNKNOWN path cannot arise.
        RunPath.BACKTEST: Coverage.NOT_MODELLED,
        RunPath.REPLAY: Coverage.MODELLED,
        RunPath.DRY_RUN: Coverage.PARTIAL,
    },
    "reconciliation_on_restart": {
        RunPath.BACKTEST: Coverage.NOT_MODELLED,
        RunPath.REPLAY: Coverage.MODELLED,
        RunPath.DRY_RUN: Coverage.PARTIAL,
    },
    "cancel_fill_race": {
        RunPath.BACKTEST: Coverage.NOT_MODELLED,
        RunPath.REPLAY: Coverage.MODELLED,
        RunPath.DRY_RUN: Coverage.NOT_MODELLED,
    },
    "slippage": {
        RunPath.BACKTEST: Coverage.NOT_MODELLED,
        RunPath.REPLAY: Coverage.PARTIAL,
        RunPath.DRY_RUN: Coverage.PARTIAL,
    },
    "intra_candle_fill_order": {
        RunPath.BACKTEST: Coverage.NOT_MODELLED,
        RunPath.REPLAY: Coverage.PARTIAL,
        RunPath.DRY_RUN: Coverage.NOT_MODELLED,
    },
    "exchange_side_stop": {
        # Does not exist on this venue at all, on any path.
        RunPath.BACKTEST: Coverage.NOT_MODELLED,
        RunPath.REPLAY: Coverage.NOT_MODELLED,
        RunPath.DRY_RUN: Coverage.NOT_MODELLED,
    },
    "single_writer_enforcement": {
        RunPath.BACKTEST: Coverage.NOT_MODELLED,
        RunPath.REPLAY: Coverage.MODELLED,
        RunPath.DRY_RUN: Coverage.MODELLED,
    },
}

# Features every path must agree on. These are the pure-policy decisions; if
# two paths ever disagree here, one of them is wrong.
PATH_INDEPENDENT = frozenset(
    {"position_sizing", "period_loss_locks", "drawdown_lock"}
)


def not_modelled(path: RunPath) -> list[str]:
    """Features a given path cannot speak to. Belongs in every report."""
    return sorted(
        feature
        for feature, paths in COVERAGE.items()
        if paths.get(path) is Coverage.NOT_MODELLED
    )


def report_lines(path: RunPath) -> list[str]:
    missing = not_modelled(path)
    if not missing:
        return []
    return [
        f"NOT_MODELED on the {path.value} path: {', '.join(missing)}",
        "A clean result on this path is not evidence about any of them.",
    ]
