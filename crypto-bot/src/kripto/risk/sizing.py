"""Position sizing for long-only spot entries.

Implements the sizing formula fixed in docs/RISK_POLICY.md section 7:

    R      = E * risk_per_trade
    P_out  = P_stop * (1 - exit_slippage)
    L      = (P_in - P_out) + P_in * entry_fee + P_out * exit_fee
    q_risk = R / L
    q      = floor_to_step(min(q_risk, <all other caps>))

``L`` is the modelled loss *per base unit* if the stop is hit: the price
drop, plus the fee paid on the way in, plus the fee paid on the way out.
Every cap is converted into base-asset units before the min() so we never
compare a quote amount against a base amount.

This module is pure: no I/O, no clock, no framework. Everything it needs is
passed in, so the same code runs in backtest, dry-run and (future) live.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum

from ..money import ZERO, dec, div, is_finite_positive, mul, quantize_down


class SizingRejection(str, Enum):
    """Why an entry produced no order. Every value is a terminal decision."""

    INVALID_EQUITY = "INVALID_EQUITY"
    STALE_EQUITY = "STALE_EQUITY"
    INVALID_RISK_FRACTION = "INVALID_RISK_FRACTION"
    INVALID_PRICES = "INVALID_PRICES"
    INVALID_FEES = "INVALID_FEES"
    INVALID_SLIPPAGE = "INVALID_SLIPPAGE"
    NON_POSITIVE_LOSS = "NON_POSITIVE_LOSS"
    NO_RISK_BUDGET = "NO_RISK_BUDGET"
    NO_CASH = "NO_CASH"
    ASSET_CAP_REACHED = "ASSET_CAP_REACHED"
    PORTFOLIO_CAP_REACHED = "PORTFOLIO_CAP_REACHED"
    LIQUIDITY_CAP_REACHED = "LIQUIDITY_CAP_REACHED"
    QUANTITY_ROUNDS_TO_ZERO = "QUANTITY_ROUNDS_TO_ZERO"
    MIN_ORDER_EXCEEDS_RISK = "MIN_ORDER_EXCEEDS_RISK"


@dataclass(frozen=True)
class SizingInputs:
    """Everything needed to size one entry. All values are Decimal."""

    equity: Decimal
    """Total bot-owned equity in quote currency (free + locked + spot value)."""

    risk_per_trade: Decimal
    """Fraction of equity budgeted for this trade's modelled stop loss."""

    entry_price: Decimal
    """P_in: the worst entry price we are willing to accept (limit cap)."""

    stop_price: Decimal
    """P_stop: the strategy's initial absolute stop price."""

    exit_slippage: Decimal
    """Assumed adverse slippage when the stop executes, as a fraction."""

    entry_fee: Decimal
    """Entry fee as a fraction of notional."""

    exit_fee: Decimal
    """Exit fee as a fraction of notional."""

    free_quote: Decimal
    """Unreserved quote currency actually available to spend."""

    asset_notional_cap: Decimal
    """Remaining notional this single asset may occupy, in quote currency."""

    portfolio_notional_cap: Decimal
    """Remaining notional the whole portfolio may occupy, in quote currency."""

    remaining_risk_budget: Decimal
    """Remaining open-risk budget across the portfolio, in quote currency."""

    amount_step: Decimal
    """Exchange quantity precision step (base units)."""

    min_order_amount: Decimal = ZERO
    """Exchange minimum order size in base units. Zero means no minimum."""

    min_order_cost: Decimal = ZERO
    """Exchange minimum order cost in quote currency. Zero means no minimum."""

    liquidity_cap_base: Decimal | None = None
    """Optional cap from observed book depth, already in base units."""

    fee_reserve: Decimal = ZERO
    """Quote amount held back so fees never eat into the cash limit."""


