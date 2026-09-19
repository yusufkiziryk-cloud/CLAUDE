# Architecture

## Responsibility split

```
  market data ──► SIGNAL          user_data/strategies/BaselineTrend4h.py
                  (populate_*)    decides WHETHER a setup exists
                     │
                     ▼
                  RISK            src/kripto/risk/
                  (EntryGate)     decides WHETHER and HOW MUCH - may VETO
                     │
                     ▼
                  EXECUTION       freqtrade
                  (orders, DB)    owns trades, fills and the ledger
```

The risk layer can veto any signal. The signal layer cannot change a single
risk limit - it has no write path into `policy.yaml` or the risk store.

## What owns what

| Concern | Owner | Never duplicated in |
|---|---|---|
| Trades, orders, fills, PnL | freqtrade's DB | the risk store |
| Period baselines, locks, stop counter, peak equity | risk store | freqtrade |
| Pending-entry reservations | risk store | freqtrade |
| Risk limits | `config/policy.yaml` | freqtrade config |
| Exchange connectivity | freqtrade + ccxt | our code |
| OHLCV collection | our collector | `freqtrade download-data` (unusable here) |

The risk store is deliberately **not** a second position ledger. Open-position
risk is passed *into* the gate, computed from freqtrade's own trade records,
so the two can never disagree about how many positions exist.

## Bot states

```
  RECONCILING ──(records agree)──► READY ──(limit breached)──► ENTRY_PAUSED
       │                             │                              │
       │                             │                    (new period / cooldown,
       │                             │                     if healthy)
       │                             │                              │
       │                             ◄──────────────────────────────┘
       │
       └──(records cannot be reconciled)──► RECOVERY_REQUIRED ──► (operator)

  any state ──(operator stop)──► STOPPED
```

| State | Entries | Exit management |
|---|---|---|
| `READY` | yes | yes |
| `ENTRY_PAUSED` | no | **yes** |
| `RECONCILING` | no | **yes** |
| `RECOVERY_REQUIRED` | no | **yes** |
| `STOPPED` | no | no |

Only `STOPPED` halts exit management. An entry lock that also stopped stop-loss
handling would turn a risk control into a risk amplifier. Stopping the process
is *not* the same action as stopping risk-taking, and the runbook says so.

A fresh risk store starts in `RECONCILING`, never `READY`: a process that has
just started has not yet agreed with the exchange about anything.

Who may move the state (pinned by tests after the 2026-09-19 audit):

- **Monitoring** (the in-process watchdog) may only move `READY` →
  `ENTRY_PAUSED`, and `ENTRY_PAUSED` → `READY` once the recommended action
  is back to none and no **portfolio-wide** lock is active. A per-pair
  cooldown is not a reason to keep the whole bot paused.
- **Reconciliation** moves `RECONCILING` → `READY`, or anything →
  `RECOVERY_REQUIRED`. So does losing the writer lock while running.
- `RECOVERY_REQUIRED` and `STOPPED` are never rewritten by monitoring, not
  even to `ENTRY_PAUSED`. Only an operator clears them
  (`scripts/risk-state.py set READY --operator-ack --reason ...`).
- On the first loop after a start, the previous process's stale heartbeat
  is **not** judged; this process earns its own at the end of that loop.

What reconciliation checks in a dry run: every open freqtrade position must
carry a risk approval (a reservation and a recorded stop). A position with no
approval is either the fail-open path or lost bookkeeping, and both call an
operator. A position whose approval exists but was never bound (a restart
between send and fill) is bound from the durable `pending_entries` record.
The order ledger in `src/kripto/orders/` is consulted only when it holds
records, i.e. when the executor path is in use; in a plain dry run freqtrade
places the simulated orders itself and the ledger is empty.

## Entry decision order

Cheap absolute refusals first; the atomic reservation last, so budget is only
taken once everything else has passed.

1. bot state allows entries
2. data quality gate for the pair: the analyzed candles are no more than one
   candle behind the expected last closed one, and `quality.check_candles`
   reports nothing FATAL on them (dry run / live)
