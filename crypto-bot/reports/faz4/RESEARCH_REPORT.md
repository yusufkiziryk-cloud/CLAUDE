# Research report - BaselineTrend4h

**Verdict: `INSUFFICIENT_EVIDENCE`, and on the evidence that does exist the
strategy `FAILS` every one of the pre-set criteria.**

It is not a candidate for observation. Evaluation re-run on 2026-09-19 after
the adversarial audit; the verdict is produced by
`scripts/eligibility.py` (`reports/faz4/eligibility.json`), not by hand.

> **Correction history - read this first.** Three sets of numbers exist for
> this strategy over this period, and only the last one stands:
>
> | Date | Result | Why it is superseded |
> |---|---|---|
> | 2026-09-17 | 12 trades, -5.33%, PF 0.13 | **Invalid.** The risk layer leaked a reservation on every entry whose fill was one exchange step short (16.9% of entries) and on every entry freqtrade abandoned; after three leaks the bot refused all further entries. The backtest was crippled by a bookkeeping defect, not by the market. |
> | 2026-09-19, first re-run | 30 trades, +1.32%, PF 1.12, 8.60% closed-trade drawdown | **Under-modelled policy.** Period baselines, the equity peak and the loss/drawdown locks were evaluated only when an entry signal fired. The live loop evaluates them every iteration; a backtest that samples them only at signals lets an open position breach a limit unnoticed. Mark-to-market this run drew down 10.97%, past the 10% limit the running bot would have locked on. |
> | **2026-09-19, definitive** | **16 trades, -6.64%, PF 0.16, 10.48% mark-to-market drawdown** | Limits observed on every candle, exactly as the running bot observes them every loop. This is the number the policy actually produces. |
>
> The numbers moved because defects were fixed, in both directions. None of
> the thresholds moved. All three runs were made with `--cache none`.

## Run identity

| | |
|---|---|
| Strategy | `BaselineTrend4h` |
| Engine | freqtrade 2026.8, ccxt 4.5.78, pandas 3.0.5, Python 3.11.15 |
| Policy | `baseline-dryrun-v1` |
| Exchange / mode | Hyperliquid, spot, long-only, no leverage |
| Pairs | `BTC/USDC` (@142/UBTC), `ETH/USDC` (@151/UETH), `SOL/USDC` (@156/USOL) |
| Period | 2025-09-01 → 2026-09-01 (12 months) |
| Warm-up | 800 candles (~133 days) consumed before the period |
| Data | `reports/data_manifest.json` |
| Starting capital | 1000 USDC simulated |
| Reference archive | `backtest-result-2026-09-19_17-06-17.zip`; `reports/faz4/expected_backtest.json` pins it for `scripts/cleanroom-verify.sh --backtest` |

## Result

| Cost scenario | Trades | Net return | Profit factor | Expectancy/trade | Max DD (closed-trade) |
|---|---:|---:|---:|---:|---:|
| **1x** (taker 0.070% both sides) | 16 | **-6.64%** | **0.16** | -4.15 USDC | 7.41% |
| 2x | 14 | -7.29% | 0.09 | -5.21 USDC | 7.62% |
| 3x | 14 | -7.69% | 0.08 | -5.49 USDC | 8.00% |

Mark-to-market (open positions valued every candle) the 1x run's equity fell
**10.48%** from its peak, on 2026-04-10. The bot's own `MAX_DRAWDOWN` lock
fired on 2026-04-08 at 10.17% and, as designed, never cleared: the last
five months of the period produced 18 refused signals and no entries.

Per pair at 1x: BTC/USDC 5 trades -1.38%, ETH/USDC 7 trades -1.74%, SOL/USDC
4 trades -3.53%. Exits: 10 by trend end (-1.38% in total), 6 by stop
(-5.26%). Win rate 3/16. Sharpe -0.72, Sortino -1.13, Calmar -4.69. Longest
losing streak 10; a `CONSECUTIVE_STOPS` lock fired once (2026-03-18).

Trade counts differ across cost scenarios because a changed fee changes
realised and unrealised equity, which changes what the risk budget and the
locks permit next. That is the risk layer behaving as designed.

## Against the fixed thresholds

Produced by `scripts/eligibility.py --result <1x> --result-2x <2x>
--experiments-used 1` (the hold-out is not attested untouched; see below):

| # | Criterion | Threshold | Actual | Result |
|---|---|---|---|---|
| 1 | OOS net return | > 0 | **-6.64%** | **FAIL** |
| 2 | Net profit factor | >= 1.10 | **0.16** | **FAIL** |
| 3 | Max drawdown (mark-to-market) | <= 10% | **10.48%** | **FAIL** |
| 4 | Net at 2x cost | > 0 | **-7.29%** | **FAIL** |
| 5 | Closed OOS trades | >= 50 | **16** | **FAIL** |

Five of five fail. No threshold was moved. Criterion 3 uses the
mark-to-market drawdown (the larger of freqtrade's closed-trade figure and
the wallet series); the policy limit applies to equity including open
positions, and judging it on closed trades alone would have passed a run the
running bot locked.

## Benchmarks, same period, same data

