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

## Entry decision order

Cheap absolute refusals first; the atomic reservation last, so budget is only
taken once everything else has passed.

1. bot state allows entries
2. data quality gate for the pair
3. liquidity gate (requires an explicit L2 call - `tickers_have_bid_ask` is `False`)
4. equity is fresh and positive
5. locks (daily / weekly / drawdown / consecutive stops / pair cooldown)
6. remaining risk and notional budgets
7. `compute_position_size` - pure, fail-closed
8. `try_reserve` - a single `BEGIN IMMEDIATE` transaction

Then, later, at the last possible moment:

9. `confirm_trade_entry` → `confirm_final_order` re-validates the **final**
   amount x price against the reservation.

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

## Environment separation

Backtest, dry-run and any future live run keep separate risk-state files,
separate trade databases and separate logs. A backtest wipes its own risk
state at start, so a run's result depends only on its inputs.
