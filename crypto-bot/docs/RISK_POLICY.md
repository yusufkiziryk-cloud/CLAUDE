# Risk policy

Machine-readable source of truth: `config/policy.yaml`, validated by
`src/kripto/policy.py`. Everything here describes that file.

**These are dry-run starting assumptions. They are not investment advice, not
a proven optimum, and no live risk budget is approved by this document.**

## Limits

| Policy | Value | Meaning |
|---|---:|---|
| Simulated capital | 1000 USDC | not a real balance |
| Risk per trade | 1% | budgeted loss to the modelled stop, fees included |
| Max open positions | 3 | pending entries occupy a slot |
| Max total open risk | 3% | open **and** pending together |
| Per-asset notional | 25% of equity | on top of the risk cap |
| Portfolio notional | 75% of equity | leaves cash and a fee reserve |
| Daily loss limit | 3% | from 00:00 UTC, open **and** closed results |
| Weekly loss limit | 6% | from Monday 00:00 UTC |
| Drawdown from peak | 10% | permanent entry lock, operator review required |
| Consecutive stops | 3 → >= 24h | portfolio-wide |
| Per-pair cooldown | 2 completed 4h candles | a new trigger is still required |
| Fee reserve | 1% of equity | held back so fees cannot overdraw cash |

BTC, ETH and SOL here are **UBTC/UETH/USOL**, all issued by the same bridge.
They are one risk bucket (`crypto-unit-bridged`), never three independent
risks, and the bucket is never widened because correlation looked lower for a
while.

## Position sizing

```text
E      = current total equity of the bot-owned portfolio
R      = E x risk_per_trade
P_in   = worst entry price we will accept
P_stop = the strategy's initial stop price
P_out  = P_stop x (1 - exit_slippage_assumption)
L      = (P_in - P_out) + P_in x entry_fee + P_out x exit_fee
q_risk = R / L
q      = floor_to_step( min( q_risk, cash, asset_notional,
                             portfolio_notional, remaining_risk, liquidity ) )
```

`L` is the modelled loss **per base unit**: the price drop, plus the fee in,
plus the fee out. Every cap is converted to base-asset units before the
`min()`, so a quote amount is never compared against a base amount.

Refused unless all hold: `0 < P_out <= P_stop < P_in`, `L` positive and
finite, valid fee and slippage fractions, and fresh equity.

Worked example (from `tests/test_sizing.py`, computed by hand):
E=1000, risk 1% → R=10. P_in=100, P_stop=90, slippage 0 → P_out=90.
`L = 10 + 100x0.0007 + 90x0.0007 = 10.133`. `q = 10/10.133 = 0.98687`.

The quantity is always rounded **down**. Rounding up could push the final
order past a limit that was validated before rounding.

**This is a model, not a guarantee.** Gaps, an exchange outage or a stop that
does not fill can all produce a larger real loss.

## Minimums are never satisfied by growing the order

If the risk-allowed amount is below the exchange minimum, the trade is skipped
with `MIN_ORDER_EXCEEDS_RISK`. Trading the minimum instead would mean trading
a size the risk budget refused.

freqtrade's `validate_stake_amount` will happily enlarge a stake by up to 30%
to reach a minimum. `confirm_trade_entry` re-validates the final amount and
price against the reservation and refuses anything larger.

## Reservations

An approved entry takes budget **atomically** before any order is sent, inside
one `BEGIN IMMEDIATE` transaction that re-reads all held budget. Two signals in
the same loop therefore cannot both spend the last of the allowance.

| Reservation state | Holds budget? |
|---|---|
| `PENDING` | yes |
| `PARTIALLY_FILLED` | yes - the unfilled remainder stays reserved |
| `UNKNOWN` | **yes** - an unresolved order may still be live |
| `FILLED` | no - risk has moved to the position |
| `RELEASED` | no - only after a **confirmed** cancellation |

A cancel *request* releases nothing. Out-of-order or duplicated fill events
can never reduce the recorded filled amount.

## Period locks

Loss budget spent in a period:

    max(0, (E0 + F - Et) / E0)

`E0` = equity at period start, `F` = net external cash flow, `Et` = current
equity. This is a **loss budget**, not a time-weighted return.

- Computed from open **and** closed results, so an unrealised loss trips the
  limit without waiting for a close.
- The baseline is written once and never overwritten, so a restart mid-period
  cannot adopt the already-reduced balance as a new baseline and erase the
  day's loss.
- A lock expires when the **period** ends, not when equity recovers. A bounce
  inside the same day does not buy back the day's allowance.
- Drawdown, reconciliation and operator locks never expire on their own; they
  require an explicit operator acknowledgement.
- No external cash flow is expected while running. If one is detected,
  entries stop and operator reconciliation is required. No code in this
  repository can move funds.

## Entry locks do not stop exits

Every state except `STOPPED` keeps managing stops and exits. Entry-side
filters - spread, trend, minimum profit, daily loss - are reasons not to
**open** risk. They are never reasons to keep it.
