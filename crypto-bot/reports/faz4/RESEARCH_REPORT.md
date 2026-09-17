# Research report - BaselineTrend4h

**Verdict: `INSUFFICIENT_EVIDENCE`, and on the evidence that does exist the
strategy `FAILS` the pre-set screen.**

It is not a candidate for observation. Run date 2026-09-17.

## Run identity

| | |
|---|---|
| Strategy | `BaselineTrend4h` |
| Engine | freqtrade 2026.8, ccxt 4.5.78, Python 3.11.15 |
| Policy | `baseline-dryrun-v1`, `sha256:6018da0d…` |
| Exchange / mode | Hyperliquid, spot, long-only, no leverage |
| Pairs | `BTC/USDC` (@142/UBTC), `ETH/USDC` (@151/UETH), `SOL/USDC` (@156/USOL) |
| Period | 2025-09-01 → 2026-09-01 (12 months) |
| Warm-up | 800 candles (~133 days) consumed before the period |
| Data | `reports/data_manifest.json` |
| Starting capital | 1000 USDC simulated |

## Result

| Cost scenario | Trades | Net return | Profit factor | Expectancy/trade | Max DD |
|---|---:|---:|---:|---:|---:|
| **1x** (taker 0.070% both sides) | 12 | **-5.33%** | **0.13** | -4.44 USDC | 5.70% |
| 2x | 15 | -7.65% | 0.09 | -5.10 USDC | 7.98% |
| 3x | 14 | -6.92% | 0.09 | -4.94 USDC | 7.22% |

Per pair at 1x: ETH/USDC -0.12%, BTC/USDC (remainder), SOL/USDC -4.40%.
Sharpe (daily wallet) -1.05, Sortino -0.43, Calmar -3.44.

Trade counts differ across cost scenarios because a changed fee changes
realised equity, which changes what the risk budget permits next. That is the
risk layer behaving as designed, not noise in the measurement.

## Against the fixed thresholds

| # | Criterion | Threshold | Actual | Result |
|---|---|---|---|---|
| 1 | OOS net return | > 0 | **-5.33%** | **FAIL** |
| 2 | Net profit factor | >= 1.10 | **0.13** | **FAIL** |
| 3 | Max drawdown | <= 10% | 5.70% | pass |
| 4 | Net at 2x cost | > 0 | **-7.65%** | **FAIL** |
| 5 | Closed OOS trades | >= 50 | **12** | **FAIL** |

Four of five fail. No threshold was moved.

## Benchmarks, same period, same data

| | Return | Max DD |
|---|---:|---:|
| **BaselineTrend4h** | **-5.33%** | **5.70%** |
| Buy & hold BTC (UBTC) | -26.95% | 53.54% |
| Buy & hold ETH (UETH) | -44.02% | 67.58% |
| Buy & hold SOL (USOL) | -48.10% | 75.14% |
| Equal-weight basket | -39.69% | 64.17% |
| Hold USDC (0% yield assumed) | 0.00% | 0.00% |

The period was a severe decline: the basket lost 39.7% with a 64% drawdown.
The strategy lost 5.3% with a 5.7% drawdown.

Both halves of that matter, and the pre-set comparison rule says so:

- The trend filter **did** do its job - it kept capital out of most of the
  decline, and the drawdown difference (5.7% vs 64%) is an order of
  magnitude, not a rounding difference.
- It still **lost money**, and it lost to simply holding cash. Criterion 1 is
  absolute: losing less than a falling benchmark is not a positive expectancy.

Beating a long benchmark in a bear market is close to the weakest possible
evidence of edge, because any strategy that is mostly flat will do it. This
result is consistent with "the filter works" and equally consistent with
"the filter is expensive and the market simply fell" - one year and 12 trades
cannot separate those.

## Why the evidence is insufficient regardless of the numbers

1. **12 closed trades.** The review floor is 50. Twelve trades over three
   correlated, same-issuer assets is nowhere near enough to distinguish a
   negative expectancy from bad luck.
2. **One regime.** The whole period is a downtrend. A trend-following
   strategy has not been observed in the regime it exists for.
