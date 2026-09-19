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
| T14 | External balance change or unrecognised order | `PARTIAL` | Unrecognised orders/positions: `test_audit_reconcile_flags_foreign_orders_and_positions`, `test_audit_reconcile_flags_a_position_with_no_approval` - never adopted, `RECOVERY_REQUIRED`. **External balance change: no detector is wired** (`record_external_flow` has no caller); a dry run cannot see deposits, and this is a live-readiness item. Dry-run reconciles positions against approval records, not the venue - see `coverage.py`. |
| T15 | Stop, emergency exit and losing normal exit are never vetoed | `VERIFIED` | `test_fills_and_exits.py` - every exit reason, a 60% loss, plus a structural check that no `return False` path exists |
| T16 | Stop does not fill; price gaps | `VERIFIED` | `test_order_lifecycle.py` - bounded repricing that re-prices only the unsold remainder, stops on an unconfirmed cancel, a hard slippage floor, an explicit "STILL OPEN" alert, a success path that really fills; `test_audit_a_gap_through_the_stop_exits_at_the_next_tick` for the production gap behaviour |
| T17 | 429, 5xx, disconnect, clock skew | `VERIFIED` | `test_fault_injection_t17.py` (27 tests) - 429/5xx/disconnect injected on create, cancel and resolve: always `UNKNOWN`, never a second order, budget held, discovered on resolve; emergency exit stops at the first unknown; HTTP client retries 429/5xx/timeouts with capped backoff, gives up within the bound, never retries 4xx, has no write method. Clock skew: `test_watchdog_t24.py` + `test_audit_clock_skew_sample_is_stamped_when_taken`. Against a fake venue and a scripted session - not the exchange. |
| T18 | DB lock, disk full, corrupt snapshot | `VERIFIED` | `test_fault_injection_t18.py` (17 tests) - ENOSPC from `to_feather`/`fsync`/`replace` leaves the old file intact and no temp file; SQLite full (page cap) rolls the reservation back completely and durably; a full disk stops the heartbeat and the watchdog notices; `custom_stake_amount` returns 0; a held write lock refuses the second writer without a partial row and never blocks the read-only observer; garbage and truncated state files are refused, not recreated; corrupt, truncated and hash-matching-but-damaged backup snapshots fail verification. Three real defects found by these injections are recorded in `AUDIT_2026-09-19.md` (P13-P15). |
| T19 | Missing, open, duplicate, unordered candles; wrong market type | `VERIFIED` | `test_data_quality_t19.py` (21 tests) |
| T20 | Future candles mutated; past signals must not change | `VERIFIED` | `test_lookahead_t20.py` - truncation, x3 mutation, single-candle mutation |
| T21 | Warm-up length and candle limit sensitivity | `VERIFIED` | `test_lookahead_t20.py` - signal-level, three evaluation windows |
| T22 | A shared risk scenario across backtest / replay / dry-run | `VERIFIED` | `test_risk_replay_t22.py` - identical decisions across paths, plus `src/kripto/risk/coverage.py` declaring what each path cannot model |
| T23 | Deliberately bad strategy and insufficient data | `VERIFIED` | `src/kripto/research/eligibility.py` + `scripts/eligibility.py` + `test_eligibility_t23.py` (18 tests) - the five plan criteria, the trade floor, the experiment budget and the hold-out attestation applied by code; a losing strategy with enough trades is `REJECTED`, few trades or a missing 2x run is `INSUFFICIENT_EVIDENCE` with the failures still named, only a full pass on attested evidence is a candidate; thresholds pinned to `RESEARCH_PLAN.md`; the real archive re-derives the report's verdict |
| T24 | No Telegram; watchdog outage; loop frozen with process alive | `VERIFIED` | `test_watchdog_t24.py` (38 tests) - frozen-loop detection, candle vs book clocks, clock skew, API error rate, disk, bounded non-blocking notifications, a read-only observer whose read-only-ness is checked on database CONTENT (a byte comparison was blind under WAL) |
| T25 | Canary secrets in logs, exceptions, URLs, reports | `VERIFIED` | `test_redaction.py` + `test_audit_handlers_added_after_install_still_redact`, `test_audit_webhook_capabilities_in_urls_are_redacted`, `test_audit_deadman_mask_*` - every handler, present or future; bare 64-hex keys; quoted/JSON values; webhook URLs |
| T26 | Re-run from a clean directory reproduces the result | `VERIFIED` | `scripts/cleanroom-verify.sh`: sparse clone at a ref into an empty directory → venv → `requirements.lock.txt` → offline suite → `--cache none` backtest compared with `reports/faz4/expected_backtest.json`. Run end to end on 2026-09-19 at `7c03d14`: `REPRODUCED` (that ref's numbers). The reference now pins the post-audit run (16 trades / -6.64% / PF 0.16). |

Test count on 2026-09-19: **466 offline**, 470 with the public-endpoint tests.

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
| Approvals survive a restart and bind by pair | `test_audit_approval_survives_between_callbacks_and_binds_by_pair`, `test_audit_reconcile_binds_a_stored_approval_after_a_restart_mid_fill` |
| Abandoned reservations do not hold budget for ever | `test_audit_abandoned_reservations_are_swept_but_live_ones_are_kept`, `test_audit_a_fill_one_step_short_completes_the_reservation` |
| Equity is marked to market; open losses reach the limits | `test_audit_equity_is_marked_to_market_not_cost`, `test_audit_an_open_loss_trips_the_daily_lock_without_a_signal` |
| Monitoring can pause, never promote or rewrite an operator state | `test_audit_monitoring_never_rewrites_recovery_required`, `test_audit_monitoring_pauses_only_a_ready_bot` |
| The audited config is the running config | `test_audit_no_config_means_the_shipped_dry_run_config_is_forwarded`, `test_audit_every_config_spelling_freqtrade_accepts_is_audited` |
| A forming candle is never history | `test_audit_the_forming_candle_is_never_persisted` |

## Correction: an earlier reproducibility claim rested on a cache hit

freqtrade caches backtest results for a day and **silently reuses** them when
the strategy file is unchanged, printing a full result table with no
indication that nothing ran. Several "re-ran the backtest" checks in this
project were therefore cache hits, including the one first cited as evidence
that the result reproduced.

The numbers turned out to be right - a genuine `--cache none` run produces
the same -5.33% / 12 trades / PF 0.13 - but the evidence behind the original
claim was not. The claim has been re-established, not merely re-worded.

Two consequences, both acted on:

- `scripts/safe-run.py` now passes `--cache none` by default for
  `backtesting`, `lookahead-analysis` and `recursive-analysis`, and says so
  on stdout. Pass `--cache` explicitly to opt back in.
- Any change OUTSIDE the strategy file - the risk layer, the policy, the
  data - is invisible to the cache key. That is what made the entry-decision
  recording appear broken when it was working: the backtest never ran.

## The 2026-09-19 audit

Ten adversarial reviewers found 56 unique defects, nearly all at the seams
between layers (strategy callbacks ↔ risk store, backtest ↔ live loop, unit
files ↔ filesystem). One claim was refuted by measurement; the rest were
fixed with regression tests (`tests/test_audit_regressions.py`). The full
list, with the test that pins each fix, is in
[`AUDIT_2026-09-19.md`](AUDIT_2026-09-19.md). Two of the findings changed
the research numbers; the verdict did not change.

Mutation checks the audit added: the risk-budget check in T06 can no longer
be deleted silently; a writing watchdog can no longer hide behind WAL; the
emergency-exit success branch can no longer be removed without a failure.

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

- **`T14`, external balance change.** No detector is wired; a dry run cannot
  see a deposit. Live-readiness item.
- **Fault injection is against models of the faults.** `T17` runs against a
  fake venue and a scripted HTTP session; `T18` induces ENOSPC by raising
  from the syscalls the writer uses and induces SQLite-full by capping the
  page count. Neither is a real full disk or a real 429 from the exchange.
- **Venue-side reconciliation is still only PARTIAL in dry run.** Nothing was
  ever sent to the exchange, so there is nothing there to reconcile against;
  the loop verifies our bookkeeping against freqtrade's simulated ledger.
  This is a live-readiness gate, not a solved problem.

**A local fake passing is not "verified on the exchange".** Everything above
was exercised against public read endpoints and a simulated engine only.
