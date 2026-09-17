# Exchange and engine capability matrix

All rows verified on **2026-09-17** against **freqtrade 2026.8** (installed,
not just read about) and **ccxt 4.5.78**, exchange **Hyperliquid**, mode
**spot**. `tests/test_capabilities.py` re-asserts the load-bearing ones on
every run, so an upgrade that changes one fails loudly instead of silently
invalidating a design decision.

Status values: `SUPPORTED` / `UNSUPPORTED` / `UNVERIFIED`.

## The decisive finding

| Feature | Spot | Futures | Status | Evidence |
|---|---|---|---|---|
| `stoploss_on_exchange` | **NO** | yes (`limit`) | `UNSUPPORTED` (spot) | `Hyperliquid._ft_has["stoploss_on_exchange"] is False`; `_ft_has_futures[...] is True` |

The freqtrade docs open the Hyperliquid section with *"Hyperliquid supports
`stoploss_on_exchange` and uses `stop-loss-limit` orders."* **That tip is
true only for futures.** Reading it as spot support is the single most
expensive mistake available on this exchange, because it would leave an
operator believing an exchange-side protection exists when it does not.

Consequence: on spot, the stop lives **inside the bot process**. If the bot
dies, the stop dies with it. This is recorded as a `LIVE_BLOCKER` in
[LIVE_READINESS.md](LIVE_READINESS.md). A watchdog or a VPS is not an
equivalent. Neither is a native stop, for that matter, a guarantee against
gap moves - but it is a strictly stronger position than this one.

## Orders and execution

| Feature | Status | Detail | Source |
|---|---|---|---|
| Spot trading | `SUPPORTED` | `(TradingMode.SPOT, MarginMode.NONE)` in `_supported_trading_mode_margin_pairs` | adapter source |
| Market orders | `UNSUPPORTED` (emulated) | `marketOrderRequiresPrice: True`. ccxt simulates a market order as a limit order with a **5% max slippage** cap | freqtrade `exchanges.md`; adapter |
| Limit orders | `SUPPORTED` | entry and exit both use limit | config |
| Client order id (`cloid`) | `UNVERIFIED` | Hyperliquid exposes a `cloid` field, but that the freqtrade adapter forwards it AND that it can be queried back was not tested (no keys) | needs a keyed test |
| Order query | `SUPPORTED` | `fetch_order` / `fetch_orders`, with a Hyperliquid-specific fix that back-fills `average` from trades when the order response omits it | adapter source |
| Partial fills | `SUPPORTED` | handled through the standard order lifecycle | adapter |
| Fee currency | `SUPPORTED` | quote (USDC) | ccxt market data |

## Market data

| Feature | Status | Measured value |
|---|---|---|
| `ohlcv_has_history` | **`False`** | `freqtrade download-data` falls through to a trades-to-OHLCV path, and `trades_has_history` is also `False`. We run our own collector instead (`scripts/collect-data.py`). |
| Candles per call | capped | 5000, and always the **most recent** inside the window |
| 4h history | `SUPPORTED` | BTC 3552 candles / 592 d · ETH 3243 / 540 d · SOL 2974 / 496 d |
| 1h history | limited | ~5002 candles / **208 days** - bounded by the 5000 cap, not by listing |
| 5m history | **severely limited** | ~5020 candles / **17 days** |
| `tickers_have_bid_ask` | **`False`** | spread gates cannot use `fetch_tickers`; they need an explicit L2 call |
| Order book depth | capped | `l2_limit_range: [20]` - 20 levels per side |

**4h coverage does not imply 5m coverage.** 592 days of 4h sits alongside 17
days of 5m. Intra-candle fill verification is therefore bounded to 17 days and
is marked `NOT_MODELED` in the research report.

## Instruments actually traded

ccxt renames the bridged tokens. The market id is the ground truth.

| ccxt / freqtrade pair | Market id | Token really traded | Issuer | Canonical |
|---|---|---|---|---|
| `BTC/USDC` | `@142` | **UBTC** (Unit Bitcoin) | Unit bridge | no |
| `ETH/USDC` | `@151` | **UETH** (Unit Ethereum) | Unit bridge | no |
| `SOL/USDC` | `@156` | **USOL** (Unit Solana) | Unit bridge | no |

These are **not** native BTC/ETH/SOL. They are bridge-issued wrappers with EVM
contracts (`0x9fdbda0a…`, `0xbe6727b5…`, `0x068f321f…`), all from the **same
issuer**. So they share price correlation *and* a single bridge counterparty.
The policy treats them as one risk bucket (`correlation_group:
crypto-unit-bridged`), which is a stronger constraint than correlation alone
would justify.

A perpetual market `BTC/USDC:USDC` sits next to the spot `BTC/USDC`. The pair
whitelist is pinned to spot and `trading_mode` is `spot`.

## Precision, minimums and liquidity (measured 2026-09-17)

| Pair | Amount step | Price step | Min cost | Maker | Taker | 24h volume | Spread |
|---|---|---|---|---|---|---|---|
| BTC/USDC | 1e-05 | 1.0 | 10 USDC | 0.040% | 0.070% | $67.7M | 0.1 bps |
| ETH/USDC | 1e-04 | 0.1 | 10 USDC | 0.040% | 0.070% | $17.8M | - |
| SOL/USDC | 1e-03 | 0.01 | 10 USDC | 0.040% | 0.070% | $8.3M | - |

ccxt's fee figures match the [official schedule](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees)
(spot tier 0: taker 0.070%, maker 0.040%). The policy assumes **taker on both
sides** and no referral or HYPE-staking discount, because none is verified for
this account.

Depth at the top 5 book levels was ~$82k bid / ~$84k ask on BTC/USDC. For a
1000 USDC simulated account this is not a capacity constraint. That statement
is a **point observation**, not a history: no depth time series exists, so no
claim is made about queue position or fill probability.

## Engine behaviours that required defensive code

| Behaviour | Why it matters | Our response |
|---|---|---|
| `custom_stake_amount` is wrapped with `default_retval=stake_amount` | a raising risk calculation results in a trade at the **proposed** stake | the callback never raises; every failure returns `0` |
| `Wallets.validate_stake_amount` enlarges a stake up to **+30%** to reach an exchange minimum | a risk-approved 1% trade can become 1.3% | `confirm_trade_entry` re-checks final amount x price against the reservation |
| `confirm_trade_exit` "can prevent stoploss exits" | an entry-side filter here becomes a loss amplifier | the callback returns `True` unconditionally |
| custom stoploss can never be wider than `self.stoploss` | a wide ATR stop is silently clamped | `stoploss: -0.15` is documented as a hard backstop that can only cut **earlier** |
| `ohlcv_partial_candle` defaults to `True` | determines whether the last row is a closed candle | verified `True` (not overridden) - the last dataframe row is the last **completed** candle |
| `lookahead-analysis` forces `dry_run_wallet = 1e9` and `stake_amount = 10000` | percentage-based sizing is deliberately defeated | the tool does **not** exercise the production risk policy; recorded as a caveat |

## Account and key capabilities

| Item | Status |
|---|---|
| Agent / API wallet signing | `UNVERIFIED` - documented by Hyperliquid, not tested here (no keys) |
| API wallet cannot withdraw | `UNVERIFIED` - freqtrade's docs state it, the exchange side was not confirmed |
| Account address vs signer address | documented: `walletAddress` is the **main wallet**, `privateKey` belongs to the **API wallet**. Getting this backwards shows an empty balance, which must never be read as "new account" |
| Spot-only restriction enforced exchange-side | `UNVERIFIED` - the software setting is not evidence of an exchange-enforced permission |
