"""Decimal money/quantity helpers.

All monetary and quantity arithmetic in this project goes through Decimal.
Float is only tolerated at the boundary (exchange/framework APIs), and is
converted here exactly once, via ``str()`` so that we never inherit a
float's binary rounding error into the ledger.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_DOWN, ROUND_UP, localcontext
from typing import Any

# 34 significant digits (IEEE 754-2008 decimal128). Far beyond any exchange
# precision, so intermediate results never lose meaningful digits.
PRECISION = 34

ZERO = Decimal(0)


class MoneyError(ValueError):
    """Raised when a value cannot be represented as a finite Decimal."""


def dec(value: Any) -> Decimal:
    """Convert to Decimal, rejecting NaN/Infinity and unparseable input.

    Floats are routed through ``str()`` on purpose: ``Decimal(0.1)`` yields
    0.1000000000000000055511151231257827, ``Decimal("0.1")`` yields 0.1.
    """
    if isinstance(value, Decimal):
        result = value
    elif isinstance(value, bool):
        # bool is an int subclass; accepting it silently hides caller bugs.
        raise MoneyError(f"bool is not a valid numeric value: {value!r}")
    elif isinstance(value, int):
        return Decimal(value)
    elif isinstance(value, float):
        try:
            result = Decimal(str(value))
        except InvalidOperation as exc:
            raise MoneyError(f"cannot convert to Decimal: {value!r}") from exc
    elif isinstance(value, str):
        try:
            result = Decimal(value.strip())
        except InvalidOperation as exc:
            raise MoneyError(f"cannot convert to Decimal: {value!r}") from exc
    else:
        raise MoneyError(f"unsupported type for Decimal conversion: {type(value).__name__}")

    if not result.is_finite():
        raise MoneyError(f"non-finite value rejected: {value!r}")
    return result


def is_finite_positive(value: Decimal) -> bool:
    return value.is_finite() and value > ZERO


def mul(a: Any, b: Any) -> Decimal:
    with localcontext() as ctx:
        ctx.prec = PRECISION
        return dec(a) * dec(b)


def div(a: Any, b: Any) -> Decimal:
    divisor = dec(b)
    if divisor == ZERO:
        raise MoneyError("division by zero")
    with localcontext() as ctx:
        ctx.prec = PRECISION
        return dec(a) / divisor


def quantize_down(value: Any, step: Any) -> Decimal:
    """Round ``value`` down to a multiple of ``step``.

    Used for order quantities: rounding up could push the final order past a
    risk limit that was validated against the unrounded value.
    """
    step_d = dec(step)
    if not is_finite_positive(step_d):
        raise MoneyError(f"step must be positive, got {step_d}")
    value_d = dec(value)
    with localcontext() as ctx:
        ctx.prec = PRECISION
        return (value_d / step_d).to_integral_value(rounding=ROUND_DOWN) * step_d


def quantize_up(value: Any, step: Any) -> Decimal:
    step_d = dec(step)
    if not is_finite_positive(step_d):
        raise MoneyError(f"step must be positive, got {step_d}")
    value_d = dec(value)
    with localcontext() as ctx:
        ctx.prec = PRECISION
        return (value_d / step_d).to_integral_value(rounding=ROUND_UP) * step_d


def step_from_decimals(decimals: int) -> Decimal:
    """Convert an exchange ``szDecimals``-style integer into a step size."""
    if decimals < 0:
        raise MoneyError(f"decimals must be >= 0, got {decimals}")
    return Decimal(1).scaleb(-decimals)


def to_float(value: Decimal) -> float:
    """Boundary conversion back to float, for framework APIs that demand it."""
    return float(value)
