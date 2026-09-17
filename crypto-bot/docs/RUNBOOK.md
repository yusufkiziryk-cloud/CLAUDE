# Runbook

Operator procedures. Every command here was run in this repository except
where marked `NOT_RUN`.

## Install

```bash
cd crypto-bot
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt      # or requirements.lock.txt for the exact set
.venv/bin/python -m pytest -m "not network"    # 176 tests, ~4s
```

Python >= 3.11. freqtrade is pinned to 2026.8 deliberately: this project's
safety checks read freqtrade internals, and an unpinned upgrade could turn a
real check into a no-op. `tests/test_capabilities.py` fails loudly if the
pinned assumptions change.

## Collect market data

`freqtrade download-data` does **not** work for Hyperliquid
(`ohlcv_has_history: False`). Use:

```bash
.venv/bin/python scripts/collect-data.py                     # 4h, 1h, 5m
.venv/bin/python scripts/collect-data.py --timeframes 4h     # incremental refresh
```

Re-running is safe and idempotent: it merges on `(exchange, market_id,
timeframe, open_time)` and rewrites atomically. Writes
`reports/data_manifest.json` with coverage, gaps and hashes.

Public reads only. No credentials are used, requested or accepted.

## Start and stop

```bash
# dry run (no real orders, no keys)
.venv/bin/python scripts/safe-run.py trade --config config/config.dry.json

# backtest
.venv/bin/python scripts/safe-run.py backtesting \
    --config config/config.dry.json --strategy BaselineTrend4h \
    --timerange 20250901-20260901 --enable-protections
```

Behind a TLS-terminating proxy, append
`--config config/proxy-overlay.json`. ccxt sets `trust_env=False`, so the
standard CA and proxy variables are otherwise ignored. TLS verification stays
on; never disable it.

`scripts/safe-run.py` is the only supported entry point. It refuses to start
unless the **effective** configuration - files, environment and CLI combined,
computed by freqtrade's own loader - is a keyless dry run. It has no flag
that enables live trading.

### Three different actions, often confused

| Intent | Action | Effect on open positions |
|---|---|---|
| Stop taking new risk | set the risk state to `ENTRY_PAUSED` | stops and exits **keep running** |
| Close positions | operator does this manually on the exchange | positions closed |
| Stop the process | Ctrl-C / `docker compose down` | **the bot-internal stop stops too** |

**Killing the process is not a risk stop.** Because Hyperliquid spot has no
exchange-side stop, an open position left behind by a stopped process has no
protection at all. Close positions first, or accept that exposure knowingly.

## Docker

```bash
docker compose up -d          # NOT_RUN: no Docker daemon in the build environment
docker compose logs -f
docker compose down
```

The image is pinned by immutable digest, runs as a non-root user with
`no-new-privileges`, drops all capabilities, mounts a read-only root and does
**not** mount the Docker socket. No ports are published.

This path has never been started here. Verify it on your own machine before
relying on it.

## Watchdog

```bash
.venv/bin/python scripts/watchdog.py --state user_data/dryrun/risk_state.sqlite
.venv/bin/python scripts/watchdog.py --state ... --interval 60    # keep watching
.venv/bin/python scripts/watchdog.py --state ... --json           # machine readable
```

Exit code: `0` healthy, `1` warning, `2` critical - so cron or a supervisor
can act on it without parsing the text.

It opens the state file **read-only** (SQLite `mode=ro`), so it cannot write
even if asked to. It holds no credentials, sends no orders and is not a
standby trader.

What it measures, and why none of it is "is the process up":

| Check | Catches |
|---|---|
| `loop_heartbeat` | the process is alive but the loop has stopped going round |
| `candle_freshness` | the data feed is behind, measured against the expected last **closed** candle |
| `orderbook_freshness` | the book snapshot is stale - a **separate clock** from candle age |
| `reconcile_age` | records have drifted from the authoritative ledger |
| `clock_skew` | local and venue clocks disagree |
| `api_error_rate` | the venue is failing too often to act on its answers |
| `pending_orders` | an order has been pending far too long |
| `storage` | not enough free disk to guarantee a durable write |
| `notifications` | nobody would see an alert |

A completed 4h candle is legitimately **4 to 8 hours old**, so candle
freshness compares against the expected last closed candle rather than a flat
age. An order book snapshot that old would be meaningless, which is why the
two have separate thresholds. Sharing one would give you either constant
false alarms or a blind spot.

The bot also runs these checks in-process each loop and pauses **entries** on
its own when they fail. No check can ever stop exit management: the strongest
action available is halting entries or calling a human.

### What the watchdog cannot do

A watchdog on the same host cannot tell you the host died - it dies with it.
For that you need a heartbeat to something off-box (a dead-man switch: the bot
pings an external service, and the service alerts when the pings stop).

This repository does **not** start, configure or pay for such a service. If
you want one, you choose and run it. Until then, accept that a host failure
is silent - which matters more here than usual, because with no exchange-side
stop an unmanaged position has no protection at all.

## Restart

1. The bot starts in `RECONCILING` and takes no entries.
2. It must agree with the exchange on balances, open orders and fills before
   returning to `READY`.
3. If records cannot be reconciled, it goes to `RECOVERY_REQUIRED` and waits
   for a human. It does **not** guess at positions.
4. Period baselines, the peak-equity watermark, locks and the stop counter
   all survive the restart. A restart cannot erase a day's loss.

An unrecognised position or a manually placed order is never adopted,
cancelled or closed automatically. Entries stop and the operator is told.

## Outage

| Symptom | Action |
|---|---|
| Exchange unreachable | entries stop on stale data; exits keep trying; do not restart in a loop |
| Bot process dead with an open position | **no stop is active** - decide manually on the exchange |
| Notifications down | trading is unaffected; after the configured outage window entries stop |
| Disk full / DB error | no new entries; existing exit management continues as far as it can |
| Drawdown lock raised | entries are locked until a human acknowledges - by design |

## Notifications (optional)

The bot runs with no Telegram token and no chat id. There is deliberately no
`telegram` block in `config/config.dry.json`: freqtrade's schema requires a
token whenever the block exists, even when disabled, so an empty block would
force a placeholder secret into a committed file.

To enable, create an uncommitted overlay and pass it after the main config.
Never commit it. Remote buy/sell, force-entry and any go-live command stay
disabled.

## Secrets

- Dry-run and research need **no** credentials at all.
- `.env.example` contains none and must never contain any.
- The launcher refuses to start if any credential field or
  `FREQTRADE__*KEY*/*SECRET*/*WALLET*` variable is present.
- Log redaction masks keys, wallet addresses, tokens, bearer headers and URL
  query values, in messages and in tracebacks.
- If a real key is ever used in future: use a Hyperliquid **API wallet**,
  never the main wallet key or the seed phrase. `walletAddress` is the main
  wallet address; `privateKey` belongs to the API wallet. Getting these
  backwards shows an empty balance - never read that as "new account".

### Key revocation

Revocation happens on the exchange, not here: revoke the API wallet in the
Hyperliquid interface, then remove it from the operator's secret store. This
repository has no code that can create, rotate or revoke a credential.

## Backup and rollback

Worth keeping: `config/policy.yaml`, `user_data/dryrun/*.sqlite` (trades and
risk state) and `reports/`. Market data is reproducible with the collector.

Rollback = check out the previous commit and reinstall the pinned
requirements. Risk-state files are forward-compatible only: an unknown schema
version is refused rather than migrated silently.
