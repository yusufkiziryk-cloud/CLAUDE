# Project state

Last updated: 2026-09-19, after the clean-room verification, the fault
injection work (T17/T18), the eligibility engine (T23), the clean-room
script (T26) and the adversarial audit. Start with the last two sections.

## Where things stand

| Phase | Status |
|---|---|
| Faz 0 - review and plan | **DONE**, approved |
| Faz 1 - safe skeleton | **DONE** - clean-room install and test run `VERIFIED` on 2026-09-19 (Docker path still `NOT_RUN` - no daemon here) |
| Faz 2 - market data | **DONE** |
| Faz 3 - strategy, risk, order correctness | **DONE** - risk layer and order lifecycle both adversarially tested |
| Faz 4 - honest research report | **DONE**, re-derived 2026-09-19 - verdict `INSUFFICIENT_EVIDENCE`, all five criteria failing on the evidence that exists (16 trades, -6.64%, PF 0.16, 10.48% mark-to-market drawdown) |
| Faz 5 - monitoring and handover | **DONE** (code) - watchdog, weekly report, dashboard, deployment units; the 4-8 week observation itself cannot be run here |
| Faz 6 - live readiness assessment | **DONE** - live remains blocked |

Tests: **466 passing** offline, **470** including public-endpoint tests.

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

- **Fault injection is against models of the faults** (a fake venue, a
  scripted HTTP session, ENOSPC raised from the writer's own syscalls, a
  page-capped SQLite). Real 429s and a real full disk have not been seen.
- **External balance change has no detector** (T14 `PARTIAL`). A dry run
  cannot see a deposit; live would need one.
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

## Clean-room install: verified (2026-09-19)

Faz 1's acceptance criterion - "a verified installation path in a clean
environment" - is now measured end to end:

- A fresh sparse clone at `7c03d14`, `python3 -m venv`, `pip install -r
  requirements.txt` from a cold cache: `PIP_EXIT=0` (freqtrade 2026.8, ccxt
  4.5.81, pandas 3.0.6, TA-Lib 0.7.1). First attempt failed on `No module
  named pytest`: the test runner was in the lock file but not in
  `requirements.txt`. Fixed; that is a real D1 defect the clean room found.
- 330/330 tests in that clone once the collected data was copied in (324 +
  6 data-dependent skips without it).
- `scripts/cleanroom-verify.sh` (T26) automates the whole path - clone,
  lock-file install, tests, `--cache none` backtest, comparison with
  `reports/faz4/expected_backtest.json` - and reported `REPRODUCED`.
- `deploy/install.sh` (D1+D2+D6 in one idempotent script) was exercised
  unprivileged (`--skip-apt --skip-user --skip-systemd`): clone, venv,
  lock-file install, tests `VERIFIED`. The apt/user/systemd stages are
  `NOT_RUN` here (no root, no systemd).

Version drift is real: `requirements.txt` alone pulled ccxt 4.5.81 / pandas
3.0.6 two days after the lock recorded 4.5.78 / 3.0.5. The tests passed on
both; reproduction uses the lock.

## What the fault injection work added (T17, T18, T23, T26)

- `tests/test_fault_injection_t17.py` (27 tests): 429/5xx/disconnect
  injected into order create, cancel and resolve, and into the HTTP client.
  Every transport fault on the order path is `UNKNOWN`, never a second
  order; the emergency exit stops at the first unknown; the client's retry
  is bounded and read-only.
- `tests/test_fault_injection_t18.py` (17 tests): ENOSPC at three syscalls,
  SQLite full, a held write lock, garbage and truncated state files, damaged
  backup snapshots. **Three real defects fell out:** `_tx` masked the real
  error with a failing ROLLBACK; the watchdog crashed on a corrupt state
  file instead of reporting it; `verify_backup` crashed on a malformed
  snapshot instead of failing it.
- `src/kripto/research/eligibility.py` + `scripts/eligibility.py`: the
  research plan's criteria applied by code. It reproduces the report's
  verdict from the archives and refuses to promote anything on a
  contaminated hold-out or an exhausted experiment budget.
- `scripts/risk-state.py`: the operator's hand for `RECOVERY_REQUIRED`,
  operator locks and stuck reservations, with `--operator-ack` and a reason
  written into the state.

## The 2026-09-19 audit, in one paragraph

Ten independent adversarial reviewers, one per subsystem, produced 56 unique
findings; 55 were fixed with regression tests and one was refuted by
measurement (`docs/AUDIT_2026-09-19.md`). The important ones were at the
seams: reservations leaked on ordinary fills and locked the bot after three
trades (which is what the 12-trade research result was); reconciliation
flagged the bot's own first trade as foreign; approved stops lived in
process memory and did not survive a restart; equity was cost-basis, so
open losses never reached the limits; the consecutive-stop and pair-cooldown
limits were never fed; the launcher audited a different file from the one
freqtrade ran when no `--config` was given; log redaction did not reach
freqtrade's handlers; the watchdog unit was bound to the bot and died with
it. The research numbers were re-derived twice as the fixes landed; the
verdict stayed `INSUFFICIENT_EVIDENCE`.

## Bugs the audit and the injections found, continued

9. **Reservation leak on one-step-short fills and abandoned entries** -
   the origin of the 12-trade result.
10. **Reconcile against an empty ledger** - `RECOVERY_REQUIRED` after the
    first trade.
11. **Cost-basis equity** - limits blind to open losses.
12. **Stop counter never decayed** - three stops locked the bot for ever.
13. **Config resolution** - audited `config.dry.json`, ran `./config.json`.
14. **Redaction blind to child loggers and late handlers.**
15. **Forming candle persisted as history.**
16. **`BindsTo` killed the watchdog with the bot.**
17. Three T18 crashes (above), and two vacuous tests that a mutation could
    not fail.

## The exact next step

The remaining work is **not code**. It is running the bot for 4-8 weeks on a
machine that stays up, collecting 5m data forward the whole time, and
generating a weekly report each week. `deploy/install.sh` installs it;
`deploy/README.md` is the procedure and the drills.

This environment cannot do that: the container is ephemeral and total observed
runtime is minutes. Two things on that machine remain `UNVERIFIED` until it
exists: the watchdog unit reading a WAL database under `ReadOnlyPaths`, and
the apt/user/systemd stages of `install.sh`.

Reproduction:

```bash
.venv/bin/python -m pytest -m "not network"
scripts/cleanroom-verify.sh --data-from user_data/data/hyperliquid --backtest
.venv/bin/python scripts/eligibility.py --result <1x.zip> --result-2x <2x.zip> --experiments-used 1
```
