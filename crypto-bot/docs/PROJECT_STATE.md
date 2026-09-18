# Project state

Last updated: 2026-09-18, after the deployment work (Gate D).

## Where things stand

| Phase | Status |
|---|---|
| Faz 0 - review and plan | **DONE**, approved |
| Faz 1 - safe skeleton | **DONE** (Docker path `NOT_RUN` - no daemon here) |
| Faz 2 - market data | **DONE** |
| Faz 3 - strategy, risk, order correctness | **DONE** - risk layer and order lifecycle both adversarially tested |
| Faz 4 - honest research report | **DONE** - verdict `INSUFFICIENT_EVIDENCE` |
| Faz 5 - monitoring and handover | **DONE** (code) - watchdog, weekly report, dashboard, deployment units; the 4-8 week observation itself cannot be run here |
| Faz 6 - live readiness assessment | **DONE** - live remains blocked |

Tests: **330 passing** offline, **334** including public-endpoint tests.

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

## What the order-lifecycle work added

- `src/kripto/orders/lifecycle.py` - durable order state machine. Sending,
  acceptance, filling and cancellation are four separate observations;
  collapsing any two is what produces duplicate orders and phantom positions.
- `src/kripto/orders/executor.py` - submit / resolve / cancel, plus an
  emergency exit that reprices a **bounded** number of times within a hard
  slippage floor and then alerts that the position is still open.
- `src/kripto/risk/fills.py` - net fill accounting by fee currency, and dust
  classification. Dust is reported, never cleared by buying more.
- `src/kripto/risk/coverage.py` - a machine-readable declaration of what each
  run path can and cannot model.
- `tests/fake_exchange.py` - stateful venue with fault injection.
- Single-writer lease in the risk store, wired into `bot_start`.

The lifecycle protections were mutation-tested: removing the duplicate-event
guard, allowing stale fills to move the filled amount backwards, and treating
`UNKNOWN` as safe to resubmit each broke exactly the tests meant to catch
them.

## What the watchdog work added

- `src/kripto/ops/health.py` - signals the bot leaves behind as it works, and
  a read-only accessor. The observer's SQLite connection uses `mode=ro`, so
  it is structurally incapable of writing rather than merely forbidden to.
- `src/kripto/ops/watchdog.py` - nine checks, none of which look at whether
  the process is up. The same functions run in-process (the bot pauses its
  own entries) and out-of-process (a human gets told when the bot is the
  broken thing).
- `src/kripto/ops/notifier.py` - bounded, redacting, never-raising delivery.
  A dead transport cannot stop stop-loss management or grow a queue without
  limit.
- `scripts/watchdog.py` - standalone observer, exit code 0/1/2.
- Reconciliation wired into `bot_loop_start`, which closed T14 and is what
  lets a restart actually reach `READY`.

Verified end to end on a real dry run: writer lock acquired, `RECONCILING` ->
reconciled -> `READY`, a first-loop pause while no data existed yet, then
recovery, with the external watchdog reporting all nine checks green.

## Bugs the end-to-end run caught

5. **Sample age was being reported as clock skew.** The stored venue
   timestamp was compared against the *current* local time instead of the
   local time when the sample was taken, so a real 0.1s skew was reported as
   93s - and halted entries. Unit tests had not caught it because they
   sampled and checked at the same instant.
6. **Recovery keyed off the health LEVEL instead of the recommended ACTION.**
   A standing WARN with no action (an unsampled clock) held entries paused
   indefinitely, turning a minor observability gap into a silent trading halt.

## Open risks

- **No transport or filesystem fault injection (T17, T18).** Low disk is
  alarmed on but has never been induced; the order path's behaviour under
  429/5xx is untested.
- **Venue-side reconciliation is PARTIAL.** In a dry run nothing is ever
  sent, so the loop reconciles against freqtrade's simulated ledger, not an
  exchange.
- **A same-host watchdog cannot report a dead host.** A dead-man heartbeat to
  an off-box service would cover it; nothing here starts or pays for one.
- The single-writer lock protects one machine only. Nothing here can stop a
  second host trading the same account, so V1 stays single-host by design.
