"""Submitting, cancelling and resolving orders against a venue.

Everything risky about execution lives here, in three rules:

1. **Record before you send.** The intent is durable before any request
   leaves the process, so a crash leaves evidence rather than an orphan.
2. **A timeout is not a failure.** It is an unknown, and an unknown blocks
   resubmission until a query resolves it. The alternative - retrying a
   create because it "probably didn't go through" - is how a bot ends up
   with two positions.
3. **Chasing a price has a limit.** Emergency exits reprice a bounded number
   of times within a bounded distance, then stop and raise an alert. There
   is no configuration that makes it chase forever, because an unbounded
   chase is an unbounded loss.

The venue is any object with ``create_order``, ``cancel_order``,
``fetch_order``, ``fetch_open_orders`` and ``find_by_client_order_id``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum

from ..money import ZERO, dec, mul
from .lifecycle import OrderLedger, OrderState

logger = logging.getLogger(__name__)


class Outcome(str, Enum):
    SUBMITTED = "SUBMITTED"
    REJECTED = "REJECTED"
    UNKNOWN = "UNKNOWN"
    BLOCKED = "BLOCKED"
    FILLED = "FILLED"
    CANCELLED = "CANCELLED"
    NOT_FILLED_ALERT = "NOT_FILLED_ALERT"


@dataclass
class ExecutionResult:
    outcome: Outcome
    intent_id: str
    detail: str = ""
    exchange_order_id: str | None = None
    attempts: int = 0
    alerts: list[str] = field(default_factory=list)

    @property
    def needs_operator(self) -> bool:
        return self.outcome in (Outcome.UNKNOWN, Outcome.NOT_FILLED_ALERT)


# Exception names raised by venue adapters that mean "no answer", as opposed
# to "definitely refused". Matched by name so this module stays decoupled
# from any particular adapter or test double.
_TIMEOUT_NAMES = frozenset(
    {"ExchangeTimeout", "RequestTimeout", "NetworkError", "TemporaryError", "ConnectionError"}
)
_REJECT_NAMES = frozenset({"ExchangeRejected", "InsufficientFunds", "InvalidOrder"})


def _classify(exc: BaseException) -> str:
    name = type(exc).__name__
    if name in _TIMEOUT_NAMES:
        return "timeout"
    if name in _REJECT_NAMES:
        return "reject"
    return "unknown"


class OrderExecutor:
    def __init__(self, ledger: OrderLedger, venue, *, max_reprice_attempts: int = 3):
        self.ledger = ledger
        self.venue = venue
        self.max_reprice_attempts = max_reprice_attempts

    # -- entry / exit submission -------------------------------------------

    def submit(
        self,
        *,
        intent_id: str,
        pair: str,
        side: str,
        amount: Decimal,
        price: Decimal,
        client_order_id: str,
        now: datetime,
    ) -> ExecutionResult:
        allowed, reason = self.ledger.may_submit(intent_id)
        if not allowed:
            return ExecutionResult(Outcome.BLOCKED, intent_id, reason)

        # Durable BEFORE the wire.
        self.ledger.mark_submitted(intent_id, now)

        try:
            response = self.venue.create_order(
                pair=pair, side=side, amount=amount, price=price,
                client_order_id=client_order_id,
            )
        except BaseException as exc:  # noqa: BLE001
            kind = _classify(exc)
            if kind == "reject":
                self.ledger.mark_rejected(intent_id, str(exc), now)
                return ExecutionResult(Outcome.REJECTED, intent_id, str(exc))
            # Timeout or anything unclassified: we do NOT know.
            self.ledger.mark_unknown(intent_id, f"{type(exc).__name__}: {exc}", now)
            return ExecutionResult(
                Outcome.UNKNOWN,
                intent_id,
                f"no confirmation after submit ({type(exc).__name__}). The order may be "
                "live. Resolve by querying the venue before sending anything else.",
            )

        self.ledger.mark_accepted(intent_id, str(response["id"]), now)
        filled = dec(str(response.get("filled", 0)))
        if filled > ZERO:
            self.ledger.mark_filled(intent_id, filled, now, event_id=f"accept:{response['id']}")
        return ExecutionResult(
            Outcome.SUBMITTED, intent_id, "accepted", exchange_order_id=str(response["id"])
        )

    # -- resolving the unknown ---------------------------------------------

    def resolve_unknown(self, intent_id: str, now: datetime) -> ExecutionResult:
        """Find out what actually happened, by ASKING - never by assuming.

        Looks the order up by client order id first, because an intent that
        timed out on submit has no exchange id to look up.
        """
        record = self.ledger.get(intent_id)
        if record is None:
            return ExecutionResult(Outcome.BLOCKED, intent_id, "no such intent")

        found = None
        if record.exchange_order_id:
            try:
                found = self.venue.fetch_order(record.exchange_order_id)
            except BaseException:  # noqa: BLE001
                found = None
        if found is None:
            try:
                found = self.venue.find_by_client_order_id(record.client_order_id)
            except BaseException:  # noqa: BLE001
                found = None

        if found is None:
            return ExecutionResult(
                Outcome.UNKNOWN,
                intent_id,
                "the venue could not be queried or does not recognise the order; "
                "it stays UNKNOWN and keeps blocking resubmission",
            )

        filled = dec(str(found.get("filled", 0)))
        status = str(found.get("status", "")).lower()
        self.ledger.mark_accepted(intent_id, str(found["id"]), now)
        if filled > ZERO:
            self.ledger.mark_filled(intent_id, filled, now, event_id=f"resolve:{found['id']}")
        if status in ("canceled", "cancelled") and filled < dec(str(found.get("amount", 0))):
            self.ledger.mark_cancel_confirmed(intent_id, now)
            return ExecutionResult(Outcome.CANCELLED, intent_id, "resolved: cancelled")
        if status == "closed" or filled >= record.amount:
            return ExecutionResult(Outcome.FILLED, intent_id, "resolved: filled")
        return ExecutionResult(
            Outcome.SUBMITTED, intent_id, f"resolved: still open (filled {filled})"
        )

    # -- cancellation -------------------------------------------------------

    def cancel(self, intent_id: str, now: datetime) -> ExecutionResult:
        """Request a cancel, then require CONFIRMATION before releasing anything."""
        record = self.ledger.get(intent_id)
        if record is None:
            return ExecutionResult(Outcome.BLOCKED, intent_id, "no such intent")
        if record.state.is_terminal:
            return ExecutionResult(
                Outcome.BLOCKED, intent_id, f"already terminal ({record.state.value})"
            )

        self.ledger.mark_cancel_requested(intent_id, now)
        try:
            self.venue.cancel_order(record.exchange_order_id)
        except BaseException as exc:  # noqa: BLE001
            kind = _classify(exc)
            if kind == "reject":
                # Commonly means "already filled". Ask, do not assume.
                return self.resolve_unknown(intent_id, now)
            self.ledger.mark_unknown(intent_id, f"cancel timed out: {exc}", now)
            return ExecutionResult(
                Outcome.UNKNOWN, intent_id,
                "cancel request sent but not confirmed; the order may still be live",
            )

        # Even a successful cancel call is only a claim until we look.
        return self.resolve_unknown(intent_id, now)

    # -- emergency exit with a bounded chase -------------------------------

    def emergency_exit(
        self,
        *,
        intent_prefix: str,
        pair: str,
        amount: Decimal,
        reference_price: Decimal,
        max_slippage: Decimal,
        now: datetime,
        price_feed,
    ) -> ExecutionResult:
        """Try to exit, repricing a bounded number of times, then alert.

        Two failure modes pull against each other and cannot both be avoided:
        a tight price limit may never fill, and a loose one fills at a price
        that may be far worse than intended. This method picks *bounded* over
        *guaranteed*: it will not chase past ``max_slippage``, and when it
        runs out of attempts it stops and asks for a human instead of
        pretending the position is closed.

        It never guarantees a fill. Nothing can.
        """
        alerts: list[str] = []
        worst_allowed = mul(reference_price, dec(1) - max_slippage)

        for attempt in range(1, self.max_reprice_attempts + 1):
            market_price = dec(price_feed())
            limit = max(worst_allowed, mul(market_price, dec(1) - max_slippage))
            if limit < worst_allowed:
                limit = worst_allowed

            intent_id = f"{intent_prefix}|exit|{attempt}"
            client_order_id = intent_id.replace("|", "-")
            self.ledger.record_intent(
                intent_id=intent_id, pair=pair, side="sell", amount=amount,
                price=limit, client_order_id=client_order_id, now=now,
            )
            result = self.submit(
                intent_id=intent_id, pair=pair, side="sell", amount=amount, price=limit,
                client_order_id=client_order_id, now=now,
            )
            if result.outcome is Outcome.UNKNOWN:
                result.alerts = alerts + [
                    "emergency exit outcome unknown; not retried automatically"
                ]
                return result

            record = self.ledger.get(intent_id)
            if record and record.state is OrderState.FILLED:
                return ExecutionResult(
                    Outcome.FILLED, intent_id, f"exited at limit {limit}",
                    attempts=attempt, alerts=alerts,
                )

            alerts.append(
                f"attempt {attempt}: no fill at limit {limit} "
                f"(market {market_price}, floor {worst_allowed})"
            )
            if record and not record.state.is_terminal:
                self.cancel(intent_id, now)

        alerts.append(
            f"EMERGENCY EXIT NOT FILLED after {self.max_reprice_attempts} attempts. "
            f"Price floor {worst_allowed} was not reachable. The position is STILL OPEN. "
            "No further automatic repricing will happen - an operator must decide."
        )
        return ExecutionResult(
            Outcome.NOT_FILLED_ALERT,
            f"{intent_prefix}|exit",
            "bounded repricing exhausted; position still open",
            attempts=self.max_reprice_attempts,
            alerts=alerts,
        )
