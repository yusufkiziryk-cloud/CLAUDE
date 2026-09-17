"""Net fill accounting: fees, and the dust they leave behind.

A fill is not "amount at price". What lands in the account depends on which
currency the fee was taken in:

* fee in **quote**  -> we receive the full base amount, and pay a little more quote
* fee in **base**   -> we receive LESS base than we bought
* fee in a **third** token -> base and quote are untouched, a third balance moves

Getting the base case wrong is the expensive one: sizing a stop against an
amount we do not actually hold means the stop order is rejected, or worse,
partially unprotected. And after the exit, fees routinely leave a remainder
too small to sell - dust. Dust is recorded, never hidden, and never topped
up by buying more to clear an exchange minimum.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from ..money import ZERO, dec, is_finite_positive, mul


class FillError(ValueError):
    pass


@dataclass(frozen=True)
class Fill:
    amount_base: Decimal
    price: Decimal
    fee_amount: Decimal
    fee_currency: str


@dataclass(frozen=True)
class NetFill:
    """What the account actually gained and lost."""

    gross_base: Decimal
    net_base: Decimal
    quote_spent: Decimal
    fee_in_base: Decimal
    fee_in_quote: Decimal
    fee_other: dict[str, Decimal] = field(default_factory=dict)

    @property
    def effective_price(self) -> Decimal:
        """Quote actually spent per unit of base actually received."""
        if self.net_base <= ZERO:
            raise FillError("no net base received; effective price is undefined")
        return self.quote_spent / self.net_base


def apply_buy_fill(fill: Fill, *, base_asset: str, quote_asset: str) -> NetFill:
    """Net out one buy fill.

    ``net_base`` is the amount we can actually sell later, which is the amount
    every downstream calculation - stop coverage, exposure, exit sizing - must
    use.
    """
    if not is_finite_positive(fill.amount_base):
        raise FillError(f"fill amount must be positive, got {fill.amount_base}")
    if not is_finite_positive(fill.price):
        raise FillError(f"fill price must be positive, got {fill.price}")
    if fill.fee_amount < ZERO or not fill.fee_amount.is_finite():
        raise FillError(f"fee must be finite and non-negative, got {fill.fee_amount}")

    gross_quote = mul(fill.amount_base, fill.price)
    net_base = fill.amount_base
    quote_spent = gross_quote
    fee_base = ZERO
    fee_quote = ZERO
    fee_other: dict[str, Decimal] = {}

    currency = fill.fee_currency.upper()
    if currency == base_asset.upper():
        fee_base = fill.fee_amount
        net_base = fill.amount_base - fill.fee_amount
        if net_base <= ZERO:
            raise FillError(
                f"fee {fill.fee_amount} {currency} consumes the whole fill "
                f"of {fill.amount_base}"
            )
    elif currency == quote_asset.upper():
        fee_quote = fill.fee_amount
        quote_spent = gross_quote + fill.fee_amount
    elif fill.fee_amount > ZERO:
        fee_other[currency] = fill.fee_amount

    return NetFill(
        gross_base=fill.amount_base,
        net_base=net_base,
        quote_spent=quote_spent,
        fee_in_base=fee_base,
        fee_in_quote=fee_quote,
        fee_other=fee_other,
    )


def combine(fills: list[NetFill]) -> NetFill:
    """Aggregate several partial fills into one position-level view."""
    if not fills:
        raise FillError("no fills to combine")
    other: dict[str, Decimal] = {}
    for fill in fills:
        for currency, amount in fill.fee_other.items():
            other[currency] = other.get(currency, ZERO) + amount
    return NetFill(
        gross_base=sum((f.gross_base for f in fills), ZERO),
        net_base=sum((f.net_base for f in fills), ZERO),
        quote_spent=sum((f.quote_spent for f in fills), ZERO),
        fee_in_base=sum((f.fee_in_base for f in fills), ZERO),
        fee_in_quote=sum((f.fee_in_quote for f in fills), ZERO),
        fee_other=other,
    )


@dataclass(frozen=True)
class DustReport:
    """A remainder too small to trade."""

    asset: str
    amount: Decimal
    value_quote: Decimal
    reason: str

    @property
    def is_dust(self) -> bool:
        return self.amount > ZERO


def classify_remainder(
    *,
    asset: str,
    remaining_base: Decimal,
    price: Decimal,
    amount_step: Decimal,
    min_order_amount: Decimal,
    min_order_cost: Decimal,
) -> DustReport | None:
    """Decide whether a leftover balance is sellable or is dust.

    Returns None when the remainder can still be sold normally. Dust is
    reported so it shows up in the weekly report; it is never cleared by
    BUYING more to reach the exchange minimum, because that would open new
    risk to tidy up an accounting remainder.
    """
    if remaining_base <= ZERO:
        return None

    value = mul(remaining_base, price)
    sellable_amount = (remaining_base // amount_step) * amount_step if amount_step > ZERO else remaining_base

    if sellable_amount <= ZERO:
        return DustReport(asset, remaining_base, value, "below the exchange amount step")
    if min_order_amount > ZERO and sellable_amount < min_order_amount:
        return DustReport(asset, remaining_base, value, "below the exchange minimum amount")
    if min_order_cost > ZERO and mul(sellable_amount, price) < min_order_cost:
        return DustReport(asset, remaining_base, value, "below the exchange minimum cost")
    return None
