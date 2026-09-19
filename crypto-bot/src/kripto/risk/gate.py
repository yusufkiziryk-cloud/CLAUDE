"""The entry gate: the single place that decides whether an entry may happen.

Order of checks is deliberate. The cheap, absolute refusals come first, so a
locked-out bot never even computes a size; the atomic reservation comes last,
so budget is only taken once every other condition has already passed.

The gate can only ever REFUSE or SIZE DOWN. It has no path that increases
risk, and it never returns a fallback stake.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal

from ..money import ZERO, dec, mul
from .equity import EquitySnapshot, drawdown_from_peak, period_loss_fraction
from .sizing import SizingInputs, SizingRejection, SizingResult, compute_position_size
from .state import (
    BotState,
    LockKind,
    PeriodBaseline,
    RiskStore,
    utc_day_start,
    utc_week_start,
)

logger = logging.getLogger(__name__)

# Relative tolerance for float round-trip noise on the final order amount.
# 1e-9 is ~1e7 float ulps and ~1e-5 of the smallest exchange amount step.
FLOAT_NOISE_TOLERANCE = dec("0.000000001")


@dataclass
class EntryDecision:
    allowed: bool
    amount_base: Decimal = ZERO
    reason: str = ""
    code: str = ""
    intent_id: str = ""
    sizing: SizingResult | None = None
    checks: dict[str, str] = field(default_factory=dict)

    @property
    def refused(self) -> bool:
        return not self.allowed


def _refuse(code: str, reason: str, checks: dict[str, str]) -> EntryDecision:
    return EntryDecision(allowed=False, code=code, reason=reason, checks=dict(checks))


@dataclass(frozen=True)
class GateContext:
    """Everything the gate needs that it cannot compute itself."""

    now: datetime
    equity: EquitySnapshot
    open_positions: int
    open_position_risk_quote: Decimal
    pair_notional_quote: Decimal
    data_is_tradable: bool
    liquidity_ok: bool
    liquidity_detail: str = ""


class EntryGate:
    def __init__(self, store: RiskStore, policy):
        self.store = store
        self.policy = policy

    # -- period bookkeeping ------------------------------------------------

    def _baselines(self, ctx: GateContext) -> tuple[PeriodBaseline, PeriodBaseline]:
        day_start = utc_day_start(ctx.now)
        week_start = utc_week_start(ctx.now)
        day = self.store.get_period("day", day_start) or self.store.open_period(
            "day", day_start, ctx.equity.total, ctx.now
        )
        week = self.store.get_period("week", week_start) or self.store.open_period(
            "week", week_start, ctx.equity.total, ctx.now
        )
        return day, week

    def observe(self, ctx: GateContext) -> list[str]:
        """Run the period/drawdown bookkeeping WITHOUT an entry signal.

        The strategy calls this from ``bot_loop_start`` on every loop. It is
        what opens the day's and week's baseline at the first loop after
        00:00 UTC (not at the first entry attempt hours later, with equity
        already reduced), records the equity peak between signals, and raises
        a lock the moment an OPEN position breaches a limit.
        """
        return self.evaluate_locks(ctx)

    def evaluate_locks(self, ctx: GateContext) -> list[str]:
        """Apply period and drawdown limits, creating locks where breached.

        Reached on every loop through ``observe`` and again inside each
        entry evaluation, so that a limit breached by an OPEN position is
        caught without waiting for a close or for the next signal.
        """
        messages: list[str] = []
        risk = self.policy.risk
        day, week = self._baselines(ctx)

        for baseline, limit_key, kind in (
            (day, "daily_loss_limit", LockKind.DAILY_LOSS),
            (week, "weekly_loss_limit", LockKind.WEEKLY_LOSS),
        ):
            loss = period_loss_fraction(
                starting_equity=baseline.starting_equity,
                net_external_flow=baseline.net_external_flow,
                current_equity=ctx.equity.total,
            )
            limit = risk[limit_key]
            if loss >= limit:
                already = [
                    lock
                    for lock in self.store.active_locks(ctx.now)
                    if lock.kind is kind
                    and lock.metadata.get("period_start") == baseline.period_start.isoformat()
                ]
                if not already:
                    self.store.add_lock(
                        kind,
                        f"{kind.value} breached: loss {loss:.4f} >= limit {limit}",
                        ctx.now,
                        # The lock ends when the PERIOD ends, not when equity
                        # recovers. A bounce inside the same day does not buy
                        # back the day's allowance.
                        expires_at=baseline.period_start
                        + (timedelta(days=1) if kind is LockKind.DAILY_LOSS else timedelta(days=7)),
                        metadata={
                            "period_start": baseline.period_start.isoformat(),
                            "loss": str(loss),
                            "limit": str(limit),
                        },
                    )
                messages.append(f"{kind.value}: loss {loss:.4f} >= {limit}")

        peak = self.store.update_peak_equity(ctx.equity.total, ctx.now)
        drawdown = drawdown_from_peak(peak_equity=peak, current_equity=ctx.equity.total)
        if drawdown >= risk["max_drawdown_from_peak"]:
            if not any(
                lock.kind is LockKind.MAX_DRAWDOWN for lock in self.store.active_locks(ctx.now)
            ):
                self.store.add_lock(
                    LockKind.MAX_DRAWDOWN,
                    f"drawdown {drawdown:.4f} >= {risk['max_drawdown_from_peak']}; "
                    "operator review required",
                    ctx.now,
                    expires_at=None,  # never clears on its own
                    metadata={"peak": str(peak), "drawdown": str(drawdown)},
                )
            messages.append(f"MAX_DRAWDOWN: {drawdown:.4f}")

        if self.store.consecutive_stops() >= risk["consecutive_stop_count"]:
            hours = int(risk["consecutive_stop_cooldown_hours"])
            if not any(
                lock.kind is LockKind.CONSECUTIVE_STOPS
                for lock in self.store.active_locks(ctx.now)
            ):
                self.store.add_lock(
                    LockKind.CONSECUTIVE_STOPS,
                    f"{self.store.consecutive_stops()} consecutive stops",
                    ctx.now,
                    expires_at=ctx.now + timedelta(hours=hours),
                )
                # The lock IS the consequence of those stops. The count
                # restarts here so that, once the lock has run its course,
                # trading resumes on a fresh count. Without this the same
                # three stops re-created the 24h lock every time it expired
                # and the bot never entered again (audit finding).
                self.store.reset_stop_counter(ctx.now)
            messages.append("CONSECUTIVE_STOPS")

        return messages

    # -- the decision ------------------------------------------------------

    def _log_decision(self, pair: str, intent_id: str, now, decision: EntryDecision) -> None:
        try:
            self.store.record_entry_decision(
                now=now,
                pair=pair,
                intent_id=intent_id,
                allowed=decision.allowed,
                code=decision.code,
                reason=decision.reason,
                amount_base=decision.amount_base,
                binding_cap=(
                    decision.sizing.binding_cap if decision.sizing is not None else ""
                ),
            )
        except Exception:  # noqa: BLE001
            # Reporting must never be able to block a trading decision.
            logger.warning("could not record the entry decision", exc_info=True)

    def evaluate_entry(
        self,
        *,
        pair: str,
        intent_id: str,
        entry_price: Decimal,
        stop_price: Decimal,
        amount_step: Decimal,
        min_order_amount: Decimal,
        min_order_cost: Decimal,
        ctx: GateContext,
        liquidity_cap_base: Decimal | None = None,
    ) -> EntryDecision:
        decision = self._evaluate_entry(
            pair=pair,
            intent_id=intent_id,
            entry_price=entry_price,
            stop_price=stop_price,
            amount_step=amount_step,
            min_order_amount=min_order_amount,
            min_order_cost=min_order_cost,
            ctx=ctx,
            liquidity_cap_base=liquidity_cap_base,
        )
        self._log_decision(pair, intent_id, ctx.now, decision)
        return decision

    def _evaluate_entry(
        self,
        *,
        pair: str,
        intent_id: str,
        entry_price: Decimal,
        stop_price: Decimal,
        amount_step: Decimal,
        min_order_amount: Decimal,
        min_order_cost: Decimal,
        ctx: GateContext,
        liquidity_cap_base: Decimal | None = None,
    ) -> EntryDecision:
        checks: dict[str, str] = {}
        risk = self.policy.risk
        costs = self.policy.costs

        # 1. operating state
        state = self.store.get_state()
        checks["bot_state"] = state.value
        if not state.entries_allowed:
            return _refuse(
                "STATE_BLOCKS_ENTRY",
                f"bot state is {state.value}; entries are only taken in {BotState.READY.value}",
                checks,
            )

        # 2. data and liquidity gates
        if not ctx.data_is_tradable:
            return _refuse("DATA_NOT_TRADABLE", "data quality gate failed for this pair", checks)
        if self.policy.entry_gates["require_liquidity_data"] and not ctx.liquidity_ok:
            return _refuse(
                "LIQUIDITY_GATE",
                f"liquidity gate failed: {ctx.liquidity_detail or 'no book data'}",
                checks,
            )

        # 3. equity must be fresh and positive
        if not ctx.equity.is_usable:
            return _refuse(
                "EQUITY_UNUSABLE",
                f"equity is not usable (total={ctx.equity.total}, "
                f"stale prices={ctx.equity.stale_prices})",
                checks,
            )

        # 4. locks, including any raised by this very evaluation
        breaches = self.evaluate_locks(ctx)
        locks = self.store.active_locks(ctx.now, pair=pair)
        checks["active_locks"] = ",".join(lock.kind.value for lock in locks) or "none"
        if locks:
            return _refuse(
                "RISK_LOCKED",
                "entry locked by: "
                + "; ".join(f"{lock.kind.value} ({lock.reason})" for lock in locks),
                checks,
            )
        if breaches:
            return _refuse("RISK_LOCKED", "; ".join(breaches), checks)

        # 5. budgets, after subtracting what is already committed
        equity = ctx.equity.total
        total_risk_budget = mul(equity, risk["max_total_open_risk"])
        # Budget left once OPEN positions are accounted for. Reservations are
        # deliberately NOT subtracted here: try_reserve re-reads them inside
        # its own transaction, and subtracting them twice would shrink the
        # budget by every pending order a second time.
        risk_budget_for_reservations = total_risk_budget - ctx.open_position_risk_quote
        committed_risk = ctx.open_position_risk_quote + self.store.reserved_risk()
        risk_budget_remaining = total_risk_budget - committed_risk
        checks["risk_budget_remaining"] = str(risk_budget_remaining)
        if risk_budget_remaining <= ZERO:
            return _refuse(
                "NO_RISK_BUDGET",
                f"portfolio risk budget spent: committed {committed_risk} of {total_risk_budget}",
                checks,
            )

        asset_cap = (
            mul(equity, risk["max_asset_notional_fraction"])
            - ctx.pair_notional_quote
            - self.store.reserved_notional(pair)
        )
        portfolio_cap = (
            mul(equity, risk["max_portfolio_notional_fraction"])
            - ctx.equity.holdings_value
            - self.store.reserved_notional()
        )
        # Same reasoning as the risk budget: the reservation transaction
        # subtracts pending notional itself.
        notional_budget_for_reservations = (
            mul(equity, risk["max_portfolio_notional_fraction"]) - ctx.equity.holdings_value
        )
        asset_cap = asset_cap if asset_cap > ZERO else ZERO
        portfolio_cap = portfolio_cap if portfolio_cap > ZERO else ZERO
        notional_budget_for_reservations = (
            notional_budget_for_reservations
            if notional_budget_for_reservations > ZERO
            else ZERO
        )

        # 6. size it
        sizing = compute_position_size(
            SizingInputs(
                equity=equity,
                risk_per_trade=risk["risk_per_trade"],
                entry_price=entry_price,
                stop_price=stop_price,
                exit_slippage=costs["exit_slippage_assumption"],
                entry_fee=costs["entry_fee"],
                exit_fee=costs["exit_fee"],
                free_quote=ctx.equity.free_quote,
                asset_notional_cap=asset_cap,
                portfolio_notional_cap=portfolio_cap,
                remaining_risk_budget=risk_budget_remaining,
                amount_step=amount_step,
                min_order_amount=min_order_amount,
                min_order_cost=min_order_cost,
                liquidity_cap_base=liquidity_cap_base,
                fee_reserve=mul(equity, risk["fee_reserve_fraction"]),
            )
        )
        checks["binding_cap"] = sizing.binding_cap

        if not sizing.accepted:
            code = sizing.rejection.value if sizing.rejection else "SIZING_REFUSED"
            return EntryDecision(
                allowed=False, code=code, reason=sizing.detail, sizing=sizing, checks=checks
            )

        # 7. take the budget atomically, last
        reserved, message = self.store.try_reserve(
            intent_id=intent_id,
            pair=pair,
            amount_base=sizing.amount,
            risk_quote=sizing.modelled_risk_quote,
            notional_quote=sizing.notional,
            risk_budget_remaining=risk_budget_for_reservations,
            notional_budget_remaining=notional_budget_for_reservations,
            max_concurrent=risk["max_open_positions"],
            existing_positions=ctx.open_positions,
            now=ctx.now,
        )
        if not reserved:
            return EntryDecision(
                allowed=False, code="RESERVATION_REFUSED", reason=message,
                sizing=sizing, checks=checks,
            )

        return EntryDecision(
            allowed=True,
            amount_base=sizing.amount,
            intent_id=intent_id,
            reason=f"sized by {sizing.binding_cap}",
            code="ACCEPTED",
            sizing=sizing,
            checks=checks,
        )

    # -- the second gate ---------------------------------------------------

    def confirm_final_order(
        self,
        *,
        intent_id: str,
        final_amount: Decimal,
        final_price: Decimal,
        ctx: GateContext,
    ) -> tuple[bool, str]:
        """Re-validate the order the framework is ACTUALLY about to place.

        This exists because freqtrade's ``validate_stake_amount`` may enlarge a
        stake by up to 30% to reach an exchange minimum, and
        ``custom_stake_amount`` falls back to the proposed stake if our risk
        code raises. Both are fail-open. Re-checking final price x amount here
        is what turns them back into fail-closed.
        """
        reservation = self.store.get_reservation(intent_id)
        if reservation is None:
            return False, f"no reservation for intent {intent_id}; refusing to place an order"

        # freqtrade recomputes amount = float(stake) / rate, which lands one
        # float ulp above the reserved Decimal about one time in six. That is
        # rounding noise, not an enlargement; refusing it produced spurious
        # 'framework enlarged the order' vetoes (audit finding). Anything a
        # real exchange step or the +30% minimum bump could produce is many
        # orders of magnitude above this tolerance.
        if final_amount > mul(reservation.amount_base, dec(1) + FLOAT_NOISE_TOLERANCE):
            return False, (
                f"final amount {final_amount} exceeds the reserved amount "
                f"{reservation.amount_base}: the framework enlarged the order. Refusing."
            )

        final_notional = mul(final_amount, final_price)
        if final_notional > reservation.notional_quote * dec("1.005"):
            return False, (
                f"final notional {final_notional} exceeds reserved notional "
                f"{reservation.notional_quote} beyond the 0.5% price tolerance. Refusing."
            )

        if final_amount <= ZERO:
            return False, "final amount is zero or negative"

        equity = ctx.equity.total
        total_risk_budget = mul(equity, self.policy.risk["max_total_open_risk"])
        if reservation.risk_quote + ctx.open_position_risk_quote > total_risk_budget:
            return False, (
                "portfolio risk budget would be exceeded once this order is counted"
            )

        return True, "final order is within the reserved budget"
