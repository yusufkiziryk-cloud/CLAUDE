"""Loading and strict validation of policy.yaml.

policy.yaml holds OUR risk policy. It is deliberately a separate file from
the freqtrade config: none of these keys are freqtrade keys, and freqtrade
never sees them. Mixing the two is how invented config fields get shipped.

Validation is fail-closed and total. Anything the schema does not describe
is a startup error, because a silently ignored key is a risk limit that
looks configured and is not.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any

import yaml

from .money import MoneyError, dec

SCHEMA_VERSION = 1


class PolicyError(ValueError):
    """Raised for any policy file that cannot be trusted. Always fatal."""


@dataclass(frozen=True)
class Field:
    """One validated leaf value.

    ``kind`` carries the unit, which is what actually catches the classic
    "0.03 vs 3" percent/ratio mistake.
    """

    kind: str  # fraction | positive_number | non_negative_number | count | string | bool | enum
    required: bool = True
    minimum: float | None = None
    maximum: float | None = None
    choices: tuple[str, ...] = ()
    default: Any = None
    doc: str = ""


# A fraction is a ratio in [0,1]. Anything above 1 is almost certainly a
# percentage that was pasted without dividing by 100, so it is rejected
# rather than silently applied as a 300% risk budget.
FRACTION_MAX = 1.0

SCHEMA: dict[str, dict[str, Field]] = {
    "meta": {
        "schema_version": Field("count", minimum=1, maximum=1, doc="Must equal 1."),
        "policy_id": Field("string", doc="Stable identifier recorded in every report."),
        "description": Field("string", required=False, default=""),
    },
    "exchange": {
        "id": Field("enum", choices=("hyperliquid",), doc="Single exchange in V1."),
        "trading_mode": Field("enum", choices=("spot",), doc="Spot only. No margin, no futures."),
        "quote_currency": Field("string", doc="Quote/settlement asset, e.g. USDC."),
        "stoploss_on_exchange_available": Field(
            "bool",
            doc="Verified capability. False for Hyperliquid spot; see docs/CAPABILITIES.md.",
        ),
    },
    "risk": {
        "starting_balance_quote": Field(
            "positive_number", doc="Simulated dry-run capital. Not a real balance."
        ),
        "risk_per_trade": Field("fraction", minimum=0.0001, maximum=0.05),
        "max_open_positions": Field("count", minimum=1, maximum=10),
        "max_total_open_risk": Field("fraction", minimum=0.0001, maximum=0.20),
        "max_asset_notional_fraction": Field("fraction", minimum=0.01),
        "max_portfolio_notional_fraction": Field("fraction", minimum=0.01),
        "daily_loss_limit": Field("fraction", minimum=0.001, maximum=0.5),
        "weekly_loss_limit": Field("fraction", minimum=0.001, maximum=0.5),
        "max_drawdown_from_peak": Field("fraction", minimum=0.001, maximum=0.5),
        "consecutive_stop_count": Field("count", minimum=1, maximum=20),
        "consecutive_stop_cooldown_hours": Field("positive_number", minimum=1),
        "pair_cooldown_candles": Field("count", minimum=0, maximum=100),
        "fee_reserve_fraction": Field("fraction", maximum=0.1),
        "correlation_group": Field(
            "string", doc="All V1 pairs share one crypto risk bucket by design."
        ),
    },
    "costs": {
        "entry_fee": Field("fraction", maximum=0.01),
        "exit_fee": Field("fraction", maximum=0.01),
        "exit_slippage_assumption": Field("fraction", maximum=0.10),
        "emergency_exit_max_slippage": Field("fraction", maximum=0.10),
        "ccxt_market_order_slippage_cap": Field(
            "fraction",
            maximum=0.20,
            doc="ccxt emulates Hyperliquid market orders as limit orders with this cap.",
        ),
        "fee_source": Field("string", doc="URL + check date. No imaginary discounts."),
    },
    "entry_gates": {
        "max_spread_bps": Field("positive_number", maximum=1000),
        "max_data_age_seconds": Field("positive_number", minimum=1),
        "min_book_depth_quote": Field("positive_number"),
        "max_price_deviation_bps": Field("positive_number", maximum=5000),
        "min_daily_quote_volume": Field("positive_number"),
        "require_liquidity_data": Field("bool", doc="No book data means no entry eligibility."),
    },
    "strategy": {
        "timeframe": Field("enum", choices=("4h",)),
        "ema_fast": Field("count", minimum=2, maximum=1000),
        "ema_slow": Field("count", minimum=3, maximum=1000),
        "adx_period": Field("count", minimum=2, maximum=200),
        "adx_min": Field("positive_number", maximum=100),
        "atr_period": Field("count", minimum=2, maximum=200),
        "atr_stop_multiple": Field("positive_number", minimum=0.1, maximum=20),
        "startup_candles": Field("count", minimum=1, maximum=5000),
        "trailing_stop_enabled": Field("bool", doc="Off in the baseline. Separate experiment."),
        "position_adjustment_enabled": Field("bool", doc="Off in V1."),
    },
    "operations": {
        "max_reconcile_age_seconds": Field("positive_number", minimum=1),
        "heartbeat_interval_seconds": Field("positive_number", minimum=1),
        "max_clock_skew_seconds": Field("positive_number", minimum=1),
        "max_pending_order_age_seconds": Field("positive_number", minimum=1),
        "notification_outage_entry_halt_seconds": Field("positive_number", minimum=1),
        "max_orderbook_age_seconds": Field(
            "positive_number",
            minimum=1,
            doc="Book staleness. NOT the same clock as candle age - a 4h candle is "
            "legitimately hours old, a book snapshot is not.",
        ),
        "max_api_error_rate": Field(
            "fraction", maximum=1.0, doc="Error fraction over the rolling API window."
        ),
        "api_error_window_seconds": Field("positive_number", minimum=10),
        "min_free_disk_mb": Field("positive_number", minimum=1),
        "heartbeat_miss_tolerance": Field(
            "positive_number",
            minimum=1,
            maximum=100,
            doc="How many heartbeat intervals may be missed before the loop is "
            "considered frozen.",
        ),
    },
}

_TRUE_FALSE = (True, False)


def _validate_leaf(path: str, field: Field, raw: Any) -> Any:
    kind = field.kind

    if kind == "bool":
        if raw not in _TRUE_FALSE or not isinstance(raw, bool):
            raise PolicyError(f"{path}: expected true/false, got {raw!r}")
        return raw

    if kind == "string":
        if not isinstance(raw, str) or not raw.strip():
            raise PolicyError(f"{path}: expected a non-empty string, got {raw!r}")
        return raw.strip()

    if kind == "enum":
        if raw not in field.choices:
            raise PolicyError(f"{path}: expected one of {list(field.choices)}, got {raw!r}")
        return raw

    if kind == "count":
        if isinstance(raw, bool) or not isinstance(raw, int):
            raise PolicyError(f"{path}: expected a whole number, got {raw!r}")
        value: float = raw
    else:
        if isinstance(raw, bool) or not isinstance(raw, (int, float)):
            raise PolicyError(f"{path}: expected a number, got {raw!r}")
        value = float(raw)
        if math.isnan(value) or math.isinf(value):
            raise PolicyError(f"{path}: NaN/Infinity is not a valid policy value, got {raw!r}")

    if kind == "fraction":
        if value < 0:
            raise PolicyError(f"{path}: fraction must not be negative, got {raw!r}")
        if value > FRACTION_MAX:
            raise PolicyError(
                f"{path}: {raw!r} is greater than 1. This field is a ratio, not a percentage "
                f"- write {value / 100:g} instead of {value:g} if you meant {value:g}%."
            )
    elif kind == "positive_number":
        if value <= 0:
            raise PolicyError(f"{path}: must be strictly positive, got {raw!r}")
    elif kind == "non_negative_number":
        if value < 0:
            raise PolicyError(f"{path}: must not be negative, got {raw!r}")

    if field.minimum is not None and value < field.minimum:
        raise PolicyError(f"{path}: {raw!r} is below the allowed minimum {field.minimum}")
    if field.maximum is not None and value > field.maximum:
        raise PolicyError(f"{path}: {raw!r} is above the allowed maximum {field.maximum}")

    if kind == "count":
        return int(raw)
    try:
        return dec(raw)
    except MoneyError as exc:
        raise PolicyError(f"{path}: {exc}") from exc


def _validate_section(name: str, fields: dict[str, Field], raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise PolicyError(f"{name}: expected a mapping, got {type(raw).__name__}")

    unknown = sorted(set(raw) - set(fields))
    if unknown:
        raise PolicyError(
            f"{name}: unknown key(s) {unknown}. Unknown keys are rejected because a "
            f"misspelled limit is a limit that is not applied. Known keys: {sorted(fields)}"
        )

    out: dict[str, Any] = {}
    for key, field in fields.items():
        if key not in raw:
            if field.required:
                raise PolicyError(f"{name}.{key}: required key is missing")
            out[key] = field.default
            continue
        out[key] = _validate_leaf(f"{name}.{key}", field, raw[key])
    return out


@dataclass(frozen=True)
class Policy:
    """A validated policy. Attribute access mirrors the YAML sections."""

    meta: dict[str, Any]
    exchange: dict[str, Any]
    risk: dict[str, Any]
    costs: dict[str, Any]
    entry_gates: dict[str, Any]
    strategy: dict[str, Any]
    operations: dict[str, Any]
    source_path: str = ""
    policy_hash: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "meta": self.meta,
            "exchange": self.exchange,
            "risk": self.risk,
            "costs": self.costs,
            "entry_gates": self.entry_gates,
            "strategy": self.strategy,
            "operations": self.operations,
        }


def _cross_check(policy: dict[str, dict[str, Any]]) -> None:
    """Relationships between fields that no single-field rule can catch."""
    risk = policy["risk"]
    strategy = policy["strategy"]

    per_trade: Decimal = risk["risk_per_trade"]
    total: Decimal = risk["max_total_open_risk"]
    if per_trade > total:
        raise PolicyError(
            f"risk.risk_per_trade ({per_trade}) exceeds risk.max_total_open_risk ({total}): "
            "a single trade could never be opened within the portfolio budget."
        )

    max_positions: int = risk["max_open_positions"]
    if per_trade * max_positions < total:
        # Not fatal in itself, but it means max_total_open_risk can never bind,
        # which silently disables a limit the operator believes is active.
        raise PolicyError(
            f"risk.max_total_open_risk ({total}) can never be reached: "
            f"{max_positions} positions x {per_trade} = {per_trade * max_positions}. "
            "Lower max_total_open_risk or raise max_open_positions so the limit is real."
        )

    if risk["daily_loss_limit"] > risk["weekly_loss_limit"]:
        raise PolicyError(
            f"risk.daily_loss_limit ({risk['daily_loss_limit']}) exceeds "
            f"risk.weekly_loss_limit ({risk['weekly_loss_limit']}): the weekly limit "
            "would never bind."
        )

    if risk["max_asset_notional_fraction"] > risk["max_portfolio_notional_fraction"]:
        raise PolicyError(
            "risk.max_asset_notional_fraction exceeds risk.max_portfolio_notional_fraction"
        )

    if strategy["ema_fast"] >= strategy["ema_slow"]:
        raise PolicyError(
            f"strategy.ema_fast ({strategy['ema_fast']}) must be shorter than "
            f"strategy.ema_slow ({strategy['ema_slow']})"
        )

    if strategy["startup_candles"] < strategy["ema_slow"]:
        raise PolicyError(
            f"strategy.startup_candles ({strategy['startup_candles']}) is below "
            f"strategy.ema_slow ({strategy['ema_slow']}): the slow EMA would be "
            "computed from an incomplete warm-up window."
        )

    costs = policy["costs"]
    if costs["emergency_exit_max_slippage"] > costs["ccxt_market_order_slippage_cap"]:
        raise PolicyError(
            "costs.emergency_exit_max_slippage exceeds "
            "costs.ccxt_market_order_slippage_cap: the exchange adapter would reject "
            "or silently cap the emergency exit."
        )


def load_policy(path: str | Path) -> Policy:
    """Read, validate and hash a policy file. Raises PolicyError on any doubt."""
    source = Path(path)
    if not source.is_file():
        raise PolicyError(f"policy file not found: {source}")

    text = source.read_text(encoding="utf-8")
    try:
        raw = yaml.safe_load(text)
    except yaml.YAMLError as exc:
        raise PolicyError(f"{source}: invalid YAML: {exc}") from exc

    if not isinstance(raw, dict):
        raise PolicyError(f"{source}: top level must be a mapping, got {type(raw).__name__}")

    unknown_sections = sorted(set(raw) - set(SCHEMA))
    if unknown_sections:
        raise PolicyError(
            f"{source}: unknown section(s) {unknown_sections}. Known sections: {sorted(SCHEMA)}"
        )
    missing_sections = sorted(set(SCHEMA) - set(raw))
    if missing_sections:
        raise PolicyError(f"{source}: missing required section(s) {missing_sections}")

    validated = {name: _validate_section(name, fields, raw[name]) for name, fields in SCHEMA.items()}

    if validated["meta"]["schema_version"] != SCHEMA_VERSION:
        raise PolicyError(
            f"{source}: schema_version {validated['meta']['schema_version']} is not supported "
            f"(this build understands {SCHEMA_VERSION})"
        )

    _cross_check(validated)

    return Policy(
        **validated,
        source_path=str(source.resolve()),
        policy_hash=policy_hash(text),
    )


def policy_hash(text: str) -> str:
    """Stable hash of the policy source, recorded in every run and report."""
    import hashlib

    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()
