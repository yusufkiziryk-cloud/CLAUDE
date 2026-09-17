"""Baseline 4h long-only spot trend-following strategy.

THIS IS A TEST HYPOTHESIS, NOT A PROFITABLE STRATEGY. No claim is made that
these parameters make money. Faz 4 decides between REJECTED,
INSUFFICIENT_EVIDENCE and CANDIDATE_FOR_OBSERVATION on the evidence.

Responsibility split (deliberate, per the architecture rules):

  signal generation  -> this file's populate_* methods, and nothing else
  risk approval      -> src/kripto/risk/gate.py, which can VETO a signal
  order execution    -> freqtrade

The risk layer can refuse any entry the signal layer proposes. The signal
layer cannot change a single risk limit.

Two freqtrade behaviours this strategy defends against, both verified
against the pinned 2026.8 build:

1. ``custom_stake_amount`` is called through ``strategy_safe_wrapper`` with
   ``default_retval=stake_amount``. If our risk code raises, freqtrade
   silently trades the PROPOSED stake instead. So this file never lets an
   exception escape that callback - it converts every failure into 0.
2. ``Wallets.validate_stake_amount`` will enlarge a stake by up to 30% to
   reach an exchange minimum. So ``confirm_trade_entry`` re-validates the
   FINAL amount x price against the reservation before anything is sent.
"""

from __future__ import annotations

import logging
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import talib.abstract as ta
from pandas import DataFrame

from freqtrade.exceptions import OperationalException
from freqtrade.persistence import Trade
from freqtrade.strategy import IStrategy, stoploss_from_absolute

# The risk package lives outside user_data/, so make it importable when
# freqtrade loads this file directly.
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT / "src") not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT / "src"))

from kripto.money import ZERO, dec, to_float  # noqa: E402
from kripto.policy import load_policy  # noqa: E402
from kripto.risk.equity import AssetHolding, compute_equity  # noqa: E402
from kripto.ops.health import (  # noqa: E402
    EXCHANGE_TIME,
    LAST_CANDLE_OPEN,
    LAST_ORDERBOOK_UPDATE,
    LAST_RECONCILE,
    HealthRecorder,
    read_signal,
)
from kripto.orders.lifecycle import OrderLedger  # noqa: E402
from kripto.ops.watchdog import Action, Level, Watchdog  # noqa: E402
from kripto.risk.gate import EntryGate, GateContext  # noqa: E402
from kripto.risk.state import BotState, RiskStore  # noqa: E402

logger = logging.getLogger(__name__)

POLICY_PATH = _REPO_ROOT / "config" / "policy.yaml"

# Backtest, dry-run and any future live run keep SEPARATE state files. Sharing
# one would let a lock raised in a backtest silently block a dry run, and would
# make a backtest's results depend on whatever the last run left behind.
RISK_DB_BY_RUNMODE = {
    "backtest": _REPO_ROOT / "user_data" / "backtest" / "risk_state.sqlite",
    "hyperopt": _REPO_ROOT / "user_data" / "backtest" / "risk_state.sqlite",
    "util_no_exchange": _REPO_ROOT / "user_data" / "backtest" / "risk_state.sqlite",
    "util_exchange": _REPO_ROOT / "user_data" / "backtest" / "risk_state.sqlite",
    "dry_run": _REPO_ROOT / "user_data" / "dryrun" / "risk_state.sqlite",
    "live": _REPO_ROOT / "user_data" / "live" / "risk_state.sqlite",
}
# Run modes with no exchange to reconcile against. Listed EXPLICITLY rather
# than derived as "not live", so that an unrecognised future run mode falls
# through to RECONCILING (fail closed) instead of silently starting READY.
# lookahead-analysis and recursive-analysis run as util_no_exchange; leaving
# them out made those tools produce zero trades, which freqtrade reports as
# "Test failed" - and a test that generates no trades is not a pass.
SIMULATED_RUNMODES = {
    "backtest",
    "hyperopt",
    "util_no_exchange",
    "util_exchange",
    "plot",
    "other",
}

# Per-trade metadata keys. The initial stop and the ATR that produced it are
# persisted so a restart re-derives exactly the same stop rather than
# recomputing it from whatever the market looks like after the restart.
META_STOP_PRICE = "initial_stop_price"
META_ATR = "entry_atr"
META_INTENT = "intent_id"
META_PLANNED_ENTRY = "planned_max_entry"


