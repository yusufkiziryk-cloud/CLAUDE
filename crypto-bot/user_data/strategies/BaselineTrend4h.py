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

import atexit
import logging
import os
import socket
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import talib.abstract as ta
from pandas import DataFrame

from freqtrade.exceptions import OperationalException
from freqtrade.exchange import timeframe_to_minutes
from freqtrade.persistence import Trade
from freqtrade.strategy import IStrategy, stoploss_from_absolute

# The risk package lives outside user_data/, so make it importable when
# freqtrade loads this file directly.
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT / "src") not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT / "src"))

from kripto.data.quality import check_candles  # noqa: E402
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
from kripto.ops.watchdog import (  # noqa: E402
    Action,
    Level,
    Watchdog,
    expected_last_completed_open,
)
from kripto.risk.gate import EntryGate, GateContext  # noqa: E402
from kripto.risk.state import BotState, LockKind, ReservationState, RiskStore  # noqa: E402

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

# Exit reasons that count as a stop for the consecutive-stop lock. Anything
# else (signal exit, ROI, force exit) resets the counter.
STOP_EXIT_REASONS = frozenset(
    {"stop_loss", "trailing_stop_loss", "liquidation", "emergency_exit", "stoploss_on_exchange"}
)


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
        self._mark_cache: dict[str, tuple[Decimal, float, datetime]] = {}
        self._loops_completed = 0
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
            # The owner is unique per PROCESS. A class-name-only owner made
            # every dry-run instance "the same owner", so a second instance
            # renewed the lease instead of being refused (audit finding).
            owner = (
                f"{self.__class__.__name__}:{self.runmode}:{socket.gethostname()}:{os.getpid()}"
            )
            acquired, message = self.store.acquire_writer_lock(owner, now)
            if not acquired:
                # The shared state belongs to the instance that holds the
                # lock. Writing STOPPED into it here would halt THAT bot's
                # entries; this process simply refuses to start.
                raise OperationalException(
                    f"REFUSING TO START - {message}\n"
                    "Note that this lock only protects against a second process on THIS "
                    "machine. It cannot stop another host trading the same account; V1 is "
                    "limited to a single host by design (see docs/RUNBOOK.md)."
                )
            self._writer_lock_owner = owner
            atexit.register(self._release_writer_lock)
            logger.info("writer lock: %s (owner %s)", message, owner)

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
            # No health, no watchdog, no reconciliation in a simulation - but
            # the limits ARE observed every candle. Sampling equity only at
            # entry attempts let a backtest miss a 10.97% mark-to-market
            # drawdown that the live bot would have locked on, so the
            # backtest was modelling a laxer policy than the one that runs.
            self._guarded("limits", self._observe_limits, current_time)
            return
        try:
            # Each step is guarded on its own: a failure in one must not skip
            # the watchdog, and none of them may take down the loop.
            self._guarded("health", self._record_health, current_time)
            self._guarded("writer lock", self._renew_writer_lock, current_time)
            self._guarded("reservation sweep", self._sweep_reservations, current_time)
            self._guarded("reconcile", self._maybe_reconcile, current_time)
            self._guarded("limits", self._observe_limits, current_time)
            report = self.watchdog.run(now=current_time)
            if self._loops_completed == 0:
                # First loop of THIS process. The heartbeat on disk was written
                # by the previous process, so its age measures how long the
                # bot was down, not whether this loop is stuck. Judging it
                # here sent every restart after >5 minutes of downtime into a
                # permanent RECOVERY_REQUIRED (audit finding). The external
                # watchdog still reports the gap; this process earns its own
                # heartbeat at the end of this loop.
                report.checks = [c for c in report.checks if c.name != "loop_heartbeat"]

            current = self.store.get_state()
            reasons = "; ".join(f"{c.name}: {c.message}" for c in report.failures)
            if report.action is Action.OPERATOR_REQUIRED and current not in (
                BotState.RECOVERY_REQUIRED, BotState.STOPPED
            ):
                logger.error("health check -> RECOVERY_REQUIRED: %s", reasons)
                # Entries stop. Exits keep running: every state except
                # STOPPED manages exits, and the watchdog may never set STOPPED.
                self.store.set_state(
                    BotState.RECOVERY_REQUIRED, f"watchdog: {reasons}", current_time
                )
            elif report.action is Action.HALT_ENTRIES and current is BotState.READY:
                # Monitoring may only PAUSE a ready bot. RECOVERY_REQUIRED,
                # RECONCILING and STOPPED are stronger states owned by
                # reconciliation and the operator; rewriting them as
                # ENTRY_PAUSED let the auto-recovery below promote an
                # unreconciled bot to READY (audit finding).
                logger.error("health check -> ENTRY_PAUSED: %s", reasons)
                self.store.set_state(BotState.ENTRY_PAUSED, f"watchdog: {reasons}", current_time)
            elif (
                # Recovery keys off the recommended ACTION, not the level. A
                # standing WARN that recommends nothing (say, an unsampled
                # clock) must not hold entries paused indefinitely - that
                # would turn every minor gap in observability into a silent
                # trading halt.
                report.action is Action.NONE
                and self.store.get_state() is BotState.ENTRY_PAUSED
                # Portfolio-wide locks hold the state; a per-pair cooldown
                # only ever concerns its own pair and the gate applies it
                # there (audit finding: a BTC cooldown kept ETH/SOL refused).
                and not [
                    lock for lock in self.store.active_locks(current_time) if lock.pair is None
                ]
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
                self._loops_completed += 1
            except Exception:  # noqa: BLE001
                logger.error("could not write the loop heartbeat", exc_info=True)

    def _guarded(self, name: str, fn, now: datetime) -> None:
        try:
            fn(now)
        except Exception as exc:  # noqa: BLE001
            logger.error("%s step failed (%s: %s); the loop continues", name, type(exc).__name__, exc)

    def _release_writer_lock(self) -> None:
        owner = self._writer_lock_owner
        if owner and self._store is not None:
            try:
                self._store.release_writer_lock(owner)
            except Exception:  # noqa: BLE001
                pass

    def _renew_writer_lock(self, now: datetime) -> None:
        """Renew the lease every loop; losing it means a second writer exists."""
        owner = self._writer_lock_owner
        if not owner:
            return
        if self.store.heartbeat_writer_lock(owner, now):
            return
        if self.store.get_state() is not BotState.RECOVERY_REQUIRED:
            logger.critical(
                "writer lock is held by someone else: another instance is writing to the "
                "same state. Entries stop; exits continue; an operator must decide."
            )
            self.store.set_state(
                BotState.RECOVERY_REQUIRED, "writer lock lost to another instance", now
            )

    def _observe_limits(self, now: datetime) -> None:
        """Period baselines, peak equity and open-position breaches, every loop.

        Without this, the day's baseline was whatever equity happened to be
        at the first entry ATTEMPT of the day, and a limit breached by an
        open position went unnoticed until the next signal (audit finding).
        """
        self.gate.observe(self._gate_context(None, now))

    def _entry_timeout(self) -> timedelta:
        settings = self.config.get("unfilledtimeout") or {}
        value = float(settings.get("entry", 30))
        unit = str(settings.get("unit", "minutes"))
        return timedelta(seconds=value) if unit == "seconds" else timedelta(minutes=value)

    def _sweep_reservations(self, now: datetime) -> None:
        """Release reservations freqtrade abandoned without telling us.

        freqtrade has no callback for a cancelled entry (unfilledtimeout), a
        stake it refused after our approval, or a create_order that raised.
        Each of those left a PENDING reservation holding a slot and budget
        for the life of the state file; three of them locked the bot out of
        every further entry (audit finding). A reservation whose pair has no
        open trade once the entry timeout has comfortably passed cannot be
        live, and is released.
        """
        open_pairs = {trade.pair for trade in Trade.get_open_trades()}
        grace = self._entry_timeout() * 1.5 + timedelta(minutes=5)
        for reservation in self.store.open_reservations():
            if reservation.pair in open_pairs:
                continue  # the trade exists (possibly still filling); order_filled owns it
            age = now - reservation.created_at
            if age <= grace:
                continue
            logger.warning(
                "releasing reservation %s: no open trade for %s %.0f minutes after the "
                "entry timeout - freqtrade abandoned this entry without a callback",
                reservation.intent_id, reservation.pair, age.total_seconds() / 60,
            )
            self.store.release(
                reservation.intent_id, "abandoned: no open trade after the entry timeout", now
            )

    @staticmethod
    def _entry_filled_amount(trade: Trade) -> Decimal:
        """What has actually filled. freqtrade sets Trade.amount to the
        REQUESTED amount at order creation, so a resting entry order shows
        the full amount with nothing bought (audit finding)."""
        amount = dec(trade.amount or 0)
        entry_side = getattr(trade, "entry_side", "buy")
        unfilled = sum(
            (
                dec(order.remaining or 0)
                for order in getattr(trade, "open_orders", [])
                if getattr(order, "ft_order_side", entry_side) == entry_side
            ),
            ZERO,
        )
        return amount - unfilled if amount > unfilled else ZERO

    def _attach_approval(self, trade: Trade, pending: dict, now: datetime) -> None:
        """Bind a stored approval to the trade it produced."""
        trade.set_custom_data(META_STOP_PRICE, str(pending["stop_price"]))
        trade.set_custom_data(META_ATR, str(pending["atr"]))
        trade.set_custom_data(META_INTENT, pending["intent_id"])
        trade.set_custom_data(META_PLANNED_ENTRY, str(pending["entry_price"]))
        filled = self._entry_filled_amount(trade)
        if filled > ZERO:
            self.store.record_partial_fill(
                pending["intent_id"], filled, now, complete=not trade.has_open_orders
            )

    def _maybe_reconcile(self, now: datetime) -> None:
        """Agree with the authoritative records before allowing entries.

        A restart begins in RECONCILING and stays there until this succeeds.
        Reconciliation is also re-run once the last one goes stale, so a bot
        that has drifted stops entering rather than carrying on regardless.

        SCOPE, stated rather than implied: in a dry run the authoritative
        record is freqtrade's own simulated trade ledger, because nothing was
        ever sent to the venue. What is checked is that every open freqtrade
        position carries a risk approval (a reservation and a recorded stop).
        A position without one is either the fail-open path (freqtrade traded
        the proposed stake because our sizing raised) or lost bookkeeping;
        both stop entries and call an operator. Venue-side reconciliation
        stays PARTIAL for dry-run in src/kripto/risk/coverage.py and is a
        live-readiness gate, not a solved problem.

        The order ledger (src/kripto/orders/) is only consulted when it has
        records, i.e. when the executor path is in use. In a plain dry run
        freqtrade places the simulated orders itself and the ledger is empty;
        checking freqtrade's positions against an empty ledger flagged the
        bot's own first trade as foreign and forced RECOVERY_REQUIRED
        (audit finding).
        """
        last = read_signal(self.health._conn, LAST_RECONCILE)  # health owns that schema
        max_age = to_float(self.policy.operations["max_reconcile_age_seconds"])
        state = self.store.get_state()
        due = (
            state is BotState.RECONCILING
            or last is None
            or last.age_seconds(now) > max_age / 2
        )
        if not due:
            return

        open_trades = Trade.get_open_trades()
        problems: list[str] = []
        for trade in open_trades:
            if trade.get_custom_data(META_INTENT) is not None:
                continue
            pending = self.store.get_pending_entry(trade.pair)
            if pending is not None:
                # The fill callback did not run (restart mid-fill): bind the
                # stored approval now. This is our own approval, not a guess.
                logger.warning(
                    "%s: open position without bound approval; attaching stored approval %s",
                    trade.pair, pending["intent_id"],
                )
                self._attach_approval(trade, pending, now)
                continue
            problems.append(
                f"{trade.pair}: open position (amount {trade.amount}) with NO risk approval "
                "record - not adopted; the risk layer counts its whole notional as at risk"
            )

        if self.ledger.all_orders():
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
            result = self.ledger.reconcile(
                open_orders=open_orders,
                recent_fills=[],
                known_positions=known_positions,
                now=now,
                history_complete=True,
            )
            if result.requires_operator:
                problems.append(
                    f"order ledger: unresolved={result.unresolved} "
                    f"unrecognised_orders={result.unrecognised_orders} "
                    f"unrecognised_positions={result.unrecognised_positions}"
                )

        if problems:
            logger.error(
                "reconciliation could not be completed: %s. Unrecognised orders and "
                "positions are NEVER adopted, cancelled or closed automatically.",
                "; ".join(problems),
            )
            self.store.set_state(
                BotState.RECOVERY_REQUIRED,
                "reconciliation incomplete; operator review required: " + "; ".join(problems),
                now,
            )
            return

        self.health.record(LAST_RECONCILE, now, detail=f"{len(open_trades)} open position(s)")
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
            # Stamp the sample with the wall clock AROUND the call, not with
            # the loop-start time freqtrade handed us: by now the order-book
            # fetch (and any retry backoff) has already spent seconds, and
            # that elapsed time was being reported as clock skew (audit
            # finding).
            started = datetime.now(timezone.utc)
            millis = api.fetch_time()
            finished = datetime.now(timezone.utc)
            sampled_at = started + (finished - started) / 2
            self.health.record(
                EXCHANGE_TIME,
                sampled_at,
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

    def _closed_candles(self, dataframe: DataFrame, now: datetime) -> DataFrame:
        """Rows whose candle has CLOSED by ``now``.

        In a dry run the analyzed dataframe already ends at the last closed
        candle. In a backtest freqtrade hands the strategy a slice whose last
        row is the candle being traded - the one whose open is the entry
        price and whose high/low/close lie in the future. Sizing a stop from
        that row's ATR, or marking equity at its close, is look-ahead (audit
        finding: every Faz 4 trade was sized with up to four hours of future
        information). The same rule holds on both paths: a candle counts
        once its open time plus the timeframe is not after ``now``.
        """
        if dataframe is None or dataframe.empty:
            return dataframe
        closes_at = dataframe["date"] + self._tf_delta
        return dataframe.loc[closes_at <= now]

    def _current_atr_and_stop(
        self, pair: str, entry_price: Decimal, now: datetime
    ) -> tuple[Decimal, Decimal, datetime]:
        """ATR from the last CLOSED candle, the absolute stop it implies, and
        that candle's open time (the signal's identity)."""
        dataframe, _ = self.dp.get_analyzed_dataframe(pair, self.timeframe)
        if dataframe is None or dataframe.empty:
            raise ValueError(f"no analyzed dataframe for {pair}")
        dataframe = self._closed_candles(dataframe, now)
        if dataframe.empty:
            raise ValueError(f"no CLOSED candle for {pair} at {now.isoformat()}")
        atr_raw = dataframe["atr"].iloc[-1]
        atr = dec(float(atr_raw))
        if atr <= ZERO:
            raise ValueError(f"ATR for {pair} is {atr}; refusing to derive a stop from it")

        stop = entry_price - (self.atr_stop_multiple * atr)
        if stop <= ZERO or stop >= entry_price:
            raise ValueError(
                f"derived stop {stop} is not strictly between 0 and entry {entry_price}"
            )
        candle_time = dataframe["date"].iloc[-1].to_pydatetime()
        return atr, stop, candle_time

    def _next_intent_id(self, pair: str, candle_time: datetime) -> str:
        """Intent id for this signal candle; a released attempt gets a suffix.

        Keyed on the SIGNAL CANDLE rather than the wall clock, so the id is
        the same in every callback and after a restart. If an earlier attempt
        on the same candle was released (the entry timed out), the next one
        is a new intent; if it is still pending or filled, the same id makes
        try_reserve refuse the duplicate.
        """
        base = self._build_intent_id(pair, candle_time)
        intent_id, n = base, 1
        while True:
            existing = self.store.get_reservation(intent_id)
            if existing is None or existing.state is not ReservationState.RELEASED:
                return intent_id
            n += 1
            intent_id = f"{base}|{n}"

    @property
    def _tf_delta(self) -> timedelta:
        return timedelta(minutes=timeframe_to_minutes(self.timeframe))

    def _mark_price(self, pair: str, now: datetime, fallback: Decimal) -> tuple[Decimal, float]:
        """Current price for valuing a position, and how old it is.

        Simulated runs use the last closed candle (age 0 by construction).
        Live/dry runs use the order-book mid, then the ticker, then - if the
        venue cannot be reached - the last candle close with its REAL age,
        which the equity check will flag as stale. Stale equity refuses
        entries; it never touches exits.
        """
        if self.runmode in SIMULATED_RUNMODES:
            dataframe, _ = self.dp.get_analyzed_dataframe(pair, self.timeframe)
            dataframe = self._closed_candles(dataframe, now)
            if dataframe is not None and not dataframe.empty:
                return dec(float(dataframe["close"].iloc[-1])), 0.0
            return fallback, 0.0

        cached = self._mark_cache.get(pair)
        if cached is not None and (now - cached[2]).total_seconds() < 30:
            return cached[0], cached[1]

        price: Decimal | None = None
        age = 0.0
        try:
            book = self.dp.orderbook(pair, 1)
            bid, ask = dec(str(book["bids"][0][0])), dec(str(book["asks"][0][0]))
            if bid > ZERO and ask > ZERO:
                price = (bid + ask) / 2
        except Exception as exc:  # noqa: BLE001
            logger.debug("book mark for %s unavailable: %s", pair, exc)
        if price is None:
            try:
                price = dec(str(self.dp.ticker(pair)["last"]))
            except Exception as exc:  # noqa: BLE001
                logger.debug("ticker mark for %s unavailable: %s", pair, exc)
        if price is None or price <= ZERO:
            dataframe, _ = self.dp.get_analyzed_dataframe(pair, self.timeframe)
            if dataframe is None or dataframe.empty:
                return fallback, float("inf")
            last_open = dataframe["date"].iloc[-1].to_pydatetime()
            price = dec(float(dataframe["close"].iloc[-1]))
            age = max(0.0, (now - (last_open + self._tf_delta)).total_seconds())
        self._mark_cache[pair] = (price, age, now)
        return price, age

    def _entry_gates(self, pair: str, now: datetime) -> tuple[bool, bool, str]:
        """Data-quality and liquidity gates from policy.entry_gates.

        Returns (data_is_tradable, liquidity_ok, detail). These used to be
        hard-coded True with the policy values validated and then never read
        (audit finding). In simulated runs there is no live book; the
        liquidity gate is declared NOT modelled there (coverage.py) rather
        than faked.
        """
        gates = self.policy.entry_gates
        if self.runmode in SIMULATED_RUNMODES:
            return True, True, "simulated run: order book not modelled"

        dataframe, _ = self.dp.get_analyzed_dataframe(pair, self.timeframe)
        if dataframe is None or dataframe.empty:
            return False, False, "no analyzed dataframe"
        last_open = dataframe["date"].iloc[-1].to_pydatetime()
        expected = expected_last_completed_open(now, self.timeframe)
        if last_open < expected - self._tf_delta:
            return False, False, (
                f"last candle opened {last_open.isoformat()}, expected "
                f"{expected.isoformat()}: data is more than one candle behind"
            )

        # Structural quality of the candles the signal was computed on. A
        # NaN, an inverted high/low or a misaligned open time is FATAL in
        # quality.py, and that verdict used to apply only to the offline
        # feather files, never to what the bot actually trades on (audit
        # finding). Fail closed if the check itself cannot run.
        try:
            report = check_candles(dataframe.tail(64), pair, self.timeframe, now=now)
        except Exception as exc:  # noqa: BLE001
            return False, False, f"data quality check failed to run: {type(exc).__name__}: {exc}"
        if report.fatal:
            return False, False, "data quality FATAL: " + "; ".join(f.code for f in report.fatal)

        window = max(1, int(timedelta(days=1) / self._tf_delta))
        tail = dataframe.tail(window)
        quote_volume = dec(float((tail["volume"] * tail["close"]).sum()))
        min_volume = dec(gates["min_daily_quote_volume"])
        if quote_volume < min_volume:
            return True, False, f"24h quote volume {quote_volume:.0f} < {min_volume}"

        try:
            book = self.dp.orderbook(pair, 20)
        except Exception as exc:  # noqa: BLE001
            return True, False, f"order book unavailable: {type(exc).__name__}: {exc}"
        bids, asks = book.get("bids") or [], book.get("asks") or []
        if not bids or not asks:
            return True, False, "empty order book"
        bid, ask = dec(str(bids[0][0])), dec(str(asks[0][0]))
        if bid <= ZERO or ask <= ZERO or ask < bid:
            return True, False, f"nonsensical top of book bid={bid} ask={ask}"
        mid = (bid + ask) / 2
        spread_bps = (ask - bid) / mid * 10000
        max_spread = dec(gates["max_spread_bps"])
        if spread_bps > max_spread:
            return True, False, f"spread {spread_bps:.1f} bps > {max_spread} bps"

        deviation_bps = dec(gates["max_price_deviation_bps"])
        band = mid * deviation_bps / 10000
        ask_depth = sum(
            (dec(str(p)) * dec(str(a)) for p, a in asks if dec(str(p)) <= mid + band), ZERO
        )
        bid_depth = sum(
            (dec(str(p)) * dec(str(a)) for p, a in bids if dec(str(p)) >= mid - band), ZERO
        )
        depth = min(ask_depth, bid_depth)
        min_depth = dec(gates["min_book_depth_quote"])
        if depth < min_depth:
            return True, False, (
                f"book depth {depth:.0f} < {min_depth} within {deviation_bps} bps of mid"
            )
        return True, True, (
            f"spread {spread_bps:.1f} bps, depth {depth:.0f} within {deviation_bps} bps, "
            f"24h quote volume {quote_volume:.0f}"
        )

    def _gate_context(self, pair: str | None, now: datetime) -> GateContext:
        """Equity and exposure, marked to MARKET, from freqtrade's records.

        Open positions are valued at the current price, not at cost: an
        unrealised loss must reach the daily/weekly limits and the drawdown
        lock while the position is still open (RISK_POLICY), and sizing must
        not use an equity figure that ignores it. The previous version took
        freqtrade's cost-basis total, so open losses were invisible to every
        limit until the trade closed (audit finding).

        ``pair=None`` builds the context for the per-loop observation, where
        no entry is being considered and the entry gates do not apply.
        """
        stake_currency = self.config.get("stake_currency", "USDC")
        free = dec(self.wallets.get_free(stake_currency))

        open_trades = Trade.get_open_trades()
        open_risk = ZERO
        pair_notional = ZERO
        locked = ZERO
        holdings: list[AssetHolding] = []
        for trade in open_trades:
            amount = dec(trade.amount or 0)
            open_rate = dec(trade.open_rate or 0)
            filled = self._entry_filled_amount(trade)
            unfilled = amount - filled
            # Quote still sitting in a resting buy is quote, not position.
            locked += unfilled * open_rate

            mark, age = self._mark_price(trade.pair, now, fallback=open_rate)
            stop_price = trade.get_custom_data(META_STOP_PRICE)
            if stop_price is not None:
                to_stop = mark - dec(str(stop_price))
                open_risk += filled * (to_stop if to_stop > ZERO else ZERO)
            else:
                # No recorded stop means we cannot bound this position's loss;
                # treat its whole value as at risk rather than guessing.
                open_risk += filled * mark
            if trade.pair == pair:
                pair_notional += filled * mark
            if filled > ZERO:
                holdings.append(
                    AssetHolding(
                        asset=trade.pair.split("/")[0],
                        amount=filled,
                        price_quote=mark,
                        price_age_seconds=age,
                    )
                )

        equity = compute_equity(
            free_quote=free,
            locked_quote=locked,
            holdings=holdings,
            max_price_age_seconds=to_float(self.policy.entry_gates["max_data_age_seconds"]),
        )

        if pair is None:
            data_ok, liquidity_ok, detail = True, True, "observation only"
        else:
            data_ok, liquidity_ok, detail = self._entry_gates(pair, now)

        return GateContext(
            now=now,
            equity=equity,
            open_positions=len(open_trades),
            open_position_risk_quote=open_risk if open_risk > ZERO else ZERO,
            pair_notional_quote=pair_notional,
            data_is_tradable=data_ok,
            liquidity_ok=liquidity_ok,
            liquidity_detail=detail,
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
            atr, stop_price, candle_time = self._current_atr_and_stop(
                pair, entry_price, current_time
            )
            intent_id = self._next_intent_id(pair, candle_time)

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

            # Persist what we approved BEFORE freqtrade builds the order:
            # confirm_trade_entry re-checks against it, order_filled binds it
            # to the trade, and a restart in between still finds it (it used
            # to live in a process dict - audit finding).
            self.store.put_pending_entry(
                intent_id=intent_id,
                pair=pair,
                amount_base=decision.amount_base,
                entry_price=entry_price,
                stop_price=stop_price,
                atr=atr,
                now=current_time,
            )
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
        intent_id: str | None = None
        try:
            # One open trade per pair on spot, so the newest stored approval
            # for the pair IS this entry. Keyed by pair rather than by a
            # wall-clock stamp that differs between callbacks.
            pending = self.store.get_pending_entry(pair)
            if pending is None:
                logger.error("no approved entry recorded for %s; refusing entry", pair)
                return False
            intent_id = pending["intent_id"]

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

            logger.info("final entry gate passed for %s: %s", pair, message)
            return True

        except Exception as exc:  # noqa: BLE001
            logger.error(
                "final entry gate errored for %s (%s: %s); refusing", pair, type(exc).__name__, exc
            )
            if intent_id is not None:
                # Refused means no order: the reservation is dead, release it
                # rather than letting it hold a slot until the sweep.
                try:
                    self.store.release(intent_id, f"final gate errored: {exc}", current_time)
                except Exception:  # noqa: BLE001
                    logger.error("could not release %s after the gate error", intent_id)
            return False

    def order_filled(
        self, pair: str, trade: Trade, order, current_time: datetime, **kwargs
    ) -> None:
        """Bookkeeping on fills: bind the approval on entry, feed the locks on exit.

        Exit-side accounting is what makes two policy limits real: the
        consecutive-stop lock and the per-pair cooldown were declared in the
        policy but nothing ever recorded a stop or created a cooldown (audit
        finding).
        """
        try:
            entry_side = getattr(trade, "entry_side", "buy")
            if getattr(order, "ft_order_side", entry_side) == entry_side:
                self._on_entry_fill(pair, trade, current_time)
            else:
                self._on_exit_fill(pair, trade, order, current_time)
        except Exception as exc:  # noqa: BLE001
            logger.error("order_filled bookkeeping failed for %s: %s", pair, exc)

    def _on_entry_fill(self, pair: str, trade: Trade, now: datetime) -> None:
        intent_id = trade.get_custom_data(META_INTENT)
        if intent_id is None:
            pending = self.store.get_pending_entry(pair)
            if pending is None:
                logger.error(
                    "no approved stop for %s; the position is unprotected and the risk "
                    "layer will treat its whole notional as at risk",
                    pair,
                )
                return
            self._attach_approval(trade, pending, now)
            return
        # Subsequent (partial) fills of an already-bound entry.
        filled = self._entry_filled_amount(trade)
        if filled > ZERO:
            self.store.record_partial_fill(
                intent_id, filled, now, complete=not trade.has_open_orders
            )

    def _on_exit_fill(self, pair: str, trade: Trade, order, now: datetime) -> None:
        fully_exited = (not trade.is_open) or (
            dec(getattr(order, "safe_filled", 0) or 0) >= dec(trade.amount or 0)
        )
        if not fully_exited:
            return
        reason = str(trade.exit_reason or "")
        risk = self.policy.risk
        if reason in STOP_EXIT_REASONS:
            count = self.store.record_stop(pair, now)
            logger.warning("%s exited by %s; consecutive stops = %d", pair, reason, count)
        else:
            self.store.reset_stop_counter(now)
        candles = int(risk["pair_cooldown_candles"])
        if candles > 0:
            self.store.add_lock(
                LockKind.PAIR_COOLDOWN,
                f"cooldown after {reason or 'exit'}: {candles} candle(s)",
                now,
                expires_at=now + candles * self._tf_delta,
                pair=pair,
                metadata={"exit_reason": reason},
            )

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
