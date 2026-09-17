# Project state

Last updated: 2026-09-17, end of the build session.

## Where things stand

| Phase | Status |
|---|---|
| Faz 0 - review and plan | **DONE**, approved |
| Faz 1 - safe skeleton | **DONE** (Docker path `NOT_RUN` - no daemon here) |
| Faz 2 - market data | **DONE** |
| Faz 3 - strategy, risk, order correctness | **PARTIAL** - risk layer done; order lifecycle partially tested |
| Faz 4 - honest research report | **DONE** - verdict `INSUFFICIENT_EVIDENCE` |
| Faz 5 - monitoring and handover | **PARTIAL** - runbook done; watchdog, weekly report and the 4-8 week observation not done |
| Faz 6 - live readiness assessment | **DONE** - live remains blocked |

Tests: **176 passing** offline, **180** including public-endpoint tests.

## Decisions made, and why

1. **Stay on Hyperliquid spot, record the missing stop as a blocker.**
   Data (>12 months of 4h) and liquidity are adequate; the missing
   exchange-side stop is a live blocker, not a development blocker.
2. **Write our own data collector.** `ohlcv_has_history: False` makes
   `freqtrade download-data` unusable here, while the raw endpoint returns a
   market's whole listed history in one call.
3. **SQLite for risk state.** Reservations need real transactions; two
   signals in one loop must not both spend the last of the budget.
4. **A second entry gate.** Two freqtrade behaviours are fail-open
   (`proposed_stake` fallback, +30% minimum-stake enlargement), so the final
   amount x price is re-validated at the last moment.
5. **`startup_candles` 400 → 800.** Measured, not assumed: signals still
   changed at 600 in one of three evaluation windows.
6. **No `telegram` or `api_server` block in the config.** freqtrade's schema
   demands credentials for either block even when disabled.

## Assumptions that changed during the build

- "The 5000-candle cap limits 4h history" - **wrong**. Listing date is the
  binding constraint for 4h (592/540/496 days). The cap binds hard on 1h
  (208 days) and 5m (17 days).
- "BTC/USDC on Hyperliquid spot is BTC" - **wrong**. It is UBTC, a
  bridge-issued wrapper, renamed by ccxt.
- "A clean `lookahead-analysis` means no leak" - **wrong on both sides**.
  It reported a bias that turned out to be a statefulness artefact, and it
  forces `dry_run_wallet = 1e9`, so it never tests the real risk policy.

## Bugs found by the tests, not by inspection

1. `bool_series.shift(1).fillna(False)` returns **object** dtype; `~` then
   does integer bitwise NOT (`True → -2`, `False → -1`), both truthy. The
   entry transition filter was silently a no-op - 439 signals instead of 20.
2. pandas 3.0 uses `datetime64[us]`; the candle-grid alignment check was off
   by 1000x and flagged every valid candle as misaligned.
3. The entry gate subtracted reservations from the risk budget **twice**
   (once in the gate, once inside the reservation transaction), so the third
   concurrent position could never be opened.
4. The collector's incremental path used `min()` where it needed the recent
   window, re-downloading the entire history on every run.

## Open risks

- Order lifecycle (cancel/fill races, unresolved orders, crash recovery) is
  designed and partially unit-tested but not adversarially exercised. The
  stateful fake exchange does not exist yet.
- No single-writer enforcement: a second bot instance on the same account is
  not prevented (T11).
- No watchdog: loop liveness, data freshness, reconciliation age and clock
  skew are specified in the policy but not measured by a running component.
- The container this was built in is ephemeral, so nothing long-running was
  started.

## The exact next step

Build the **stateful fake exchange** in `tests/`, then close T08, T09, T10,
T16 and T22 against it. That is the largest remaining gap between "designed
correctly" and "demonstrated correct", and every later phase depends on it.

Reproduction:

```bash
.venv/bin/python -m pytest -m "not network"
.venv/bin/python scripts/collect-data.py --timeframes 4h
.venv/bin/python scripts/safe-run.py backtesting \
    --config config/config.dry.json --strategy BaselineTrend4h \
    --timerange 20250901-20260901 --enable-protections --fee 0.0007
```