class BaselineTrend4h(IStrategy):
    INTERFACE_VERSION = 3

    timeframe = "4h"
    can_short = False

    # Signals are evaluated once per closed candle. freqtrade drops the
    # forming candle for this exchange (ohlcv_partial_candle defaults to
    # True and Hyperliquid does not override it), so the last dataframe row
    # is the last COMPLETED candle.
    process_only_new_candles = True

    use_exit_signal = True
    exit_profit_only = False
    ignore_roi_if_entry_signal = False

    # ROI is effectively disabled. A reachable ROI table would silently
    # pre-empt both the exit signal and the stop.
    minimal_roi = {"0": 100}

    # Hard backstop only. The real stop is the per-trade ATR stop below.
    # freqtrade documents that a custom stoploss can never be WIDER than
    # this value, so it can only ever cut earlier, never later.
    stoploss = -0.15
    use_custom_stoploss = True

    trailing_stop = False  # off in the baseline; a separate, counted experiment
    position_adjustment_enable = False  # no adding to positions in V1

    startup_candle_count: int = 400

    order_types = {
        "entry": "limit",
        "exit": "limit",
        "emergency_exit": "market",
        "force_entry": "limit",
        "force_exit": "market",
        "stoploss": "market",
        # VERIFIED False for Hyperliquid spot. The stop lives inside the bot,
        # which is recorded as a LIVE_BLOCKER in docs/LIVE_READINESS.md.
        "stoploss_on_exchange": False,
    }

    def __init__(self, config: dict) -> None:
        super().__init__(config)
        self.policy = load_policy(POLICY_PATH)
        self._store: RiskStore | None = None
        self._gate: EntryGate | None = None
        self._writer_lock_owner: str | None = None
        self._health: HealthRecorder | None = None
        self._watchdog: Watchdog | None = None
        self._ledger: OrderLedger | None = None
        params = self.policy.strategy
        self.ema_fast_period = params["ema_fast"]
        self.ema_slow_period = params["ema_slow"]
        self.adx_period = params["adx_period"]
        self.adx_min = to_float(params["adx_min"])
        self.atr_period = params["atr_period"]
        self.atr_stop_multiple = params["atr_stop_multiple"]
        self.startup_candle_count = params["startup_candles"]

    # -- lazily opened so backtests and tests can inject their own store ---

    @property
    def runmode(self) -> str:
        mode = self.config.get("runmode")
        return getattr(mode, "value", str(mode or "dry_run"))

    @property
    def store(self) -> RiskStore:
        if self._store is None:
            path = RISK_DB_BY_RUNMODE.get(
                self.runmode, _REPO_ROOT / "user_data" / "dryrun" / "risk_state.sqlite"
            )
            if self.runmode in SIMULATED_RUNMODES and path.exists():
                # A backtest must be reproducible from a clean slate: stale
                # locks or reservations from a previous run would change the
                # result without changing the inputs.
                path.unlink()
                for suffix in ("-wal", "-shm"):
                    path.with_name(path.name + suffix).unlink(missing_ok=True)
            self._store = RiskStore(path)
        return self._store

    @property
    def gate(self) -> EntryGate:
        if self._gate is None:
            self._gate = EntryGate(self.store, self.policy)
        return self._gate

    @property
    def ledger(self) -> OrderLedger:
        if self._ledger is None:
            self._ledger = OrderLedger(self.store)
        return self._ledger

    @property
    def health(self) -> HealthRecorder:
        if self._health is None:
            self._health = HealthRecorder(self.store)
        return self._health

    @property
    def watchdog(self) -> Watchdog:
        """In-process health checks.

        The same checks also run out-of-process (scripts/watchdog.py) against
        a read-only connection. Two callers, one set of rules: the in-process
        one can pause entries, the external one can tell a human when the bot
        is the thing that broke.
        """
        if self._watchdog is None:
            self._watchdog = Watchdog(self.store.path, self.policy, timeframe=self.timeframe)
        return self._watchdog

    def bot_start(self, **kwargs) -> None:
        """Live and dry runs start reconciling, never ready.

        A process that has just started has not yet agreed with the exchange
        about balances, open orders or positions, so it must not enter.

        A backtest has no exchange to reconcile with, so it starts READY - and
        that difference is recorded, because it means the reconciliation path
        is NOT exercised by backtesting and must be tested separately.
        """
        now = datetime.now(timezone.utc)

        # One bot, one account, one order writer. A second instance pointed at
        # the same state must not start, because both would size positions
        # against a budget the other is also spending.
        if self.runmode not in SIMULATED_RUNMODES:
            owner = f"{self.__class__.__name__}:{self.runmode}"
            acquired, message = self.store.acquire_writer_lock(owner, now)
            if not acquired:
                self.store.set_state(BotState.STOPPED, message, now)
                raise OperationalException(
                    f"REFUSING TO START - {message}\n"
                    "Note that this lock only protects against a second process on THIS "
                    "machine. It cannot stop another host trading the same account; V1 is "
                    "limited to a single host by design (see docs/RUNBOOK.md)."
                )
            self._writer_lock_owner = owner
            logger.info("writer lock: %s", message)

        if self.runmode in SIMULATED_RUNMODES:
            self.store.set_state(
                BotState.READY,
                f"{self.runmode}: no exchange to reconcile with (reconciliation NOT exercised)",
                now,
            )
            logger.info("risk state set to READY for %s", self.runmode)
        else:
            self.store.set_state(
                BotState.RECONCILING,
                "process start; awaiting reconciliation with the exchange",
                now,
            )
            logger.info("risk state set to RECONCILING at startup")

    def bot_loop_start(self, current_time: datetime, **kwargs) -> None:
        """Record health, then act on it.

        Runs before the pairs are processed. Anything that goes wrong here is
        swallowed: a failure in the monitoring layer must never take down the
        loop it is monitoring, and it must never interfere with exits.
        """
        if self.runmode in SIMULATED_RUNMODES:
            return
        try:
            self._record_health(current_time)
            self._maybe_reconcile(current_time)
            report = self.watchdog.run(now=current_time)

            if report.action in (Action.HALT_ENTRIES, Action.OPERATOR_REQUIRED):
                target = (
                    BotState.RECOVERY_REQUIRED
                    if report.action is Action.OPERATOR_REQUIRED
                    else BotState.ENTRY_PAUSED
                )
                reasons = "; ".join(f"{c.name}: {c.message}" for c in report.failures)
                if self.store.get_state() is not target:
                    logger.error("health check -> %s: %s", target.value, reasons)
                    # Entries stop. Exits keep running: every state except
                    # STOPPED manages exits, and the watchdog may never set
                    # STOPPED.
                    self.store.set_state(target, f"watchdog: {reasons}", current_time)
            elif (
                # Recovery keys off the recommended ACTION, not the level. A
                # standing WARN that recommends nothing (say, an unsampled
                # clock) must not hold entries paused indefinitely - that
                # would turn every minor gap in observability into a silent
                # trading halt.
                report.action is Action.NONE
                and self.store.get_state() is BotState.ENTRY_PAUSED
                and not self.store.active_locks(current_time)
            ):
                logger.info("health recovered and no risk locks remain; entries resume")
                self.store.set_state(BotState.READY, "health recovered", current_time)
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "health monitoring failed (%s: %s) - the trading loop continues; "
                "monitoring must never take down what it monitors",
                type(exc).__name__, exc,
            )
        finally:
            # The heartbeat is written LAST, so a hang inside the work above
            # stops the heartbeat instead of faking one.
            try:
                self.health.heartbeat(current_time)
            except Exception:  # noqa: BLE001
                logger.error("could not write the loop heartbeat", exc_info=True)

    def _maybe_reconcile(self, now: datetime) -> None:
        """Agree with the authoritative records before allowing entries.

        A restart begins in RECONCILING and stays there until this succeeds.
        Reconciliation is also re-run once the last one goes stale, so a bot
        that has drifted stops entering rather than carrying on regardless.

        SCOPE, stated rather than implied: in a dry run the authoritative
        record is freqtrade's own simulated trade ledger, because nothing was
        ever sent to the venue. That means this path verifies our bookkeeping
        against the engine's, NOT against an exchange. Venue-side
        reconciliation stays PARTIAL for dry-run in src/kripto/risk/coverage.py
        and is a live-readiness gate, not a solved problem.
        """
        last = read_signal(self.store._conn, LAST_RECONCILE)
        max_age = to_float(self.policy.operations["max_reconcile_age_seconds"])
        state = self.store.get_state()
        due = (
            state is BotState.RECONCILING
            or last is None
            or last.age_seconds(now) > max_age / 2
        )
        if not due:
            return

        ledger = self.ledger
        open_trades = Trade.get_open_trades()
        known_positions = {t.pair for t in open_trades}

        open_orders = []
        for trade in open_trades:
            for order in trade.orders:
                if order.ft_is_open:
                    open_orders.append(
                        {
                            "id": order.order_id,
                            "clientOrderId": getattr(order, "ft_order_tag", "") or "",
                            "filled": float(order.filled or 0),
                            "amount": float(order.amount or 0),
                            "status": order.status,
                        }
                    )

        result = ledger.reconcile(
            open_orders=open_orders,
            recent_fills=[],
            known_positions=known_positions,
            now=now,
            history_complete=True,
        )

        if result.requires_operator:
            logger.error(
                "reconciliation could not be completed: unresolved=%s unrecognised_orders=%s "
                "unrecognised_positions=%s. Unrecognised orders and positions are NEVER "
                "adopted, cancelled or closed automatically.",
                result.unresolved, result.unrecognised_orders, result.unrecognised_positions,
            )
            self.store.set_state(
                BotState.RECOVERY_REQUIRED,
                "reconciliation incomplete; operator review required",
                now,
            )
            return

        self.health.record(LAST_RECONCILE, now, detail=f"{len(open_orders)} open order(s)")
        if state is BotState.RECONCILING:
            logger.info("reconciliation complete; records agree")
            self.store.set_state(BotState.READY, "records agree", now)

    def _record_health(self, now: datetime) -> None:
        """Write the evidence the watchdog reads."""
        for pair in self.dp.current_whitelist():
            dataframe, _ = self.dp.get_analyzed_dataframe(pair, self.timeframe)
            if dataframe is not None and not dataframe.empty:
                self.health.record(
                    LAST_CANDLE_OPEN, now,
                    value=dataframe["date"].iloc[-1].to_pydatetime().isoformat(),
                    detail=pair,
                )
                break

        try:
            book = self.dp.orderbook(self.dp.current_whitelist()[0], 1)
            if book:
                self.health.record(LAST_ORDERBOOK_UPDATE, now)
                self.health.record_api_call(now, ok=True, endpoint="orderbook")
        except Exception as exc:  # noqa: BLE001
            self.health.record_api_call(now, ok=False, endpoint="orderbook")
            logger.debug("order book sample failed: %s", exc)

        self._sample_exchange_time(now)

        self.health.prune_api_calls(
            now, to_float(self.policy.operations["api_error_window_seconds"]) * 4
        )

    _last_time_sample: datetime | None = None

    def _sample_exchange_time(self, now: datetime) -> None:
        """Measure clock skew against the venue, occasionally.

        Public read, no credentials. Sampled on an interval rather than every
        loop: skew drifts slowly, and a per-loop call would spend rate limit
        on a number that barely moves.
        """
        interval = to_float(self.policy.operations["max_reconcile_age_seconds"]) / 2
        if (
            self._last_time_sample is not None
            and (now - self._last_time_sample).total_seconds() < interval
        ):
            return
        try:
            api = self.dp._exchange._api
            if not api.has.get("fetchTime"):
                return
            millis = api.fetch_time()
            self.health.record(
                EXCHANGE_TIME,
                now,
                value=datetime.fromtimestamp(millis / 1000, tz=timezone.utc).isoformat(),
            )
            self.health.record_api_call(now, ok=True, endpoint="fetch_time")
            self._last_time_sample = now
        except Exception as exc:  # noqa: BLE001
            self.health.record_api_call(now, ok=False, endpoint="fetch_time")
            logger.debug("could not sample exchange time: %s", exc)

    # ------------------------------------------------------------------
    # Signals
    # ------------------------------------------------------------------

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """All indicators are causal.

        Every value on row i is a function of rows <= i only. No shift(-1),
        no centered windows, no normalisation over the whole series - each of
        those would let information from the future reach a past decision.
        """
        dataframe["ema_fast"] = ta.EMA(dataframe, timeperiod=self.ema_fast_period)
        dataframe["ema_slow"] = ta.EMA(dataframe, timeperiod=self.ema_slow_period)
        dataframe["adx"] = ta.ADX(dataframe, timeperiod=self.adx_period)
        dataframe["atr"] = ta.ATR(dataframe, timeperiod=self.atr_period)

        # Eligibility: the regime we are willing to trade in at all.
        dataframe["eligible"] = (
            (dataframe["close"] > dataframe["ema_slow"])
            & (dataframe["ema_fast"] > dataframe["ema_slow"])
            & (dataframe["adx"] >= self.adx_min)
            & (dataframe["volume"] > 0)
            & dataframe["atr"].notna()
            & (dataframe["atr"] > 0)
            & dataframe["ema_slow"].notna()
        )
        return dataframe

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """Enter on the TRANSITION into eligibility, not on its persistence.

        Without the transition test, every candle in a long uptrend would
        re-signal, and the bot would keep proposing entries for as long as
        the trend lasted.
        """
        # shift(1, fill_value=False).astype(bool) is load-bearing.
        # `.shift(1).fillna(False)` returns an OBJECT-dtype series, and `~` on
        # object dtype does integer bitwise NOT (True -> -2, False -> -1).
        # Both are truthy, so the transition filter silently became a no-op
        # and every eligible candle re-signalled.
        previously_eligible = dataframe["eligible"].shift(1, fill_value=False).astype(bool)
        became_eligible = dataframe["eligible"].astype(bool) & ~previously_eligible

        dataframe.loc[became_eligible, "enter_long"] = 1
        dataframe.loc[became_eligible, "enter_tag"] = "trend_start"
        return dataframe

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        """Normal exit: a completed candle closes below the fast EMA."""
        dataframe.loc[
            (dataframe["close"] < dataframe["ema_fast"]) & (dataframe["volume"] > 0),
            ["exit_long", "exit_tag"],
        ] = (1, "trend_end")
        return dataframe

    # ------------------------------------------------------------------
    # Risk approval
    # ------------------------------------------------------------------

    def _build_intent_id(self, pair: str, candle_time: datetime) -> str:
        """Locally unique, deterministic intent identity.

        Deterministic on purpose: if the same signal is processed twice
        (a restart, a duplicated event), the reservation store recognises
        the repeat and refuses to double-book it.
        """
        stamp = candle_time.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        return f"{pair.replace('/', '_')}|long|{self.timeframe}|{stamp}|v1"

    def _current_atr_and_stop(self, pair: str, entry_price: Decimal) -> tuple[Decimal, Decimal]:
        """ATR from the last CLOSED candle, and the absolute stop it implies."""
        dataframe, _ = self.dp.get_analyzed_dataframe(pair, self.timeframe)
        if dataframe is None or dataframe.empty:
            raise ValueError(f"no analyzed dataframe for {pair}")
        atr_raw = dataframe["atr"].iloc[-1]
        atr = dec(float(atr_raw))
        if atr <= ZERO:
            raise ValueError(f"ATR for {pair} is {atr}; refusing to derive a stop from it")

        stop = entry_price - (self.atr_stop_multiple * atr)
        if stop <= ZERO or stop >= entry_price:
            raise ValueError(
                f"derived stop {stop} is not strictly between 0 and entry {entry_price}"
            )
        return atr, stop

    def _gate_context(self, pair: str, now: datetime) -> GateContext:
        """Assemble equity and exposure from freqtrade's authoritative state."""
        total_stake = self.wallets.get_total_stake_amount()
        free = dec(self.wallets.get_available_stake_amount())

        open_trades = Trade.get_open_trades()
        open_risk = ZERO
        pair_notional = ZERO
        holdings: list[AssetHolding] = []
        for trade in open_trades:
            stop_price = trade.get_custom_data(META_STOP_PRICE)
            rate = dec(trade.open_rate)
            amount = dec(trade.amount)
            if stop_price is not None:
                open_risk += amount * (rate - dec(str(stop_price)))
            else:
                # No recorded stop means we cannot bound this position's loss;
                # treat its whole notional as at risk rather than guessing.
                open_risk += amount * rate
            if trade.pair == pair:
                pair_notional += amount * rate
            holdings.append(
                AssetHolding(
                    asset=trade.pair.split("/")[0],
                    amount=amount,
                    price_quote=rate,
                    price_age_seconds=0.0,
                )
            )

        equity = compute_equity(
            free_quote=free,
            locked_quote=ZERO,
            holdings=holdings,
            max_price_age_seconds=to_float(self.policy.entry_gates["max_data_age_seconds"]),
        )
        # freqtrade already knows the portfolio total; prefer its number so
        # the two accountings cannot drift apart.
        from dataclasses import replace

        equity = replace(equity, total=dec(total_stake))

        return GateContext(
            now=now,
            equity=equity,
            open_positions=len(open_trades),
            open_position_risk_quote=open_risk if open_risk > ZERO else ZERO,
            pair_notional_quote=pair_notional,
            data_is_tradable=True,
            liquidity_ok=True,
            liquidity_detail="dry-run: book checks are recorded, not enforced",
        )

    def custom_stake_amount(
        self,
        pair: str,
        current_time: datetime,
        current_rate: float,
        proposed_stake: float,
        min_stake: float | None,
        max_stake: float,
        leverage: float,
        entry_tag: str | None,
        side: str,
        **kwargs,
    ) -> float:
        """Size the entry, or return 0.

        NOTHING may raise out of this method. freqtrade catches exceptions
        here and falls back to ``proposed_stake``, which would place a trade
        our risk calculation never approved. So every failure path returns 0,
        which freqtrade treats as "do not trade".
        """
        try:
            entry_price = dec(current_rate)
            atr, stop_price = self._current_atr_and_stop(pair, entry_price)
            intent_id = self._build_intent_id(pair, current_time)

            market = self._market_limits(pair)
            decision = self.gate.evaluate_entry(
                pair=pair,
                intent_id=intent_id,
                entry_price=entry_price,
                stop_price=stop_price,
                amount_step=market["amount_step"],
                min_order_amount=market["min_amount"],
                min_order_cost=market["min_cost"],
                ctx=self._gate_context(pair, current_time),
            )

            if not decision.allowed:
                logger.info(
                    "entry refused for %s: [%s] %s", pair, decision.code, decision.reason
                )
                return 0.0

            # Remember what we approved so confirm_trade_entry can check that
            # freqtrade did not change it.
            self._pending[intent_id] = {
                "pair": pair,
                "amount": decision.amount_base,
                "stop_price": stop_price,
                "atr": atr,
                "entry_price": entry_price,
            }
            stake = decision.amount_base * entry_price
            logger.info(
                "entry approved for %s: amount=%s stake=%s stop=%s (capped by %s)",
                pair, decision.amount_base, stake, stop_price, decision.sizing.binding_cap,
            )
            return to_float(stake)

        except Exception as exc:  # noqa: BLE001 - deliberate catch-all
            logger.error(
                "risk sizing failed for %s: %s: %s - refusing the entry (returning 0) "
                "rather than letting freqtrade fall back to proposed_stake %s",
                pair, type(exc).__name__, exc, proposed_stake,
            )
            return 0.0

    _pending: dict[str, dict] = {}

    def _market_limits(self, pair: str) -> dict[str, Decimal]:
        """Exchange precision and minimums, read from freqtrade's markets."""
        market = self.dp._exchange.markets.get(pair, {}) if self.dp else {}
        limits = market.get("limits", {})
        precision = market.get("precision", {})
        amount_step = precision.get("amount")
        return {
            "amount_step": dec(str(amount_step)) if amount_step else dec("0.00000001"),
            "min_amount": dec(str(limits.get("amount", {}).get("min") or 0)),
            "min_cost": dec(str(limits.get("cost", {}).get("min") or 0)),
        }

    def confirm_trade_entry(
        self,
        pair: str,
        order_type: str,
        amount: float,
        rate: float,
        time_in_force: str,
        current_time: datetime,
        entry_tag: str | None,
        side: str,
        **kwargs,
    ) -> bool:
        """The second risk gate: check what is ACTUALLY about to be sent.

        Between custom_stake_amount and here, freqtrade converts a stake into
        an amount, applies exchange precision, and may enlarge the order by up
        to 30% to satisfy a minimum. This is the last point at which we can
        still refuse.
        """
        try:
            intent_id = self._build_intent_id(pair, current_time)
            pending = self._pending.get(intent_id)
            if pending is None:
                # Look it up by the reservation instead; the candle stamp can
                # differ if the entry spans a candle boundary.
                reservation = None
                for reservation in self.store.open_reservations():
                    if reservation.pair == pair:
                        intent_id = reservation.intent_id
                        break
                if reservation is None:
                    logger.error(
                        "no risk reservation found for %s; refusing entry", pair
                    )
                    return False

            ok, message = self.gate.confirm_final_order(
                intent_id=intent_id,
                final_amount=dec(amount),
                final_price=dec(rate),
                ctx=self._gate_context(pair, current_time),
            )
            if not ok:
                logger.error("FINAL ENTRY GATE REFUSED %s: %s", pair, message)
                self.store.release(intent_id, f"final gate refused: {message}", current_time)
                return False

            if pending:
                # Persist the stop BEFORE the order goes out, so a crash
                # between send and fill still leaves a recoverable stop.
                self._stop_for_intent[intent_id] = pending
            logger.info("final entry gate passed for %s: %s", pair, message)
            return True

        except Exception as exc:  # noqa: BLE001
            logger.error(
                "final entry gate errored for %s (%s: %s); refusing", pair, type(exc).__name__, exc
            )
            return False

    _stop_for_intent: dict[str, dict] = {}

    def order_filled(
        self, pair: str, trade: Trade, order, current_time: datetime, **kwargs
    ) -> None:
        """Attach the approved stop to the trade once it exists."""
        try:
            if trade.get_custom_data(META_STOP_PRICE) is not None:
                return
            intent_id = self._build_intent_id(pair, trade.open_date_utc or current_time)
            pending = self._stop_for_intent.get(intent_id) or self._pending.get(intent_id)
            if pending is None:
                for key, value in self._stop_for_intent.items():
                    if value["pair"] == pair:
                        intent_id, pending = key, value
                        break
            if pending is None:
                logger.error(
                    "no approved stop for %s; the position is unprotected and the risk "
                    "layer will treat its whole notional as at risk",
                    pair,
                )
                return
            trade.set_custom_data(META_STOP_PRICE, str(pending["stop_price"]))
            trade.set_custom_data(META_ATR, str(pending["atr"]))
            trade.set_custom_data(META_INTENT, intent_id)
            trade.set_custom_data(META_PLANNED_ENTRY, str(pending["entry_price"]))
            self.store.record_partial_fill(intent_id, dec(trade.amount), current_time)
        except Exception as exc:  # noqa: BLE001
            logger.error("order_filled bookkeeping failed for %s: %s", pair, exc)

    # ------------------------------------------------------------------
    # Stop management
    # ------------------------------------------------------------------

    def custom_stoploss(
        self,
        pair: str,
        trade: Trade,
        current_time: datetime,
        current_rate: float,
        current_profit: float,
        after_fill: bool,
        **kwargs,
    ) -> float | None:
        """Convert the stored ABSOLUTE stop price into freqtrade's ratio.

        The stop price is fixed at entry and never moved in the direction
        that would increase the loss. Trailing is off in the baseline, so it
        is never moved at all.
        """
        stored = trade.get_custom_data(META_STOP_PRICE)
        if stored is None:
            # No recorded stop: fall back to the hard backstop rather than
            # inventing one from the current price, which would silently
            # re-anchor the risk to wherever the market has moved to.
            logger.error(
                "trade %s has no recorded stop price; falling back to the hard stoploss",
                trade.pair,
            )
            return None

        stop_price = float(stored)
        if current_rate <= 0:
            return None

        # stoploss_from_absolute returns a POSITIVE distance; custom_stoploss
        # expects a negative ratio.
        distance = stoploss_from_absolute(
            stop_rate=stop_price, current_rate=current_rate, is_short=False, leverage=1.0
        )
        if distance <= 0:
            # Price is already at or below the stop. Return the tightest
            # possible value so the exit triggers now.
            return -0.0001
        return -distance

    def confirm_trade_exit(
        self,
        pair: str,
        trade: Trade,
        order_type: str,
        amount: float,
        rate: float,
        time_in_force: str,
        exit_reason: str,
        current_time: datetime,
        **kwargs,
    ) -> bool:
        """Never veto an exit.

        freqtrade's own documentation warns that confirm_trade_exit "can
        prevent stoploss exits, causing significant losses". Entry-side
        filters (spread, trend, minimum profit, daily loss) must never be
        applied here: they are reasons not to OPEN risk, never reasons to
        keep it.
        """
        logger.info(
            "exit confirmed for %s (reason=%s, rate=%s) - exits are never vetoed",
            pair, exit_reason, rate,
        )
        return True
