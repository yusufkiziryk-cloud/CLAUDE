"""Equity accounting for the bot-owned portfolio.

The single rule that prevents most accounting bugs here: value each thing
exactly once. Quote currency locked inside a resting buy order is still
quote currency - it must not be counted again as the position it has not
become yet, and an open position's value must not be counted as cost plus
unrealised PnL on top.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from ..money import ZERO, dec, is_finite_positive, mul


class EquityError(ValueError):
    pass


@dataclass(frozen=True)
class AssetHolding:
    """A spot asset the bot owns, plus the price used to value it."""

    asset: str
    amount: Decimal
    price_quote: Decimal
    price_age_seconds: float = 0.0


@dataclass(frozen=True)
class EquitySnapshot:
    total: Decimal
    free_quote: Decimal
    locked_quote: Decimal
    holdings_value: Decimal
    stale_prices: list[str] = field(default_factory=list)
    detail: dict[str, Decimal] = field(default_factory=dict)

    @property
    def is_usable(self) -> bool:
        """Equity computed from a stale price is not equity we may size on."""
        return not self.stale_prices and self.total > ZERO


def compute_equity(
    *,
    free_quote: Decimal,
    locked_quote: Decimal,
    holdings: list[AssetHolding],
    max_price_age_seconds: float,
) -> EquitySnapshot:
    """Total bot equity in quote currency.

    ``locked_quote`` is quote currency committed to resting orders. It is part
    of equity (we still own it) but it is NOT spendable, which is why the
    sizing function receives ``free_quote`` separately.
    """
    for name, value in (("free_quote", free_quote), ("locked_quote", locked_quote)):
        if not value.is_finite() or value < ZERO:
            raise EquityError(f"{name} must be a finite non-negative amount, got {value}")

    stale: list[str] = []
    detail: dict[str, Decimal] = {}
    holdings_value = ZERO

    for holding in holdings:
        if holding.amount < ZERO or not holding.amount.is_finite():
            raise EquityError(f"{holding.asset}: invalid amount {holding.amount}")
        if holding.amount == ZERO:
            continue
        if not is_finite_positive(holding.price_quote):
            raise EquityError(f"{holding.asset}: invalid price {holding.price_quote}")
        if holding.price_age_seconds > max_price_age_seconds:
            stale.append(holding.asset)
        value = mul(holding.amount, holding.price_quote)
        detail[holding.asset] = value
        holdings_value += value

    total = free_quote + locked_quote + holdings_value
    detail["free_quote"] = free_quote
    detail["locked_quote"] = locked_quote

    return EquitySnapshot(
        total=total,
        free_quote=free_quote,
        locked_quote=locked_quote,
        holdings_value=holdings_value,
        stale_prices=stale,
        detail=detail,
    )


def period_loss_fraction(
    *, starting_equity: Decimal, net_external_flow: Decimal, current_equity: Decimal
) -> Decimal:
    """Cash-flow adjusted loss budget used for the day/week entry locks.

        max(0, (E0 + F - Et) / E0)

    This is a LOSS BUDGET, not a time-weighted rate of return. It answers
    "how much of this period's allowance has been spent", counting open and
    closed results alike, and it is explicitly not a performance metric.
    """
    if not is_finite_positive(starting_equity):
        raise EquityError(f"starting_equity must be positive, got {starting_equity}")
    if not current_equity.is_finite() or current_equity < ZERO:
        raise EquityError(f"current_equity must be finite and non-negative, got {current_equity}")

    loss = (starting_equity + net_external_flow - current_equity) / starting_equity
    return loss if loss > ZERO else ZERO


def drawdown_from_peak(*, peak_equity: Decimal, current_equity: Decimal) -> Decimal:
    if not is_finite_positive(peak_equity):
        raise EquityError(f"peak_equity must be positive, got {peak_equity}")
    drop = (peak_equity - current_equity) / peak_equity
    return drop if drop > ZERO else ZERO
