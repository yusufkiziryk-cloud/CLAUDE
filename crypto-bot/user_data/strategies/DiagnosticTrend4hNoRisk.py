"""DIAGNOSTIC ONLY - never trade this.

Identical signals to BaselineTrend4h, with the risk gate removed and a fixed
stake. Its only purpose is to answer one question: when freqtrade's
lookahead-analysis reports a bias, is that bias in the SIGNALS, or is it an
artefact of the stateful risk layer?

lookahead-analysis re-runs a strategy over several time ranges and compares
the resulting trades. It assumes the strategy is a pure function of the
dataframe. BaselineTrend4h is not: its risk store carries reservations,
locks and a peak-equity watermark across those runs, so two runs over
different ranges can legitimately differ without any look-ahead at all.

Running the tool against this stateless twin separates the two causes.
"""

from __future__ import annotations

import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT / "src") not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT / "src"))

sys.path.insert(0, str(Path(__file__).resolve().parent))

from BaselineTrend4h import BaselineTrend4h  # noqa: E402


class DiagnosticTrend4hNoRisk(BaselineTrend4h):
    """Same signals, no risk gate, no persistent state."""

    def bot_start(self, **kwargs) -> None:  # no risk store at all
        return None

    def custom_stake_amount(self, pair, current_time, current_rate, proposed_stake, **kwargs):
        return proposed_stake

    def confirm_trade_entry(self, *args, **kwargs) -> bool:
        return True

    def order_filled(self, *args, **kwargs) -> None:
        return None

    def custom_stoploss(self, pair, trade, current_time, current_rate, current_profit,
                        after_fill, **kwargs):
        # Fall back to the static stoploss; the ATR stop needs trade metadata
        # that only the real strategy writes.
        return None
