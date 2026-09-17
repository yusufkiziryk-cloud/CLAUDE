"""Order lifecycle: intent, submission, acceptance, fill, cancellation.

The distinction this module exists to enforce is the one that separates a
safe execution layer from an unsafe one:

    sending a request        is not        the request being accepted
    a request being accepted is not        the order being filled
    asking to cancel         is not        the order being cancelled

Each of those is a separate, independently observed event. Collapsing any
two of them is how a bot ends up with a position it does not know about, or
sends a second order for an intent that was already live.

State is persisted through the same SQLite connection as the risk store, so
a confirmed cancellation can mark the order CANCELLED *and* release its
budget reservation inside one transaction. Two stores would mean two
truths.

This module never talks to an exchange. It is handed events and asked what
they mean; the caller does the I/O. That is what makes the hard cases
(timeouts, races, duplicate deliveries, crashes) testable without a broker.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum

from ..money import ZERO, dec
from ..risk.state import ReservationState, RiskStore

logger = logging.getLogger(__name__)


class OrderState(str, Enum):
    """Where an order actually is, as opposed to where we hope it is."""

    INTENT = "INTENT"
    """Decided locally. Nothing has been sent. Safe to abandon."""

    SUBMITTED = "SUBMITTED"
    """A request left this process. The exchange may or may not have it."""

    ACCEPTED = "ACCEPTED"
    """The exchange acknowledged it with an id. It is live."""

    PARTIALLY_FILLED = "PARTIALLY_FILLED"
    FILLED = "FILLED"

    CANCEL_REQUESTED = "CANCEL_REQUESTED"
    """A cancel was sent. The order is still live until proven otherwise."""

    CANCELLED = "CANCELLED"
    """Cancellation CONFIRMED by the exchange. Not merely requested."""

    REJECTED = "REJECTED"

    UNKNOWN = "UNKNOWN"
    """We cannot say. Only a successful query may resolve this."""

    @property
    def is_terminal(self) -> bool:
        return self in (OrderState.FILLED, OrderState.CANCELLED, OrderState.REJECTED)

    @property
    def may_be_live_on_exchange(self) -> bool:
        """States where an order might still exist at the venue.

        UNKNOWN is included deliberately: the whole point of the state is
        that we do not know, and assuming "not live" is the assumption that
        produces duplicate orders.
        """
        return self in (
            OrderState.SUBMITTED,
            OrderState.ACCEPTED,
            OrderState.PARTIALLY_FILLED,
            OrderState.CANCEL_REQUESTED,
            OrderState.UNKNOWN,
        )

    @property
    def blocks_resubmission(self) -> bool:
        """May a new order be sent for the same intent?

        Only when the previous attempt is provably gone. A timeout is not
        proof; a confirmed cancellation or rejection is.
        """
        return self.may_be_live_on_exchange


# Transitions that are allowed. Anything else is a bug worth shouting about
# rather than silently applying.
_ALLOWED: dict[OrderState, frozenset[OrderState]] = {
    OrderState.INTENT: frozenset({OrderState.SUBMITTED, OrderState.REJECTED}),
    OrderState.SUBMITTED: frozenset(
        {
            OrderState.ACCEPTED,
            OrderState.PARTIALLY_FILLED,
            OrderState.FILLED,
            OrderState.REJECTED,
            OrderState.UNKNOWN,
        }
    ),
    OrderState.ACCEPTED: frozenset(
        {
            OrderState.PARTIALLY_FILLED,
            OrderState.FILLED,
            OrderState.CANCEL_REQUESTED,
            OrderState.CANCELLED,
            OrderState.UNKNOWN,
        }
    ),
    OrderState.PARTIALLY_FILLED: frozenset(
        {
            OrderState.PARTIALLY_FILLED,
            OrderState.FILLED,
            OrderState.CANCEL_REQUESTED,
            OrderState.CANCELLED,
            OrderState.UNKNOWN,
        }
    ),
    OrderState.CANCEL_REQUESTED: frozenset(
        {
            # A fill can still arrive after a cancel was requested. That race
            # is normal, and the fill wins.
            OrderState.PARTIALLY_FILLED,
            OrderState.FILLED,
            OrderState.CANCELLED,
            OrderState.UNKNOWN,
        }
    ),
    # UNKNOWN is resolvable in any direction, but only by a query result.
    OrderState.UNKNOWN: frozenset(
        {
            OrderState.ACCEPTED,
            OrderState.PARTIALLY_FILLED,
            OrderState.FILLED,
            OrderState.CANCELLED,
            OrderState.REJECTED,
            OrderState.UNKNOWN,
        }
    ),
    OrderState.FILLED: frozenset(),
    OrderState.CANCELLED: frozenset(),
    OrderState.REJECTED: frozenset(),
}


class LifecycleError(RuntimeError):
    pass


class DuplicateIntent(LifecycleError):
    pass


@dataclass(frozen=True)
class OrderRecord:
    intent_id: str
    pair: str
    side: str
    amount: Decimal
    price: Decimal
    state: OrderState
    filled_amount: Decimal
    exchange_order_id: str | None
    client_order_id: str
    created_at: datetime
    updated_at: datetime
    last_error: str = ""

    @property
    def remaining(self) -> Decimal:
        left = self.amount - self.filled_amount
        return left if left > ZERO else ZERO


@dataclass
class ReconciliationResult:
    """What a comparison of our records against the venue concluded."""

    consistent: bool
    resolved: list[str] = field(default_factory=list)
    unresolved: list[str] = field(default_factory=list)
    unrecognised_orders: list[str] = field(default_factory=list)
    unrecognised_positions: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    @property
    def requires_operator(self) -> bool:
        """Anything we could not explain needs a human, not a guess."""
        return bool(self.unresolved or self.unrecognised_orders or self.unrecognised_positions)


_ORDER_SCHEMA = """
CREATE TABLE IF NOT EXISTS orders (
    intent_id TEXT PRIMARY KEY,
    pair TEXT NOT NULL,
    side TEXT NOT NULL,
    amount TEXT NOT NULL,
    price TEXT NOT NULL,
    state TEXT NOT NULL,
    filled_amount TEXT NOT NULL DEFAULT '0',
    exchange_order_id TEXT,
    client_order_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_error TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS order_events (
    event_id TEXT PRIMARY KEY,
    intent_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    received_at TEXT NOT NULL,
    applied INTEGER NOT NULL DEFAULT 1,
    skip_reason TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_orders_state ON orders(state);
CREATE INDEX IF NOT EXISTS idx_events_intent ON order_events(intent_id);
"""


class OrderLedger:
    """Durable, idempotent record of every order this bot intended.

    Shares the risk store's connection so that state changes and budget
    changes commit together.
    """

    def __init__(self, store: RiskStore):
        self.store = store
        self._conn = store._conn
        self._conn.executescript(_ORDER_SCHEMA)

    # -- reads -------------------------------------------------------------

    def get(self, intent_id: str) -> OrderRecord | None:
        row = self._conn.execute(
            "SELECT * FROM orders WHERE intent_id=?", (intent_id,)
        ).fetchone()
        return self._to_record(row) if row else None

    def all_orders(self) -> list[OrderRecord]:
        rows = self._conn.execute("SELECT * FROM orders ORDER BY created_at").fetchall()
        return [self._to_record(r) for r in rows]

    def live_orders(self) -> list[OrderRecord]:
        return [o for o in self.all_orders() if o.state.may_be_live_on_exchange]

    def by_exchange_id(self, exchange_order_id: str) -> OrderRecord | None:
        row = self._conn.execute(
            "SELECT * FROM orders WHERE exchange_order_id=?", (exchange_order_id,)
        ).fetchone()
        return self._to_record(row) if row else None

    def by_client_order_id(self, client_order_id: str) -> OrderRecord | None:
        row = self._conn.execute(
            "SELECT * FROM orders WHERE client_order_id=?", (client_order_id,)
        ).fetchone()
        return self._to_record(row) if row else None

    @staticmethod
    def _to_record(row) -> OrderRecord:
        return OrderRecord(
            intent_id=row["intent_id"],
            pair=row["pair"],
            side=row["side"],
            amount=dec(row["amount"]),
            price=dec(row["price"]),
            state=OrderState(row["state"]),
            filled_amount=dec(row["filled_amount"]),
            exchange_order_id=row["exchange_order_id"],
            client_order_id=row["client_order_id"],
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            last_error=row["last_error"],
        )

    # -- writes ------------------------------------------------------------

    def record_intent(
        self,
        *,
        intent_id: str,
        pair: str,
        side: str,
        amount: Decimal,
        price: Decimal,
        client_order_id: str,
        now: datetime,
    ) -> OrderRecord:
        """Write the intent BEFORE anything is sent.

        This ordering is the whole recovery story: a crash between here and
        the send leaves a durable INTENT we can investigate, whereas a crash
        after an unrecorded send leaves an orphan order at the venue.
        """
        existing = self.get(intent_id)
        if existing is not None:
            raise DuplicateIntent(
                f"intent {intent_id} already exists in state {existing.state.value}"
            )
        with self.store._tx() as conn:
            conn.execute(
                "INSERT INTO orders(intent_id, pair, side, amount, price, state, "
                "filled_amount, client_order_id, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, '0', ?, ?, ?)",
                (
                    intent_id, pair, side, str(amount), str(price),
                    OrderState.INTENT.value, client_order_id, now.isoformat(), now.isoformat(),
                ),
            )
        return self.get(intent_id)  # type: ignore[return-value]

    def may_submit(self, intent_id: str) -> tuple[bool, str]:
        """Is it safe to send an order for this intent?"""
        record = self.get(intent_id)
        if record is None:
            return False, f"no recorded intent {intent_id}; refusing to send an unrecorded order"
        if record.state is OrderState.INTENT:
            return True, "intent is fresh"
        if record.state.blocks_resubmission:
            return False, (
                f"intent {intent_id} is in state {record.state.value}, which may still be "
                "live on the exchange. Resolve it by querying the venue before sending "
                "anything else for this intent."
            )
        return False, f"intent {intent_id} already reached terminal state {record.state.value}"

    def _apply(
        self,
        intent_id: str,
        new_state: OrderState,
        now: datetime,
        *,
        event_id: str | None = None,
        kind: str = "",
        payload: dict | None = None,
        filled_amount: Decimal | None = None,
        exchange_order_id: str | None = None,
        error: str | None = None,
    ) -> OrderRecord:
        with self.store._tx() as conn:
            if event_id is not None:
                already = conn.execute(
                    "SELECT applied FROM order_events WHERE event_id=?", (event_id,)
                ).fetchone()
                if already is not None:
                    # Exchanges redeliver. Applying twice would double-count a
                    # fill, so the event id is the idempotency key.
                    logger.debug("ignoring duplicate event %s", event_id)
                    return self.get(intent_id)  # type: ignore[return-value]

            row = conn.execute(
                "SELECT * FROM orders WHERE intent_id=?", (intent_id,)
            ).fetchone()
            if row is None:
                raise LifecycleError(f"unknown intent {intent_id}")
            current = OrderState(row["state"])
            current_filled = dec(row["filled_amount"])
            amount = dec(row["amount"])

            skip_reason = ""
            target = new_state
            next_filled = current_filled

            if filled_amount is not None:
                if filled_amount > amount:
                    raise LifecycleError(
                        f"reported fill {filled_amount} exceeds order amount {amount} "
                        f"for {intent_id}"
                    )
                if filled_amount < current_filled:
                    # Out-of-order or stale delivery. Fills only ever grow.
                    skip_reason = (
                        f"stale fill {filled_amount} < recorded {current_filled}; kept recorded"
                    )
                else:
                    next_filled = filled_amount

            if current.is_terminal:
                skip_reason = skip_reason or (
                    f"order already terminal in {current.value}; refusing transition to "
                    f"{target.value}"
                )
                target = current
            elif target is not current and target not in _ALLOWED[current]:
                skip_reason = skip_reason or (
                    f"illegal transition {current.value} -> {target.value}"
                )
                target = current

            # A fill always outranks a pending cancellation.
            if target is OrderState.CANCELLED and next_filled >= amount and amount > ZERO:
                target = OrderState.FILLED
                skip_reason = "cancel lost the race to a complete fill"
            elif target is OrderState.CANCELLED and next_filled > ZERO:
                # Partially filled then cancelled: the filled part is real.
                skip_reason = skip_reason or "cancelled after a partial fill"

            if event_id is not None:
                conn.execute(
                    "INSERT INTO order_events(event_id, intent_id, kind, payload, "
                    "received_at, applied, skip_reason) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (
                        event_id, intent_id, kind, json.dumps(payload or {}, default=str),
                        now.isoformat(), 0 if skip_reason else 1, skip_reason,
                    ),
                )
            if skip_reason:
                logger.warning("order event for %s not fully applied: %s", intent_id, skip_reason)

            conn.execute(
                "UPDATE orders SET state=?, filled_amount=?, updated_at=?, "
                "exchange_order_id=COALESCE(?, exchange_order_id), "
                "last_error=COALESCE(?, last_error) WHERE intent_id=?",
                (
                    target.value, str(next_filled), now.isoformat(),
                    exchange_order_id, error, intent_id,
                ),
            )

        self._sync_reservation(intent_id, now)
        return self.get(intent_id)  # type: ignore[return-value]

    def _sync_reservation(self, intent_id: str, now: datetime) -> None:
        """Keep the budget reservation in step with the order's real state."""
        record = self.get(intent_id)
        if record is None or self.store.get_reservation(intent_id) is None:
            return
        if record.filled_amount > ZERO:
            self.store.record_partial_fill(intent_id, record.filled_amount, now)
        if record.state is OrderState.UNKNOWN:
            self.store.mark_unknown(intent_id, "order outcome unresolved", now)
        elif record.state in (OrderState.CANCELLED, OrderState.REJECTED):
            # Only a CONFIRMED end releases the remaining budget.
            reservation = self.store.get_reservation(intent_id)
            if reservation and reservation.state is not ReservationState.FILLED:
                self.store.release(intent_id, f"order {record.state.value}", now)

    # -- the events themselves ---------------------------------------------

    def mark_submitted(self, intent_id: str, now: datetime) -> OrderRecord:
        return self._apply(intent_id, OrderState.SUBMITTED, now, kind="submit")

    def mark_accepted(
        self, intent_id: str, exchange_order_id: str, now: datetime, *, event_id: str | None = None
    ) -> OrderRecord:
        return self._apply(
            intent_id, OrderState.ACCEPTED, now,
            event_id=event_id, kind="accept", exchange_order_id=exchange_order_id,
        )

    def mark_filled(
        self,
        intent_id: str,
        filled_amount: Decimal,
        now: datetime,
        *,
        event_id: str | None = None,
    ) -> OrderRecord:
        record = self.get(intent_id)
        if record is None:
            raise LifecycleError(f"unknown intent {intent_id}")
        complete = filled_amount >= record.amount
        return self._apply(
            intent_id,
            OrderState.FILLED if complete else OrderState.PARTIALLY_FILLED,
            now,
            event_id=event_id,
            kind="fill",
            payload={"filled": str(filled_amount)},
            filled_amount=filled_amount,
        )

    def mark_cancel_requested(self, intent_id: str, now: datetime) -> OrderRecord:
        """A cancel was SENT. The order is still assumed live."""
        return self._apply(intent_id, OrderState.CANCEL_REQUESTED, now, kind="cancel_request")

    def mark_cancel_confirmed(
        self, intent_id: str, now: datetime, *, event_id: str | None = None
    ) -> OrderRecord:
        """The venue CONFIRMED the order is gone."""
        return self._apply(
            intent_id, OrderState.CANCELLED, now, event_id=event_id, kind="cancel_confirmed"
        )

    def mark_rejected(self, intent_id: str, reason: str, now: datetime) -> OrderRecord:
        return self._apply(
            intent_id, OrderState.REJECTED, now, kind="reject", error=reason
        )

    def mark_unknown(self, intent_id: str, reason: str, now: datetime) -> OrderRecord:
        """Communication failed at a point where the outcome is undetermined.

        This is NOT a failure state. It is an honest one, and it deliberately
        keeps blocking resubmission until a query resolves it.
        """
        return self._apply(
            intent_id, OrderState.UNKNOWN, now, kind="unknown", error=reason
        )

    # -- reconciliation ----------------------------------------------------

    def reconcile(
        self,
        *,
        open_orders: list[dict],
        recent_fills: list[dict],
        known_positions: set[str],
        now: datetime,
        history_complete: bool = True,
    ) -> ReconciliationResult:
        """Compare our records against a venue snapshot.

        ``history_complete`` says whether the caller could actually see the
        full fill history. When it could not, unresolved orders stay
        unresolved instead of being optimistically closed - an API limit is
        not evidence that nothing happened.
        """
        result = ReconciliationResult(consistent=True)

        open_by_id = {str(o.get("id")): o for o in open_orders}
        open_by_cloid = {
            str(o.get("clientOrderId")): o for o in open_orders if o.get("clientOrderId")
        }
        fills_by_order: dict[str, Decimal] = {}
        for fill in recent_fills:
            key = str(fill.get("order"))
            fills_by_order[key] = fills_by_order.get(key, ZERO) + dec(str(fill.get("amount", 0)))

        for record in self.live_orders():
            venue = None
            if record.exchange_order_id and record.exchange_order_id in open_by_id:
                venue = open_by_id[record.exchange_order_id]
            elif record.client_order_id in open_by_cloid:
                venue = open_by_cloid[record.client_order_id]

            if venue is not None:
                filled = dec(str(venue.get("filled", 0)))
                if filled > record.filled_amount:
                    self.mark_filled(record.intent_id, filled, now)
                    result.notes.append(
                        f"{record.intent_id}: venue reports more filled ({filled}) than "
                        f"recorded ({record.filled_amount})"
                    )
                result.resolved.append(record.intent_id)
                continue

            # Not open at the venue. Did it fill, or did it vanish?
            venue_filled = fills_by_order.get(str(record.exchange_order_id), ZERO)
            if venue_filled > ZERO:
                self.mark_filled(record.intent_id, venue_filled, now)
                result.resolved.append(record.intent_id)
                continue

            if record.state is OrderState.UNKNOWN or not history_complete:
                # Absence is not proof. An order we never saw acknowledged,
                # or a history we could not fully read, stays unresolved.
                result.unresolved.append(record.intent_id)
                result.consistent = False
                result.notes.append(
                    f"{record.intent_id}: not open and no fills found, but "
                    + (
                        "the fill history is incomplete"
                        if not history_complete
                        else "the order was never confirmed"
                    )
                    + " - refusing to assume it never existed"
                )
                continue

            if record.state in (OrderState.ACCEPTED, OrderState.CANCEL_REQUESTED):
                self.mark_cancel_confirmed(record.intent_id, now)
                result.resolved.append(record.intent_id)
                result.notes.append(
                    f"{record.intent_id}: gone from the venue with no fills; treated as cancelled"
                )
                continue

            result.unresolved.append(record.intent_id)
            result.consistent = False

        # Orders at the venue that are not ours.
        ours = {o.exchange_order_id for o in self.all_orders() if o.exchange_order_id}
        our_cloids = {o.client_order_id for o in self.all_orders()}
        for order_id, order in open_by_id.items():
            if order_id in ours:
                continue
            if str(order.get("clientOrderId") or "") in our_cloids:
                continue
            result.unrecognised_orders.append(order_id)
            result.consistent = False

        for position in known_positions:
            if not any(o.pair == position for o in self.all_orders()):
                result.unrecognised_positions.append(position)
                result.consistent = False

        if result.unrecognised_orders:
            result.notes.append(
                "unrecognised orders found at the venue - they are NOT adopted, "
                "cancelled or closed automatically; entries stop and an operator decides"
            )
        return result