- The container this was built in is ephemeral: total observed runtime is
  minutes, against a required 4-8 weeks.

## What the weekly-report work added

- Entry decisions are now **persisted**, not just logged. Refusals with their
  reasons are the half that explains a quiet week, and log files rotate.
- `src/kripto/report/weekly.py` + `scripts/weekly-report.py`: local Markdown
  and JSON, nothing sent anywhere. Its verdict ladder refuses to conclude
  before the observation is long enough AND has enough closed trades.
- `scripts/safe-run.py` passes `--cache none` for evidence-producing
  commands.

## Bug found by the end-to-end run, and a claim that had to be withdrawn

7. **Entry-decision recording appeared broken and was not.** freqtrade caches
   backtest results for a day and silently reuses them when the strategy file
   is unchanged - printing a complete result table while running nothing.
   Changes outside the strategy file are invisible to the cache key, so the
   new recording code never executed. Several earlier "re-ran the backtest"
   checks in this project were cache hits, **including the one cited as
   evidence that the result reproduced**. A genuine `--cache none` run gives
   the same -5.33% / 12 trades / PF 0.13, so the numbers held - but the
   evidence had to be re-established rather than re-worded.
8. `_log_decision` referenced `EntryDecision.binding_cap`, which lives on
   `SizingResult`. The deliberate catch-all around decision recording did its
   job (trading was unaffected) and hid the bug; the warning it logged is how
   it surfaced.

## What the deployment work added (Gate D)

- `scripts/backup.py` - snapshots live SQLite through `Connection.backup()`
  rather than `cp`, and `--verify` restores the result into a temp directory
  and checks integrity, hashes and row counts. A backup nobody has restored is
  a hope; the test suite also proves the check *can* fail by corrupting one.
- `scripts/deadman.py` - off-box heartbeat **gated on the health report**. A
  heartbeat that fires unconditionally monitors the timer, not the bot. Here a
  CRITICAL check means silence, and silence is what makes the external service
  alert. The ping URL is treated as a capability: never committed, never
  logged unmasked, https only.
- `deploy/*.service` + `*.timer` - hardened systemd units for the bot
  (dry-run only, through `safe-run.py`), the watchdog (read-only paths), the
  dead-man, a nightly verified backup and a weekly report. All verified with
  `systemd-analyze verify`.
- `deploy/README.md` - step-by-step for the operator, with a **drill** after
  each step: kill the bot and confirm the watchdog catches it; stop the
  heartbeat and confirm the alert actually reaches you; restore a backup for
  real.

`systemd-analyze verify` caught one real error: `StartLimitIntervalSec` in
`[Service]` is silently ignored, which would have produced an unbounded
restart loop with no warning. It belongs in `[Unit]`.

## Clean-room install: still not verified end to end

Faz 1's acceptance criterion was "a verified installation path in a clean
environment". Part of it is now measured, part is still open:

- `VERIFIED`: the partial-clone command (2.9 MB and ~1s, versus 109 MB and
  16,081 files for a full clone, with the repository's 61 MB APK never
  fetched); the directory-flattening step including dotfiles; and that
  `ta_lib` installs from a manylinux wheel carrying its own `.so`, so no
  TA-Lib C library or build toolchain is needed on x86_64 / Python 3.11.
- `BLOCKED`: `pip install` into a genuinely fresh venv. PyPI returned HTTP
  503 consistently while this was attempted.
- `NOT_RUN`: the 330 tests against that fresh clone.

The suite does pass in the venv built at the start of this session, but that
is not the same claim as "installs cleanly from scratch".

## The exact next step

The remaining work is **not code**. It is running the bot for 4-8 weeks on a
machine that stays up, collecting 5m data forward the whole time, and
generating a weekly report each week. `deploy/README.md` is the procedure.

This environment cannot do that: the container is ephemeral and total observed
runtime is minutes.

Reproduction:

```bash
.venv/bin/python -m pytest -m "not network"
.venv/bin/python scripts/collect-data.py --timeframes 4h
.venv/bin/python scripts/safe-run.py backtesting \
    --config config/config.dry.json --strategy BaselineTrend4h \
    --timerange 20250901-20260901 --enable-protections --fee 0.0007
```
