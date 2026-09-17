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
| T07 | Partial fill, fee currency, dust | `VERIFIED` | `test_risk_gate.py` (reservation accounting), `test_fills_and_exits.py` (fee in base/quote/third token, dust classification) |
| T08 | Timeout after exchange acceptance | `VERIFIED` | `test_order_lifecycle.py` - the venue keeps the order, the client never hears back; `UNKNOWN`, no second order, resolved only by querying |
| T09 | Cancel/fill race, duplicated and reordered events | `VERIFIED` | `test_order_lifecycle.py` - fill wins the race, duplicates applied once, reordering never reduces the fill |
| T10 | Forced crash at intent / submit / fill | `VERIFIED` | `test_order_lifecycle.py` - store reopened at each stage; event dedup survives a restart |
| T11 | Second bot instance on the same account | `VERIFIED` | `test_single_writer_t11.py` (10 tests) - lease-based writer lock, takeover only after an abandoned lease |
| T12 | Open-position loss crosses the daily/weekly limit | `VERIFIED` | `test_risk_gate.py` - including that recovery in the same period does not unlock |
| T13 | Period rollover, restart, missing/corrupt risk record | `VERIFIED` | `test_risk_gate.py` |
| T14 | External balance change or unrecognised order | `VERIFIED` | `test_order_lifecycle.py` + the strategy's `_maybe_reconcile`, which runs on every loop, drops to `RECOVERY_REQUIRED` on anything unexplained, and never adopts, cancels or closes an unrecognised order. **Dry-run reconciles against freqtrade's simulated ledger, not the venue** - see `coverage.py`. |
| T15 | Stop, emergency exit and losing normal exit are never vetoed | `VERIFIED` | `test_fills_and_exits.py` - every exit reason, a 60% loss, plus a structural check that no `return False` path exists |
| T16 | Stop does not fill; price gaps | `VERIFIED` | `test_order_lifecycle.py` - bounded repricing, a hard slippage floor, an explicit "position STILL OPEN" alert, and a gap that leaves a resting sell untouched |
| T17 | 429, 5xx, disconnect, clock skew | `PARTIAL` | collector has bounded jittered backoff; clock skew measured against the venue and alarmed on; API error rate tracked over a rolling window with a minimum sample. **Transport-level fault injection on the order path not run.** |
| T18 | DB lock, disk full, corrupt snapshot | `PARTIAL` | atomic write + fsync + rename; unknown schema version refused; terminal states immune to late events. **Disk-full injection not run.** |
| T19 | Missing, open, duplicate, unordered candles; wrong market type | `VERIFIED` | `test_data_quality_t19.py` (21 tests) |
| T20 | Future candles mutated; past signals must not change | `VERIFIED` | `test_lookahead_t20.py` - truncation, x3 mutation, single-candle mutation |
| T21 | Warm-up length and candle limit sensitivity | `VERIFIED` | `test_lookahead_t20.py` - signal-level, three evaluation windows |
| T22 | A shared risk scenario across backtest / replay / dry-run | `VERIFIED` | `test_risk_replay_t22.py` - identical decisions across paths, plus `src/kripto/risk/coverage.py` declaring what each path cannot model |
| T23 | Deliberately bad strategy and insufficient data | `PARTIAL` | the real strategy produced `INSUFFICIENT_EVIDENCE` honestly; **no automated eligibility engine** |
| T24 | No Telegram; watchdog outage; loop frozen with process alive | `VERIFIED` | `test_watchdog_t24.py` (37 tests) - frozen-loop detection, candle vs book clocks, clock skew, API error rate, disk, bounded non-blocking notifications, and a read-only observer connection |
| T25 | Canary secrets in logs, exceptions, URLs, reports | `VERIFIED` | `test_redaction.py` (10 tests) |
| T26 | Re-run from a clean directory reproduces the result | `PARTIAL` | collector idempotency verified; the backtest reproduced -5.33% / 12 trades / PF 0.13 identically after unrelated code changes. **No single clean-room script yet.** |

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

The stateful fake venue (`tests/fake_exchange.py`) now exists and closed
T08, T09, T10, T16 and T22. It keeps real order state, fills as the price
moves, and injects the specific failures venues produce: an accepted order
whose response is lost, a cancel that loses a race to a fill, duplicated and
reordered event delivery, and a price that gaps past a resting order.

The lifecycle protections were **mutation-tested**: removing the duplicate
event guard, allowing stale fills to move the filled amount backwards, and
treating `UNKNOWN` as safe to resubmit each broke exactly the tests meant to
catch them. The tests are not vacuous.

The watchdog (`src/kripto/ops/`) closed T24 and, with reconciliation wired
into the loop, T14. Its checks were mutation-tested too: replacing the
candle-boundary maths with a naive age threshold, sharing one staleness
threshold between candles and the order book, and opening the state file
read-write each broke exactly the tests meant to catch them.

An end-to-end dry run exercised the whole path: writer lock acquired,
`RECONCILING` -> reconciled -> `READY`, first-loop pause while no data
existed yet, then recovery, with the external watchdog reporting all checks
green and exiting 0.

Still genuinely open:

- **`T17`/`T18`** lack fault injection at the transport and filesystem level.
  The collector retries with bounded jittered backoff and the storage check
  alarms on low disk, but neither has been exercised by injecting the fault.
- **`T23`** has no automated eligibility engine; the verdict was reached by
  applying the thresholds by hand.
- **`T26`** reproduces in practice but has no single clean-room script.
- **Venue-side reconciliation is still only PARTIAL in dry run.** Nothing was
  ever sent to the exchange, so there is nothing there to reconcile against;
  the loop verifies our bookkeeping against freqtrade's simulated ledger.
  This is a live-readiness gate, not a solved problem.

**A local fake passing is not "verified on the exchange".** Everything above
was exercised against public read endpoints and a simulated engine only.
