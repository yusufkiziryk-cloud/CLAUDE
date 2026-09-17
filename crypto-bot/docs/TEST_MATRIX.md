# Test matrix

Status: `VERIFIED` (test exists and passes), `PARTIAL` (covered in part; the
gap is named), `NOT_RUN` (cannot be exercised in this environment).

Run: `python -m pytest -m "not network"` (fast) or `python -m pytest` (adds
tests that read public exchange endpoints).

| ID | Scenario | Status | Where |
|---|---|---|---|
| T01 | Default start; live override via env, CLI and a second config file | `VERIFIED` | `test_launcher_t01.py` (25 tests) |
| T02 | Network calls recorded during a dry run | `VERIFIED` | `test_network_t02.py` - real freqtrade `Exchange`, endpoint-level classification |
| T03 | Risk amount vs stop distance, fees and units | `VERIFIED` | `test_sizing.py` - hand-computed expectations |
| T04 | Zero/negative ATR, NaN, stale price, missing equity, risk exception | `VERIFIED` | `test_sizing.py`, `test_risk_gate.py`, `test_capabilities.py` |
| T05 | Exchange minimum, precision, framework clamp | `VERIFIED` | `test_sizing.py`, `test_risk_gate.py` (second gate) |
| T06 | Two simultaneous signals against the last budget | `VERIFIED` | `test_risk_gate.py` |
| T07 | Partial fill, fee currency, dust | `PARTIAL` | `test_risk_gate.py` covers partial fill, out-of-order events and reservation accounting. **Fee-in-base and dust accounting are not yet tested.** |
| T08 | Timeout after exchange acceptance | `PARTIAL` | `UNKNOWN` state holds budget and is tested. **The full query-and-reconcile loop is not implemented.** |
| T09 | Cancel/fill race, duplicated and reordered events | `PARTIAL` | monotonic fill handling tested. **Full race simulation against a stateful fake exchange is not implemented.** |
| T10 | Forced crash at intent / submit / fill | `PARTIAL` | reservations and locks survive a store reopen. **Process-level crash injection not implemented.** |
| T11 | Second bot instance on the same account | `NOT_RUN` | single-writer enforcement not implemented |
| T12 | Open-position loss crosses the daily/weekly limit | `VERIFIED` | `test_risk_gate.py` - including that recovery in the same period does not unlock |
| T13 | Period rollover, restart, missing/corrupt risk record | `VERIFIED` | `test_risk_gate.py` |
| T14 | External balance change or unrecognised order | `PARTIAL` | states and locks exist; **detection is not wired to a live feed** |
| T15 | Stop, emergency exit and losing normal exit are never vetoed | `PARTIAL` | `confirm_trade_exit` returns `True` unconditionally and is exercised in backtests. **No dedicated unit test.** |
| T16 | Stop does not fill; price gaps | `NOT_RUN` | needs the stateful fake exchange |
| T17 | 429, 5xx, disconnect, clock skew | `PARTIAL` | collector has bounded jittered backoff; `FUTURE_TIMESTAMPS` detects skew. **Order-path retry semantics not tested.** |
| T18 | DB lock, disk full, corrupt snapshot | `PARTIAL` | atomic write + fsync + rename implemented; unknown schema version refused. **Disk-full injection not run.** |
| T19 | Missing, open, duplicate, unordered candles; wrong market type | `VERIFIED` | `test_data_quality_t19.py` (21 tests) |
| T20 | Future candles mutated; past signals must not change | `VERIFIED` | `test_lookahead_t20.py` - truncation, x3 mutation, single-candle mutation |
| T21 | Warm-up length and candle limit sensitivity | `VERIFIED` | `test_lookahead_t20.py` - signal-level, three evaluation windows |
| T22 | A shared risk scenario across backtest / replay / dry-run | `NOT_RUN` | replay harness not built |
| T23 | Deliberately bad strategy and insufficient data | `PARTIAL` | the real strategy produced `INSUFFICIENT_EVIDENCE` honestly; **no automated eligibility engine** |
| T24 | No Telegram; watchdog outage; loop frozen with process alive | `NOT_RUN` | watchdog not implemented |
| T25 | Canary secrets in logs, exceptions, URLs, reports | `VERIFIED` | `test_redaction.py` (10 tests) |
| T26 | Re-run from a clean directory reproduces the result | `PARTIAL` | collector idempotency and merge stability verified; backtests wipe their own risk state. **No end-to-end clean-room reproduction script.** |

## Requirement → test mapping (selected invariants)

| Invariant | Test |
|---|---|
| A risk-calculation failure never becomes a trade | `test_t04_*`, `test_custom_stake_amount_still_falls_back_to_proposed_stake` |
| The final order is never larger than the reserved one | `test_second_gate_refuses_an_order_the_framework_enlarged` |
| Rounding never increases risk | `test_t05_rounding_never_increases_risk_across_many_steps` |
| Two signals cannot double-spend | `test_t06_two_signals_cannot_both_take_the_last_risk_budget` |
| `UNKNOWN` orders keep holding budget | `test_t07_unknown_outcome_keeps_the_budget_held` |
| A restart cannot erase a period's loss | `test_t13_period_baseline_is_never_overwritten_within_a_period` |
| Peak equity never falls | `test_t13_peak_equity_survives_a_restart_and_never_falls` |
| Drawdown lock needs a human | `test_t12_max_drawdown_lock_requires_an_operator` |
| Entry locks do not stop exits | `test_t12_entry_lock_does_not_stop_exit_management` |
| Gaps are never forward-filled | `test_gap_is_reported_and_never_filled` |
| The future cannot change the past | `test_t20_*` |
| Secrets never reach a log | `test_t25_*` |
| Capability assumptions are re-checked on upgrade | `test_capabilities.py` |

## Honest gaps

The `NOT_RUN` rows are not oversights to be discovered later; they are the
work that has not been done. The largest is the **stateful fake exchange**
(T09, T16, T22 and the deeper halves of T08/T10/T14) - without it, the order
lifecycle is designed and unit-tested but not adversarially exercised.

`T11` (single-writer enforcement) and `T24` (watchdog) are unimplemented
features, not untested ones.

**A local fake passing is not "verified on the exchange".** Everything above
was exercised against public read endpoints and a simulated engine only.