@dataclass(frozen=True)
class SizingResult:
    """Outcome of a sizing attempt.

    Either ``amount`` is positive and the order may proceed, or ``rejection``
    explains why no order exists. There is no third state and no fallback to
    a framework-proposed stake: an error here means zero entry, by design.
    """

    amount: Decimal
    rejection: SizingRejection | None = None
    detail: str = ""
    binding_cap: str = ""
    modelled_loss_per_unit: Decimal = ZERO
    modelled_risk_quote: Decimal = ZERO
    notional: Decimal = ZERO
    caps_base: dict[str, Decimal] = field(default_factory=dict)

    @property
    def accepted(self) -> bool:
        return self.rejection is None and self.amount > ZERO


def _reject(reason: SizingRejection, detail: str) -> SizingResult:
    return SizingResult(amount=ZERO, rejection=reason, detail=detail)


def _is_fraction(value: Decimal, *, allow_zero: bool = True) -> bool:
    """A fee/slippage/risk fraction must be a sane [0,1) ratio, not a percent."""
    if not value.is_finite():
        return False
    if value < ZERO:
        return False
    if value == ZERO:
        return allow_zero
    return value < Decimal(1)


def compute_position_size(inputs: SizingInputs) -> SizingResult:
    """Size a long spot entry, or explain why there is none.

    Raises nothing: every failure path returns a ``SizingResult`` carrying a
    ``SizingRejection``. Callers must treat a rejection as "no trade", never
    as "fall back to a default stake".
    """
    i = inputs

    # --- validate scalars before any arithmetic ----------------------------
    if not is_finite_positive(i.equity):
        return _reject(SizingRejection.INVALID_EQUITY, f"equity={i.equity}")
    if not _is_fraction(i.risk_per_trade, allow_zero=False):
        return _reject(
            SizingRejection.INVALID_RISK_FRACTION,
            f"risk_per_trade={i.risk_per_trade} must be in (0,1)",
        )
    for name, value in (("entry_fee", i.entry_fee), ("exit_fee", i.exit_fee)):
        if not _is_fraction(value):
            return _reject(SizingRejection.INVALID_FEES, f"{name}={value} must be in [0,1)")
    if not _is_fraction(i.exit_slippage):
        return _reject(
            SizingRejection.INVALID_SLIPPAGE, f"exit_slippage={i.exit_slippage} must be in [0,1)"
        )
    if not is_finite_positive(i.amount_step):
        return _reject(SizingRejection.INVALID_PRICES, f"amount_step={i.amount_step}")

    # --- price ordering invariant: 0 < P_out <= P_stop < P_in --------------
    if not is_finite_positive(i.entry_price) or not is_finite_positive(i.stop_price):
        return _reject(
            SizingRejection.INVALID_PRICES,
            f"entry_price={i.entry_price} stop_price={i.stop_price} must both be > 0",
        )
    if i.stop_price >= i.entry_price:
        return _reject(
            SizingRejection.INVALID_PRICES,
            f"stop_price={i.stop_price} must be strictly below entry_price={i.entry_price}",
        )

    exit_price = mul(i.stop_price, Decimal(1) - i.exit_slippage)
    if not is_finite_positive(exit_price) or exit_price > i.stop_price:
        return _reject(
            SizingRejection.INVALID_PRICES,
            f"modelled exit price {exit_price} violates 0 < P_out <= P_stop",
        )

    # --- L: modelled loss per base unit ------------------------------------
    loss_per_unit = (
        (i.entry_price - exit_price)
        + mul(i.entry_price, i.entry_fee)
        + mul(exit_price, i.exit_fee)
    )
    if not is_finite_positive(loss_per_unit):
        return _reject(
            SizingRejection.NON_POSITIVE_LOSS,
            f"loss per unit must be positive and finite, got {loss_per_unit}",
        )

    risk_quote = mul(i.equity, i.risk_per_trade)
    if not is_finite_positive(risk_quote):
        return _reject(SizingRejection.NO_RISK_BUDGET, f"risk budget={risk_quote}")

    # --- every cap, converted into base units ------------------------------
    caps: dict[str, Decimal] = {"risk_per_trade": div(risk_quote, loss_per_unit)}

    if i.remaining_risk_budget < ZERO or not i.remaining_risk_budget.is_finite():
        return _reject(
            SizingRejection.NO_RISK_BUDGET,
            f"remaining_risk_budget={i.remaining_risk_budget}",
        )
    caps["portfolio_risk"] = div(i.remaining_risk_budget, loss_per_unit)

    # Cash: what we can actually pay, fees and reserve included. Spending
    # entry_price*q plus the entry fee must stay inside free_quote.
    spendable = i.free_quote - i.fee_reserve
    if spendable < ZERO:
        spendable = ZERO
    cost_per_unit = mul(i.entry_price, Decimal(1) + i.entry_fee)
    if not is_finite_positive(cost_per_unit):
        return _reject(SizingRejection.INVALID_PRICES, f"cost per unit={cost_per_unit}")
    caps["cash"] = div(spendable, cost_per_unit)

    for cap_name, cap_quote in (
        ("asset_notional", i.asset_notional_cap),
        ("portfolio_notional", i.portfolio_notional_cap),
    ):
        if cap_quote < ZERO or not cap_quote.is_finite():
            return _reject(
                SizingRejection.INVALID_EQUITY, f"{cap_name} cap={cap_quote} is invalid"
            )
        caps[cap_name] = div(cap_quote, i.entry_price)

    if i.liquidity_cap_base is not None:
        if i.liquidity_cap_base < ZERO or not i.liquidity_cap_base.is_finite():
            return _reject(
                SizingRejection.LIQUIDITY_CAP_REACHED,
                f"liquidity_cap_base={i.liquidity_cap_base} is invalid",
            )
        caps["liquidity"] = i.liquidity_cap_base

    binding_cap = min(caps, key=lambda k: caps[k])
    raw_amount = caps[binding_cap]

    # --- round DOWN to exchange precision ----------------------------------
    amount = quantize_down(raw_amount, i.amount_step)

    if amount <= ZERO:
        reason = {
            "cash": SizingRejection.NO_CASH,
            "asset_notional": SizingRejection.ASSET_CAP_REACHED,
            "portfolio_notional": SizingRejection.PORTFOLIO_CAP_REACHED,
            "portfolio_risk": SizingRejection.NO_RISK_BUDGET,
            "liquidity": SizingRejection.LIQUIDITY_CAP_REACHED,
        }.get(binding_cap, SizingRejection.QUANTITY_ROUNDS_TO_ZERO)
        return SizingResult(
            amount=ZERO,
            rejection=reason,
            detail=(
                f"binding cap '{binding_cap}' allows {raw_amount}, which rounds "
                f"down to zero at step {i.amount_step}"
            ),
            binding_cap=binding_cap,
            modelled_loss_per_unit=loss_per_unit,
            caps_base=caps,
        )

    # --- exchange minimums: never size UP to reach them --------------------
    notional = mul(amount, i.entry_price)
    if i.min_order_amount > ZERO and amount < i.min_order_amount:
        return SizingResult(
            amount=ZERO,
            rejection=SizingRejection.MIN_ORDER_EXCEEDS_RISK,
            detail=(
                f"risk-allowed amount {amount} is below exchange minimum "
                f"{i.min_order_amount}; skipping instead of increasing size"
            ),
            binding_cap=binding_cap,
            modelled_loss_per_unit=loss_per_unit,
            notional=notional,
            caps_base=caps,
        )
    if i.min_order_cost > ZERO and notional < i.min_order_cost:
        return SizingResult(
            amount=ZERO,
            rejection=SizingRejection.MIN_ORDER_EXCEEDS_RISK,
            detail=(
                f"risk-allowed notional {notional} is below exchange minimum cost "
                f"{i.min_order_cost}; skipping instead of increasing size"
            ),
            binding_cap=binding_cap,
            modelled_loss_per_unit=loss_per_unit,
            notional=notional,
            caps_base=caps,
        )

    return SizingResult(
        amount=amount,
        binding_cap=binding_cap,
        modelled_loss_per_unit=loss_per_unit,
        modelled_risk_quote=mul(amount, loss_per_unit),
        notional=notional,
        caps_base=caps,
    )


def modelled_risk_for(amount: Decimal, loss_per_unit: Decimal) -> Decimal:
    """Quote-currency risk carried by ``amount`` units at ``loss_per_unit``."""
    return mul(amount, loss_per_unit)