3. liquidity gate from an explicit L2 call (`tickers_have_bid_ask` is
   `False`): spread ≤ `max_spread_bps`, depth within
   `max_price_deviation_bps` of mid ≥ `min_book_depth_quote` on both sides,
   24h quote volume ≥ `min_daily_quote_volume`. No book means no entry.
   Not modelled in backtests, and declared so in `coverage.py`.
4. equity is fresh and positive - **marked to market**: open positions are
   valued at the book mid (ticker, then last close with its real age as
   fallbacks), never at cost
5. locks (daily / weekly / drawdown / consecutive stops / pair cooldown)
6. remaining risk and notional budgets
7. `compute_position_size` - pure, fail-closed
8. `try_reserve` - a single `BEGIN IMMEDIATE` transaction
9. the approved stop, ATR and amount are written to `pending_entries`
   **before** freqtrade builds the order, keyed by pair as well as intent

Then, later, at the last possible moment:

10. `confirm_trade_entry` → `confirm_final_order` re-validates the **final**
    amount x price against the reservation (with a 1e-9 tolerance for the
    float round trip freqtrade performs on the amount).
11. `order_filled` binds the stored approval to the trade by pair, records
    the filled amount, and on the exit side feeds the stop counter and the
    per-pair cooldown.

Between loops, `bot_loop_start` (a) observes the limits with a pair-less
context so period baselines open at 00:00 UTC and open-position breaches
lock immediately, (b) renews the writer lease, (c) sweeps reservations that
freqtrade abandoned without a callback (cancelled after `unfilledtimeout`,
refused stake, failed create) once the entry timeout has comfortably passed
and no trade exists for the pair, and (d) reconciles. In backtests only (a)
runs, once per candle, so the drawdown lock is modelled there too.

Step 9 exists because two freqtrade behaviours are fail-open:
`custom_stake_amount` falls back to `proposed_stake` on exception, and
`validate_stake_amount` may enlarge an order by up to 30% to reach an exchange
minimum. Step 9 turns both back into fail-closed.

## Verified extension points

| Callback | Used for | Verified behaviour |
|---|---|---|
| `populate_indicators/entry/exit` | signals | last dataframe row is the last **completed** candle (`ohlcv_partial_candle`) |
| `custom_stake_amount` | risk sizing | wrapped with `default_retval=stake_amount`; never allowed to raise |
| `confirm_trade_entry` | second gate | returning `False` prevents the order |
| `order_filled` | attach stop metadata | runs after the fill exists |
| `custom_stoploss` | ATR stop | expects a **negative** ratio; can never be wider than `self.stoploss` |
| `confirm_trade_exit` | nothing | always returns `True` - freqtrade warns it can prevent stoploss exits |

No freqtrade core file is patched or monkey-patched.

## Monitoring

```
  bot loop ──writes──► health signals (same SQLite file)
                              │
                              ├──► in-process checks ──► pause OWN entries
                              │
                              └──► scripts/watchdog.py ──► alert a human
                                   (mode=ro connection)
```

One set of check functions, two callers. The in-process caller can act; the
out-of-process one exists precisely for the case where the bot is the broken
thing and cannot act on its own behalf.

The observer's connection is opened `mode=ro`, so writing raises rather than
being merely discouraged. No check may recommend anything stronger than
halting entries or calling a human - stopping exit management is not an
available action.

Two timing details that are easy to get wrong and are therefore pinned by
tests:

- A completed 4h candle is legitimately **4-8 hours old**. Freshness compares
  against the expected last *closed* candle, not a flat age. Order book
  staleness is a **separate clock** with its own threshold.
- Clock skew compares the venue timestamp against the local time **when the
  sample was taken**. Comparing against "now" measures sample age instead,
  which once reported a real 0.1s skew as 93s.

## Environment separation

Backtest, dry-run and any future live run keep separate risk-state files,
separate trade databases and separate logs. A backtest wipes its own risk
state at start, so a run's result depends only on its inputs.