3. **No untouched hold-out.** See the disclosure in
   [RESEARCH_PLAN.md](../../docs/RESEARCH_PLAN.md). A performance figure was
   seen over essentially all available history before this run.
4. **Correlated observations.** The three pairs are one bridge issuer and
   move together. Twelve trades are not twelve independent observations, and
   they are not treated as such. No block bootstrap was run: with 12
   observations the interval would be wider than the effect.
5. **Walk-forward not run** (`NOT_RUN`). Three windows would leave ~4 trades
   each.

## What is not modelled

| Item | Status | Why |
|---|---|---|
| Slippage inside the backtest | `NOT_MODELED` | freqtrade has no slippage field; backtesting fills at the requested price inside the candle range. Cost multipliers are a proxy, not a fill model. |
| Intra-candle fill ordering | `NOT_MODELED` | 4h candles hide the path; 5m detail exists for only 17 days |
| Queue position / capacity | `NOT_MODELED` | no order-book depth history exists |
| Exchange-side stop behaviour | `NOT_MODELED` | none exists on Hyperliquid spot |
| Reconciliation / restart paths | `NOT_EXERCISED` | a backtest has no exchange to reconcile with; covered by unit and integration tests instead |
| Production risk policy under `lookahead-analysis` | `NOT_EXERCISED` | the tool forces `dry_run_wallet = 1e9` and `stake_amount = 10000` |

## Leak and stability checks

| Check | Result |
|---|---|
| Truncating the future changes the past | **no** - signals and indicators bit-identical |
| Mutating future prices (x3) changes the past | **no** |
| Mutating one far-future candle (x10) changes the past | **no** |
| freqtrade `recursive-analysis`, indicators only | "No lookahead bias on indicators found" |
| freqtrade `lookahead-analysis` on `BaselineTrend4h` | **bias reported** (2 entry, 2 exit) |
| freqtrade `lookahead-analysis` on the stateless twin | **no bias detected** (0, 0) |

The tool's bias report on the real strategy is a **false positive from
statefulness**, not a leak. `lookahead-analysis` re-runs a strategy over
several time ranges and compares the trades, assuming the strategy is a pure
function of the dataframe. `BaselineTrend4h` is not: its risk store carries
reservations, locks and a peak-equity watermark across those runs. Running
the identical signal logic with the risk gate removed
(`DiagnosticTrend4hNoRisk`) reports no bias, and the direct causality tests
in `tests/test_lookahead_t20.py` show the signals are causal.

This is an interpretation, not a proof of the risk layer's innocence: the
tool simply cannot evaluate a stateful strategy. The risk layer's freedom
from future information rests on its unit tests, not on this tool.

## Warm-up sensitivity

`recursive-analysis` put EMA200 drift at **-3.135%** with a 200-candle
warm-up, -0.204% at 400, -0.001% at 1000. Indicator drift alone does not
settle it, so signal impact was measured directly on BTC/USDC over three
evaluation windows against a 1600-candle reference:

| Warm-up | Differing entry signals (800 / 1200 / 1500 window) |
|---:|---|
| 200 | 4 / 5 / 3 |
| 300 | 3 / 6 / 2 |
| 400 | 1 / 2 / 2 |
| 600 | 0 / **2** / 0 |
| **800** | **0 / 0 / 0** |

600 looked converged in two windows and was still wrong in the third - which
is why one window is not a measurement. `startup_candles` is set to 800.

## What would change this verdict

Not a parameter search. The failure is not "the numbers are close"; it is
that 12 trades in one regime cannot support any conclusion.

1. Accumulate forward data. 4h history is bounded by listing date and cannot
   be extended backwards; 5m must be collected going forward regardless.
2. Re-evaluate once a genuinely unseen period contains >= 50 closed trades,
   including at least one uptrend.
3. Only then consider the Donchian breakout candidate, within the remaining
   29-of-30 combination budget.

Rejecting the strategy does not invalidate the software. The engineering
work, the risk layer and the test matrix stand on their own and are what the
next evaluation will run on.
