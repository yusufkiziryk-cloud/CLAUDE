"""A stateful fake venue for exercising the order lifecycle.

This is not a mock that returns success to everything. It keeps its own
order book and balances, fills resting orders as the price moves, and can be
told to fail in the specific ways that real venues fail:

* accept an order and then time out the *response* - the case where the
  client does not know whether it has an order,
* lose a cancel/fill race,
* deliver the same event twice, or out of order,
* refuse to fill at all, or gap straight past a stop price.

A scenario that passes against this fake is NOT "verified on the exchange".
It is verified against our model of the exchange. The difference matters and
is recorded in docs/TEST_MATRIX.md.
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from decimal import Decimal

from kripto.money import ZERO, dec


class ExchangeTimeout(Exception):
    """The response was lost. Says nothing about whether the order exists."""


class ExchangeRejected(Exception):
    """The venue actively refused the order. It does not exist."""


class RateLimited(Exception):
    pass


@dataclass
class FakeOrder:
    id: str
    client_order_id: str
    pair: str
    side: str
    amount: Decimal
    price: Decimal
    filled: Decimal = ZERO
    status: str = "open"  # open | closed | canceled | rejected

    def as_ccxt(self) -> dict:
        return {
            "id": self.id,
            "clientOrderId": self.client_order_id,
            "symbol": self.pair,
            "side": self.side,
            "amount": float(self.amount),
            "price": float(self.price),
            "filled": float(self.filled),
            "remaining": float(self.amount - self.filled),
            "status": self.status,
        }


@dataclass
class FakeExchange:
    """Deterministic, stateful venue."""

    # -- fault injection ---------------------------------------------------
    timeout_on_create: bool = False
    """Record the order, then raise a timeout to the caller."""

    timeout_on_cancel: bool = False
    """Accept the cancel request, then raise a timeout to the caller."""

    reject_next_create: bool = False
    cancel_loses_race: bool = False
    """A cancel arrives after the order has already filled."""

    never_fill: bool = False
    partial_fill_fraction: Decimal | None = None
    rate_limit_next: int = 0

    # -- state -------------------------------------------------------------
    orders: dict[str, FakeOrder] = field(default_factory=dict)
    trades: list[dict] = field(default_factory=list)
    last_price: Decimal = dec("100")
    _ids: itertools.count = field(default_factory=lambda: itertools.count(1))
    _trade_ids: itertools.count = field(default_factory=lambda: itertools.count(1))
    call_log: list[tuple[str, str]] = field(default_factory=list)

    # -- venue API ---------------------------------------------------------

    def create_order(
        self, pair: str, side: str, amount, price, client_order_id: str = ""
    ) -> dict:
        self.call_log.append(("create_order", client_order_id))
        if self.rate_limit_next > 0:
            self.rate_limit_next -= 1
            raise RateLimited("429")
        if self.reject_next_create:
            self.reject_next_create = False
            raise ExchangeRejected("insufficient balance")

        order = FakeOrder(
            id=f"X{next(self._ids)}",
            client_order_id=client_order_id,
            pair=pair,
            side=side,
            amount=dec(amount),
            price=dec(price),
        )
        # The order exists at the venue from THIS point on, whether or not the
        # caller ever learns about it.
        self.orders[order.id] = order

        if self.timeout_on_create:
            raise ExchangeTimeout("no response after submit")
        return order.as_ccxt()

    def cancel_order(self, order_id: str) -> dict:
        self.call_log.append(("cancel_order", order_id))
        order = self.orders.get(order_id)
        if order is None:
            raise ExchangeRejected(f"unknown order {order_id}")

        if self.cancel_loses_race:
            # The fill landed first; the cancel is too late.
            self._fill(order, order.amount - order.filled)
            self.cancel_loses_race = False
            raise ExchangeRejected("order already filled")

        if self.timeout_on_cancel:
            order.status = "canceled"
            raise ExchangeTimeout("no response after cancel")

        order.status = "canceled"
        return order.as_ccxt()

    def fetch_order(self, order_id: str) -> dict:
        self.call_log.append(("fetch_order", order_id))
        order = self.orders.get(order_id)
        if order is None:
            raise ExchangeRejected(f"unknown order {order_id}")
        return order.as_ccxt()

    def fetch_open_orders(self, pair: str | None = None) -> list[dict]:
        self.call_log.append(("fetch_open_orders", pair or ""))
        return [
            o.as_ccxt()
            for o in self.orders.values()
            if o.status == "open" and (pair is None or o.pair == pair)
        ]

    def fetch_my_trades(self, pair: str | None = None) -> list[dict]:
        self.call_log.append(("fetch_my_trades", pair or ""))
        return [t for t in self.trades if pair is None or t["symbol"] == pair]

    def find_by_client_order_id(self, client_order_id: str) -> dict | None:
        for order in self.orders.values():
            if order.client_order_id == client_order_id:
                return order.as_ccxt()
        return None

    # -- market simulation -------------------------------------------------

    def tick(self, price) -> list[dict]:
        """Move the market and fill whatever the move touches.

        A buy limit fills when the price trades at or below its limit; a sell
        limit when the price trades at or above it. Calling tick with a price
        far away from the previous one models a GAP: nothing in between is
        touched, which is exactly how a stop can be jumped.
        """
        price = dec(price)
        self.last_price = price
        if self.never_fill:
            return []

        events = []
        for order in list(self.orders.values()):
            if order.status != "open":
                continue
            touched = (
                (order.side == "buy" and price <= order.price)
                or (order.side == "sell" and price >= order.price)
            )
            if not touched:
                continue
            remaining = order.amount - order.filled
            if self.partial_fill_fraction is not None:
                quantity = remaining * self.partial_fill_fraction
            else:
                quantity = remaining
            if quantity <= ZERO:
                continue
            events.append(self._fill(order, quantity))
        return events

    def _fill(self, order: FakeOrder, quantity: Decimal) -> dict:
        quantity = min(quantity, order.amount - order.filled)
        order.filled += quantity
        if order.filled >= order.amount:
            order.status = "closed"
        trade = {
            "id": f"T{next(self._trade_ids)}",
            "order": order.id,
            "symbol": order.pair,
            "side": order.side,
            "amount": float(quantity),
            "price": float(order.price),
        }
        self.trades.append(trade)
        return {
            "event_id": trade["id"],
            "order_id": order.id,
            "client_order_id": order.client_order_id,
            "filled": order.filled,
            "status": order.status,
        }


def duplicated(events: list[dict]) -> list[dict]:
    """Deliver every event twice, as a flaky feed would."""
    return [event for event in events for _ in range(2)]


def reordered(events: list[dict]) -> list[dict]:
    """Deliver events newest-first, as an out-of-order feed would."""
    return list(reversed(events))