| | Return | Max DD |
|---|---:|---:|
| **BaselineTrend4h** | **-6.64%** | **10.48%** (mark-to-market) |
| Buy & hold BTC (UBTC) | -26.95% | 53.54% |
| Buy & hold ETH (UETH) | -44.02% | 67.58% |
| Buy & hold SOL (USOL) | -48.10% | 75.14% |
| Equal-weight basket | -39.69% | 64.17% |
| Hold USDC (0% yield assumed) | 0.00% | 0.00% |

The period was a severe decline: the basket lost 39.7% with a 64% drawdown.
The strategy lost 6.6% with a 10.5% drawdown, then its own drawdown lock
took it out of the market for the final five months.

Both halves matter, and the pre-set comparison rule says so: the filter kept
capital out of most of the decline, and it still lost money and lost to
holding cash. Criterion 1 is absolute. Beating a long benchmark in a bear
market is close to the weakest possible evidence of edge, because any
strategy that is mostly flat will do it.

## Why the evidence is insufficient regardless of the numbers

1. **16 closed trades.** The review floor is 50. Sixteen trades over three
   correlated, same-issuer assets cannot distinguish a negative expectancy
   from bad luck - and cannot distinguish a positive one either.
2. **One regime.** The whole period is a downtrend. A trend-following
   strategy has not been observed in the regime it exists for.
3. **No untouched hold-out.** See the disclosure in
   [RESEARCH_PLAN.md](../../docs/RESEARCH_PLAN.md). A performance figure was
   seen over essentially all available history before this run, and now
   three of them have been.
4. **Correlated observations.** The three pairs are one bridge issuer and
   move together. No block bootstrap was run: with 16 observations the
   interval would be wider than the effect.
5. **Walk-forward not run** (`NOT_RUN`). Three windows would leave ~5 trades
   each.
6. **The policy dominates the result.** After the drawdown lock on
   2026-04-08 the strategy could not trade. What the period measures is the
   strategy *under this policy*, which is the only thing that will ever run;
   but it means the strategy's own behaviour in the last five months is
   unobserved.

## What is not modelled

| Item | Status | Why |
|---|---|---|
| Slippage inside the backtest | `NOT_MODELED` | freqtrade has no slippage field; backtesting fills at the requested price inside the candle range. Cost multipliers are a proxy, not a fill model. |
| Intra-candle fill ordering | `NOT_MODELED` | 4h candles hide the path; 5m detail exists for 19 days |
| Liquidity gate (spread, depth, volume) | `NOT_MODELED` | needs a live L2 book; declared in `coverage.py`, enforced in dry run only |
| Queue position / capacity | `NOT_MODELED` | no order-book depth history exists |
| Exchange-side stop behaviour | `NOT_MODELED` | none exists on Hyperliquid spot |
| Abandoned-entry sweep, approval persistence across restarts | `NOT_MODELED` | a backtest never abandons or restarts; covered by unit tests |
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
| Audit claim "backtest sizes from the incomplete current candle" | **REFUTED** by measurement: a diagnostic subclass printed the dataframe the strategy sees at entry time; at `now=2025-09-11 20:00` its last row was the `16:00` candle, i.e. the last *closed* one (freqtrade 2026.8 slices the frame before the row being traded). The strategy now enforces this explicitly (`_closed_candles`) rather than relying on it; results were bit-identical before and after. |

The tool's bias report on the real strategy is a **false positive from
statefulness**, not a leak. `lookahead-analysis` re-runs a strategy over
several time ranges and compares the trades, assuming the strategy is a pure
function of the dataframe. `BaselineTrend4h` is not: its risk store carries
reservations, locks and a peak-equity watermark across those runs. Running
the identical signal logic with the risk gate removed
(`DiagnosticTrend4hNoRisk`) reports no bias, and the direct causality tests
in `tests/test_lookahead_t20.py` show the signals are causal.

## Warm-up sensitivity

`recursive-analysis` put EMA200 drift at **-3.135%** with a 200-candle
warm-up, -0.204% at 400, -0.001% at 1000. Signal impact was measured directly
on BTC/USDC over three evaluation windows against a 1600-candle reference:

| Warm-up | Differing entry signals (800 / 1200 / 1500 window) |
|---:|---|
| 200 | 4 / 5 / 3 |
| 300 | 3 / 6 / 2 |
| 400 | 1 / 2 / 2 |
| 600 | 0 / **2** / 0 |
| **800** | **0 / 0 / 0** |

`startup_candles` is set to 800.

## What would change this verdict

Not a parameter search. The failure is not "the numbers are close"; it is
that 16 trades in one regime, under a policy that removed the strategy from
the market for five months, cannot support any conclusion.

1. Accumulate forward data. 4h history is bounded by listing date and cannot
   be extended backwards; 5m must be collected going forward regardless.
2. Re-evaluate once a genuinely unseen period contains >= 50 closed trades,
   including at least one uptrend, with `scripts/eligibility.py
   --holdout-untouched` attested by a human who has not looked.
3. Only then consider the Donchian breakout candidate, within the remaining
   29-of-30 combination budget.

Rejecting the strategy does not invalidate the software. The engineering
work, the risk layer and the test matrix stand on their own and are what the
next evaluation will run on - and the audit that produced this correction is
recorded in `docs/AUDIT_2026-09-19.md`.
