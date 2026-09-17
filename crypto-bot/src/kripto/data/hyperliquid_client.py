"""Read-only client for Hyperliquid's public info endpoint.

Scope is enforced structurally, not by convention: this client can only POST
to ``/info``. The order-placing ``/exchange`` endpoint is not reachable from
here, there is no signing code in this module, and it never accepts a key.

Why not use ccxt for collection? freqtrade's Hyperliquid adapter declares
``ohlcv_has_history: False``, which routes `download-data` into a
trades-to-OHLCV conversion path that this exchange also cannot serve. The
raw endpoint, in contrast, returns the full listed history of a market in a
single call (measured: 3551 4h candles for @142). So we collect here and
write freqtrade-compatible files, rather than pretend download-data works.
"""

from __future__ import annotations

import json
import logging
import random
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import requests

logger = logging.getLogger(__name__)

INFO_URL = "https://api.hyperliquid.xyz/info"

# Measured 2026-09-17: a single candleSnapshot call returns at most this many
# candles, and always the MOST RECENT ones inside the requested window. There
# is no documented way to page further back, so we never assume one.
MAX_CANDLES_PER_CALL = 5000

RETRYABLE_STATUS = frozenset({429, 500, 502, 503, 504})


class HyperliquidError(RuntimeError):
    pass


class RateLimited(HyperliquidError):
    pass


@dataclass(frozen=True)
class SpotMarket:
    """One spot pair, with BOTH the label and the real underlying token.

    ccxt presents market ``@142`` as ``BTC/USDC``. The token actually traded
    there is ``UBTC`` - Unit Bitcoin, a bridged wrapper. Keeping both names on
    the same object is what stops that difference from disappearing into a
    config file.
    """

    market_id: str
    base_token: str
    quote_token: str
    base_token_index: int
    quote_token_index: int
    is_canonical: bool
    base_size_decimals: int
    base_wei_decimals: int
    base_token_id: str
    evm_contract: dict[str, Any] | None
    full_name: str | None

    @property
    def display_symbol(self) -> str:
        """How ccxt/freqtrade will name this market."""
        label = self.base_token[1:] if self._looks_bridged() else self.base_token
        return f"{label}/{self.quote_token}"

    def _looks_bridged(self) -> bool:
        return bool(self.evm_contract) and self.base_token.startswith("U")

    @property
    def is_bridged_wrapper(self) -> bool:
        return self._looks_bridged()


class HyperliquidInfoClient:
    """Minimal, read-only, retrying client."""

    def __init__(
        self,
        *,
        session: requests.Session | None = None,
        timeout: float = 30.0,
        max_retries: int = 4,
        base_backoff: float = 1.0,
        max_backoff: float = 30.0,
        ca_bundle: str | None = None,
    ):
        self.session = session or requests.Session()
        self.timeout = timeout
        self.max_retries = max_retries
        self.base_backoff = base_backoff
        self.max_backoff = max_backoff
        if ca_bundle:
            self.session.verify = ca_bundle
        self.request_count = 0

    # -- transport ---------------------------------------------------------

    def _post(self, payload: dict[str, Any]) -> Any:
        """POST to /info with bounded, jittered backoff.

        Read retries are safe to repeat. This client only ever performs reads,
        which is precisely why a generic retry decorator is acceptable here and
        would NOT be acceptable around order creation.
        """
        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            if attempt:
                delay = min(self.base_backoff * (2 ** (attempt - 1)), self.max_backoff)
                delay += random.uniform(0, delay * 0.25)  # jitter
                logger.warning(
                    "retrying %s in %.1fs (attempt %d/%d): %s",
                    payload.get("type"),
                    delay,
                    attempt,
                    self.max_retries,
                    last_error,
                )
                time.sleep(delay)
            try:
                self.request_count += 1
                response = self.session.post(
                    INFO_URL,
                    json=payload,
                    timeout=self.timeout,
                    headers={"Content-Type": "application/json"},
                )
                if response.status_code in RETRYABLE_STATUS:
                    last_error = RateLimited(f"HTTP {response.status_code}")
                    continue
                response.raise_for_status()
                return response.json()
            except (requests.Timeout, requests.ConnectionError) as exc:
                last_error = exc
            except json.JSONDecodeError as exc:
                last_error = exc
            except requests.HTTPError as exc:
                raise HyperliquidError(f"{payload.get('type')}: {exc}") from exc

        raise HyperliquidError(
            f"{payload.get('type')} failed after {self.max_retries} retries: {last_error}"
        )

    # -- reads -------------------------------------------------------------

    def server_time(self) -> datetime:
        """Approximate exchange time, used for clock-skew detection."""
        started = time.time()
        self._post({"type": "meta"})
        return datetime.fromtimestamp((started + time.time()) / 2, tz=timezone.utc)

    def spot_markets(self) -> dict[str, SpotMarket]:
        """All spot markets, keyed by market id (``@142``, ``PURR/USDC``)."""
        meta = self._post({"type": "spotMeta"})
        tokens = {t["index"]: t for t in meta["tokens"]}

        markets: dict[str, SpotMarket] = {}
        for entry in meta["universe"]:
            base_index, quote_index = entry["tokens"][0], entry["tokens"][1]
            base, quote = tokens[base_index], tokens[quote_index]
            markets[entry["name"]] = SpotMarket(
                market_id=entry["name"],
                base_token=base["name"],
                quote_token=quote["name"],
                base_token_index=base_index,
                quote_token_index=quote_index,
                is_canonical=bool(entry.get("isCanonical")),
                base_size_decimals=int(base["szDecimals"]),
                base_wei_decimals=int(base["weiDecimals"]),
                base_token_id=base.get("tokenId", ""),
                evm_contract=base.get("evmContract"),
                full_name=base.get("fullName"),
            )
        return markets

    def spot_contexts(self) -> dict[str, dict[str, Any]]:
        """Live per-market context: mid price, 24h notional volume, supply."""
        _meta, contexts = self._post({"type": "spotMetaAndAssetCtxs"})
        return {ctx["coin"]: ctx for ctx in contexts}

    def l2_book(self, market_id: str) -> dict[str, Any]:
        """Order book snapshot. Capped at 20 levels per side by the exchange."""
        return self._post({"type": "l2Book", "coin": market_id})

    def candles(
        self,
        market_id: str,
        interval: str,
        start_ms: int,
        end_ms: int,
    ) -> list[dict[str, Any]]:
        """Raw candle snapshot for a window.

        The endpoint returns the most recent candles inside the window, capped
        at ``MAX_CANDLES_PER_CALL``. A full response is therefore ambiguous:
        it may mean "the window is exactly this long" or "there is more history
        we were not given". Callers must treat a full response as truncated.
        """
        if start_ms >= end_ms:
            raise ValueError(f"start_ms {start_ms} must be before end_ms {end_ms}")
        payload = {
            "type": "candleSnapshot",
            "req": {
                "coin": market_id,
                "interval": interval,
                "startTime": start_ms,
                "endTime": end_ms,
            },
        }
        result = self._post(payload)
        return result or []

    @staticmethod
    def response_is_truncated(candles: list[Any]) -> bool:
        return len(candles) >= MAX_CANDLES_PER_CALL
