# Research plan

## Honest disclosure, written first

This plan was **not** fully pre-registered before any result was seen, and
saying otherwise would be the exact failure the plan is supposed to prevent.

What happened, in order:

1. A backtest was run over **2025-05-01 → 2026-09-01** as a *smoke test* -
   to prove the software executed end to end at all. Its aggregate result
   was visible (12 trades, +9.34%).
2. Warm-up length was then changed from 400 to 800 candles. That change was
   driven by recursive/warm-up analysis, not by performance - but it was
   made *after* a performance number had been seen.
3. The evaluation below was then run over **2025-09-01 → 2026-09-01**.

Consequence, stated plainly: **there is no untouched hold-out in this
session.** The available 4h history is 496-592 days per pair, and a
performance figure has been observed over essentially all of it. A genuine
hold-out now requires data that has not happened yet.

This alone caps the strongest possible verdict at
`INSUFFICIENT_EVIDENCE`, independent of any number below.

## Economic hypothesis

Crypto majors show persistent directional moves interrupted by long ranges.
The hypothesis is that a slow trend filter (EMA200 regime, EMA50 slope, ADX
confirmation) keeps capital out of the ranges and participates in the moves,
and that the resulting win-rate-below-50%/large-winner profile survives
0.14% round-trip taker fees plus slippage.

Where it should break: in a sideways market it pays entry and exit costs
repeatedly for nothing, which is the classic trend-following failure mode. It
should also lag badly at turning points, since every signal needs a completed
4h candle.

Why costs may eat the edge: at 0.14% round trip plus ~20bp assumed exit
slippage, each trade starts ~0.34% behind. With ~12-15 trades a year that is
~4-5% of annual drag against a modest expected edge.

## Fixed experiment budget

- At most **2 strategy families**: (1) EMA/ADX trend following, (2) Donchian
  breakout as a separate, later candidate.
- At most **30 parameter combinations total** across both.
- **Spent so far: 1 combination** (the baseline). No parameter search has
  been run, and no parameter was tuned against performance.

Every experiment - including manual parameter edits, indicator additions,
pair changes and period changes - is an experiment and is counted.

## Data segmentation

| Segment | Intended use | Actual status |
|---|---|---|
| Train (~60%) | parameter selection | **unused** - no search performed |
| Validation (~20%) | selection between candidates | **unused** |
| Hold-out (~20%) | one final evaluation | **contaminated** - see disclosure above |

Walk-forward: at least 3 forward windows were planned inside the pre-hold-out
segment. **Not run** - with 12-15 trades over a full year, a three-window
split would leave ~4 trades per window, which cannot support an inference.
Recorded as `NOT_RUN`, not as passed.

## Acceptance thresholds (fixed, not relaxed afterwards)

A strategy becomes `CANDIDATE_FOR_OBSERVATION` only if **all** hold:

| # | Criterion | Threshold |
|---|---|---|
| 1 | OOS net return | > 0 |
| 2 | Net profit factor | >= 1.10 |
| 3 | Max drawdown | <= 10% |
| 4 | Net result at **2x** modelled cost | > 0 |
| 5 | Closed OOS trades | >= 50 (a **review floor**, not a sufficiency guarantee) |

Failing any one means `REJECTED` or `INSUFFICIENT_EVIDENCE`. These thresholds
are not adjusted after seeing results - a threshold moved to let a result
through is not a threshold.

## Benchmarks

Same dates, same starting capital, same quote currency, comparable costs:

1. Buy and hold BTC (the same `@142`/UBTC series the strategy trades).
2. Buy and hold the equal-weight basket of the three traded assets.
3. Hold USDC, zero yield assumed. USDC is **not** risk-free; it carries
   issuer and de-peg risk. It is a cash reference, nothing more.
4. A fixed BTC/cash blend at comparable risk - **not run**, because the
   weight had to be chosen on training data and no training run exists.

Comparison rule, fixed in advance: raw return and risk are reported
**together**. Beating a long benchmark during a decline is not evidence of
edge, and losing to it during a rally is not evidence of failure. Neither
substitutes for criterion 1: a strategy that loses money does not pass
because it lost less than something else.

## Cost and fill modelling

- Entry and exit fees counted separately. Source: official schedule, spot
  tier 0, taker 0.070% both sides. Checked 2026-09-17. No discount assumed.
- Cost stress at **1x / 2x / 3x** via freqtrade's `--fee`.
- Slippage: freqtrade has **no** slippage config field, and backtesting
  assumes fills at the requested price inside the candle range. Slippage is
  therefore **not modelled inside the backtest**; the cost multipliers are a
  crude proxy, and this is labelled as such rather than presented as a fill
  model.
- Intra-candle ordering on 4h is unknowable. 5m detail exists for only
  **17 days**, which is far too short to validate a year of fills. Marked
  `NOT_MODELED`.
- Book depth history does not exist, so no capacity, queue-position or
  fill-probability claims are made.

## What a pass would still not mean

Passing this screen is not live approval. It would make the strategy eligible
for a 4-8 week dry-run observation, which is a separate gate, which is in
turn separate from the engineering and exchange-capability gates in
[LIVE_READINESS.md](LIVE_READINESS.md).
