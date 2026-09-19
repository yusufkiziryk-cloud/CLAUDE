# Live readiness

**Status: NOT READY. Live trading is blocked.**

Nothing in this repository can enable live trading, and this document does
not authorise it. Going live is a manual operator procedure that a human
performs deliberately, with their own capital decision, on infrastructure
this session never touched.

The operator-executed checklist that goes with this report is
[GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md). It lists what must be true and
what the operator must do by hand. It is a checklist, not an approval, and
nothing in this repository executes it.

## Gates

Each gate is assessed separately. All must pass; none substitutes for another.

| # | Gate | Status |
|---|---|---|
| 1 | Software builds and runs from a clean environment | **PASS** (2026-09-19: fresh clone, cold install, 330/330 tests, backtest reproduced by `scripts/cleanroom-verify.sh`; Docker path still `NOT_RUN`) |
| 2 | Critical safety and risk tests verified | **PARTIAL** - 25 of 26 matrix rows `VERIFIED` after the audit; T14's external-balance-change half has no detector |
| 3 | Exchange capabilities and data verified | **PARTIAL** |
| 4 | Sufficient out-of-sample evidence for the strategy | **FAIL** |
| 5 | Dry-run observation completed (4-8 weeks) | **NOT STARTED** |
| 6 | Operations infrastructure in place | **NOT STARTED** |
| 7 | Operator's explicit capital and risk decision | **NOT ASKED** |

## Blockers

### LIVE_BLOCKER 1 - no exchange-side stop on Hyperliquid spot

`Hyperliquid._ft_has["stoploss_on_exchange"] is False` for spot in freqtrade
2026.8. It is `True` only for futures, which is out of scope.

The stop therefore lives **inside the bot process**. If the process, the host
or the network dies while a position is open, nothing protects it.

A watchdog is not an equivalent - a watchdog on the same host dies with the
host. A VPS is not an equivalent either. And a native stop would not be a
guarantee either: it can still fail to fill on a gap. But "bot-internal stop
only" is strictly weaker than "native stop", and that gap is the blocker.

**This document does not grant an exception.** If the operator later chooses
to accept bot-internal stop risk, that requires a separate, dated, explicit
risk acceptance naming this specific gap. The alternative is a venue with
native spot stops, verified for the operator's own access - which nobody
should switch to on a bot's recommendation alone.

### LIVE_BLOCKER 2 - bridged assets, single issuer

The traded instruments are UBTC/UETH/USOL (market ids `@142`, `@151`,
`@156`), not native BTC/ETH/SOL. They are bridge-issued wrappers from one
issuer, so all three carry the same bridge and issuer counterparty risk on
top of price risk. ccxt's naming hides this: it presents them as `BTC/USDC`
etc.

### LIVE_BLOCKER 3 - no evidence of positive expectancy

See [the research report](../reports/faz4/RESEARCH_REPORT.md). Verdict
`INSUFFICIENT_EVIDENCE`; on the evidence available the strategy fails all
five pre-set criteria (16 closed trades, -6.64%, PF 0.16, 10.48%
mark-to-market drawdown, negative at 2x cost). One market regime, no
untouched hold-out. The earlier 12-trade figure was an artefact of a
bookkeeping defect the audit found; the corrected run is worse, not better.

### LIVE_BLOCKER 4 - monitoring exists but has never been observed running for long (reduced again)

The order lifecycle and the monitoring layer are built and tested. A
stateful fake venue exercises cancel/fill races, lost responses, crash
recovery, duplicated and reordered events, bounded emergency repricing and
single-writer enforcement (T08-T11, T16, T22); transport faults (429, 5xx,
disconnect) and filesystem faults (ENOSPC, SQLite full, corrupt files) are
now injected too (T17, T18). The 2026-09-19 audit then found and fixed 55
defects at the seams between these layers - several of which would have
stopped the dry run within its first three trades
([`AUDIT_2026-09-19.md`](AUDIT_2026-09-19.md)).

What remains:

- **The fixed integration has not run for weeks.** The defects were found
  by review and pinned by tests, not by observation; the observation period
  is what will show whether the seams now hold.
- **External balance change has no detector** (T14 `PARTIAL`).
- **Venue-side reconciliation is `PARTIAL`.** In a dry run nothing was ever
  sent, so the loop reconciles our bookkeeping against freqtrade's simulated
  ledger. Reconciling against a real venue is untested by construction.
- **A same-host watchdog cannot report a dead host.** A dead-man heartbeat to
  an off-box service would cover it; this repository does not start or pay
  for one. Combined with LIVE_BLOCKER 1, a host failure means an unmanaged
  position and nobody told.
- **Total runtime observed: minutes, not weeks.** See LIVE_BLOCKER 5.

### LIVE_BLOCKER 5 - no observation period

Zero of the required 4-8 weeks have been run. This session's container is
ephemeral, so the observation cannot even be started here.

### LIVE_BLOCKER 6 - unverified account-side permissions

That an API wallet genuinely cannot withdraw, and that it is genuinely
restricted to spot **on the exchange side**, is `UNVERIFIED`. A software
setting is not an exchange-enforced permission. Note also that an inability
to withdraw does not mean an inability to cause loss.

## Remaining uncertainties

- Client-order-id (`cloid`) support through the freqtrade adapter is
  `UNVERIFIED`. Without proven exactly-once semantics, a conservative
  single-pending-intent model is required.
- Intra-candle fill behaviour is `NOT_MODELED`; 5m data covers 17 days.
- No order-book depth history exists, so capacity is unproven.
- Docker Compose was never started in this environment (no daemon), so the
  container path is `NOT_RUN`.

## What this session did NOT do

- did not run a single live or test-net order
- did not create, request, read or store any credential
- did not write any withdrawal, transfer, staking or bridging code
- did not open an account, buy a server or enable a paid service
- did not write a tool, timer, command or button that switches to live
