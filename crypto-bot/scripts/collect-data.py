#!/usr/bin/env python3
"""Discover spot markets and collect OHLCV history into freqtrade's data dir.

This replaces `freqtrade download-data` for Hyperliquid, which declares
``ohlcv_has_history: False`` and routes downloads through a trades-to-OHLCV
path the exchange cannot serve either.

Public reads only. No credentials are used, requested or accepted.

    python scripts/collect-data.py
    python scripts/collect-data.py --timeframes 4h 1h --quote USDC
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src"))

from kripto.data.collector import Collector  # noqa: E402
from kripto.data.hyperliquid_client import HyperliquidInfoClient  # noqa: E402
from kripto.data.manifest import build_manifest, write_manifest  # noqa: E402
from kripto.redact import install_redaction  # noqa: E402

# The markets we research, named by EXCHANGE MARKET ID, never by ticker.
# ccxt renames @142 to "BTC/USDC"; the token actually traded there is UBTC,
# a Unit-bridge wrapper. Pinning the id is what keeps that honest.
TARGET_MARKET_IDS = ["@142", "@151", "@156"]
# The token each pinned id is EXPECTED to carry. Hyperliquid can list new
# markets and ccxt maps names by token, not by id; if an id ever pointed at a
# different token the collector would quietly describe a different market
# under the same file name (audit finding). So the token is asserted.
EXPECTED_BASE_TOKENS = {"@142": "UBTC", "@151": "UETH", "@156": "USOL"}

DEFAULT_TIMEFRAMES = ["4h", "1h", "5m"]


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--timeframes", nargs="+", default=DEFAULT_TIMEFRAMES)
    parser.add_argument("--datadir", default=str(REPO_ROOT / "user_data" / "data" / "hyperliquid"))
    parser.add_argument(
        "--manifest", default=str(REPO_ROOT / "reports" / "data_manifest.json")
    )
    parser.add_argument("--market-ids", nargs="+", default=TARGET_MARKET_IDS)
    return parser.parse_args(argv)


def main(argv=None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    install_redaction()
    args = parse_args(argv)

    # Sandboxed CI/dev environments may terminate TLS at an egress proxy.
    ca_bundle = os.environ.get("REQUESTS_CA_BUNDLE") or os.environ.get("SSL_CERT_FILE")
    client = HyperliquidInfoClient(ca_bundle=ca_bundle)

    print("discovering spot markets ...")
    markets = client.spot_markets()
    contexts = client.spot_contexts()
    print(f"  {len(markets)} spot markets on the exchange")

    selected = {}
    for market_id in args.market_ids:
        market = markets.get(market_id)
        if market is None:
            print(f"  !! market {market_id} not found - skipping", file=sys.stderr)
            continue
        context = contexts.get(market_id, {})
        expected_token = EXPECTED_BASE_TOKENS.get(market_id)
        if expected_token is not None and market.base_token != expected_token:
            print(
                f"  !! market {market_id} now carries token {market.base_token}, expected "
                f"{expected_token}. Refusing to collect: the id no longer means what the "
                "research assumes. Re-verify the market before changing EXPECTED_BASE_TOKENS.",
                file=sys.stderr,
            )
            return 1
        pair = market.display_symbol
        selected[market_id] = {
            "market_id": market_id,
            "freqtrade_pair": pair,
            "real_base_token": market.base_token,
            "real_quote_token": market.quote_token,
            "token_full_name": market.full_name,
            "is_bridged_wrapper": market.is_bridged_wrapper,
            "is_canonical": market.is_canonical,
            "base_token_id": market.base_token_id,
            "evm_contract": market.evm_contract,
            "size_decimals": market.base_size_decimals,
            "mid_price": context.get("midPx"),
            "day_notional_volume": context.get("dayNtlVlm"),
        }
        flag = " [BRIDGED WRAPPER]" if market.is_bridged_wrapper else ""
        print(
            f"  {market_id:8} -> freqtrade calls it {pair:10} "
            f"but the real token is {market.base_token} "
            f"({market.full_name}){flag}"
        )

    if not selected:
        print("no target markets resolved; aborting", file=sys.stderr)
        return 1

    datadir = Path(args.datadir)
    collector = Collector(client, datadir)
    results = []

    for market_id, info in selected.items():
        market = markets[market_id]
        for timeframe in args.timeframes:
            print(f"\ncollecting {info['freqtrade_pair']} {timeframe} ({market_id}) ...")
            result = collector.collect(market, info["freqtrade_pair"], timeframe)
            results.append(result)
            if result.rows:
                print(
                    f"  {result.rows} candles | {result.first_date[:16]} -> "
                    f"{result.last_date[:16]} | {result.span_days:.0f} days | "
                    f"{result.requests_made} request(s)"
                )
                if result.quality:
                    for finding in result.quality.findings:
                        print(f"  {finding.severity.value}: {finding.code} - {finding.message}")
                if result.file_path:
                    print(f"  written: {result.file_path}")
            for note in result.notes:
                print(f"  note: {note}")

    manifest = build_manifest(
        exchange="hyperliquid",
        source_url="https://api.hyperliquid.xyz/info (candleSnapshot, spotMeta)",
        results=results,
        markets=selected,
        extra={
            "collection_notes": [
                "ccxt/freqtrade label these markets BTC/ETH/SOL. The tokens actually "
                "traded are UBTC/UETH/USOL, Unit-bridge issued wrappers. They carry "
                "issuer and bridge risk that native assets do not, and they share "
                "ONE issuer, so they are a single risk bucket.",
                "Missing candles are recorded as gaps and are never forward-filled.",
                "4h coverage does not imply 5m coverage: the per-call cap of 5000 "
                "candles bounds short timeframes to a much shorter window.",
            ],
            "total_api_requests": client.request_count,
        },
    )
    path = write_manifest(manifest, Path(args.manifest))
    print(f"\nmanifest written: {path}")

    # --- honest summary ----------------------------------------------------
    print("\n" + "=" * 72)
    print("COVERAGE SUMMARY")
    print("=" * 72)
    for result in results:
        status = "OK" if result.file_path else "NOT WRITTEN"
        print(
            f"{result.pair:10} {result.timeframe:4} {result.rows:6} candles "
            f"{result.span_days:7.0f} days  {status}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
