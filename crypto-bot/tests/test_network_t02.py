"""T02 - during a dry run, public/market reads are allowed but nothing that
writes to the exchange is ever sent.

The classification is endpoint-level on purpose. Hyperliquid serves BOTH
public market data and order placement over HTTP POST, so "no POST requests"
would be the wrong test and "POST means write" would be the wrong assumption.
What separates them is the path: /info is read-only, /exchange mutates.
"""

from __future__ import annotations

import pytest

pytest.importorskip("freqtrade")

from freqtrade.enums import RunMode  # noqa: E402
from freqtrade.resolvers import ExchangeResolver  # noqa: E402

# Hyperliquid routes every action through two POST endpoints.
READ_ONLY_PATHS = ("/info",)
STATE_CHANGING_PATHS = ("/exchange",)


class CallRecorder:
    """Records every outbound HTTP call made through a requests Session."""

    def __init__(self):
        self.calls: list[tuple[str, str]] = []

    def install(self, monkeypatch):
        import requests

        original = requests.Session.request
        recorder = self

        def spy(self, method, url, *args, **kwargs):
            recorder.calls.append((method.upper(), url))
            return original(self, method, url, *args, **kwargs)

        monkeypatch.setattr(requests.Session, "request", spy)

    @property
    def state_changing(self) -> list[tuple[str, str]]:
        return [c for c in self.calls if any(p in c[1] for p in STATE_CHANGING_PATHS)]

    @property
    def read_only(self) -> list[tuple[str, str]]:
        return [c for c in self.calls if any(p in c[1] for p in READ_ONLY_PATHS)]


def build_dry_run_exchange(apply_ca_bundle):
    config = {
        "dry_run": True,
        "dry_run_wallet": 1000,
        "stake_currency": "USDC",
        "trading_mode": "spot",
        "margin_mode": "",
        "runmode": RunMode.DRY_RUN,
        "exchange": {
            "name": "hyperliquid",
            "pair_whitelist": ["BTC/USDC"],
            "pair_blacklist": [],
            "ccxt_config": {},
            "ccxt_async_config": {},
        },
    }
    exchange = ExchangeResolver.load_exchange(config, validate=False)
    apply_ca_bundle(exchange._api)
    apply_ca_bundle(exchange._api_async)
    return exchange


@pytest.mark.network
@pytest.mark.integration
def test_t02_dry_run_entry_order_never_reaches_the_exchange(monkeypatch, apply_ca_bundle):
    """The decisive check: ask the real freqtrade Exchange object, in dry-run
    mode, to create a buy order, and prove no order request left the process."""
    exchange = build_dry_run_exchange(apply_ca_bundle)
    exchange.markets  # force market load before we start recording

    recorder = CallRecorder()
    recorder.install(monkeypatch)

    order = exchange.create_order(
        pair="BTC/USDC",
        ordertype="limit",
        side="buy",
        amount=0.001,
        rate=50000.0,
        leverage=1.0,
    )

    assert order["id"], "dry-run must still produce a simulated order object"
    assert recorder.state_changing == [], (
        f"a dry run sent state-changing requests to the exchange: {recorder.state_changing}"
    )


@pytest.mark.network
@pytest.mark.integration
def test_t02_dry_run_cancel_never_reaches_the_exchange(monkeypatch, apply_ca_bundle):
    exchange = build_dry_run_exchange(apply_ca_bundle)
    exchange.markets

    order = exchange.create_order(
        pair="BTC/USDC", ordertype="limit", side="buy", amount=0.001, rate=50000.0, leverage=1.0
    )

    recorder = CallRecorder()
    recorder.install(monkeypatch)
    exchange.cancel_order(order_id=order["id"], pair="BTC/USDC")

    assert recorder.state_changing == []


@pytest.mark.network
@pytest.mark.integration
def test_t02_public_market_data_reads_are_possible(monkeypatch, apply_ca_bundle):
    """The mirror image: if reads were also blocked the bot could not work,
    and a test that only proves "nothing happened" would pass vacuously."""
    exchange = build_dry_run_exchange(apply_ca_bundle)
    exchange.markets

    recorder = CallRecorder()
    recorder.install(monkeypatch)
    book = exchange.fetch_l2_order_book("BTC/USDC", limit=20)

    assert book["bids"], "expected a populated order book"
    assert recorder.read_only, "expected at least one read-only exchange call"
    assert recorder.state_changing == []


@pytest.mark.network
@pytest.mark.integration
def test_t02_no_credentials_are_present_in_dry_run(apply_ca_bundle):
    """freqtrade strips exchange secrets in dry-run; prove it for this build."""
    exchange = build_dry_run_exchange(apply_ca_bundle)

    assert not exchange._api.apiKey
    assert not exchange._api.secret
    assert not getattr(exchange._api, "privateKey", "")
    assert not getattr(exchange._api, "walletAddress", "")
