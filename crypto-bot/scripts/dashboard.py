#!/usr/bin/env python3
"""Build a self-contained local HTML dashboard from real results.

    python scripts/dashboard.py
    python scripts/dashboard.py --out reports/dashboard.html

This is a FILE, not a server. It opens no port, holds no credential and sends
nothing anywhere - the master instruction allows a local HTML report and rules
out standing up a web interface, and those are different things.

Everything it shows is read from artefacts already on disk: the backtest
archive freqtrade wrote, the risk state's recorded entry decisions, and the
data manifest. It invents nothing; if a source is missing, the section says so
rather than filling in a plausible number.
"""

from __future__ import annotations

import argparse
import glob
import io
import json
import re
import sqlite3
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src"))

import pandas as pd  # noqa: E402

from kripto.data.store import read_candles  # noqa: E402
from kripto.redact import install_redaction  # noqa: E402

TEMPLATE = REPO_ROOT / "src" / "kripto" / "report" / "dashboard_template.html"


def latest_backtest(results_dir: Path) -> Path | None:
    zips = sorted(glob.glob(str(results_dir / "*.zip")))
    return Path(zips[-1]) if zips else None


def load_backtest(path: Path, strategy: str) -> tuple[dict, pd.DataFrame]:
    with zipfile.ZipFile(path) as archive:
        main = next(
            n for n in archive.namelist() if n.endswith(".json") and "config" not in n
        )
        stats = json.loads(archive.read(main))["strategy"][strategy]
        wallet_name = next(n for n in archive.namelist() if "wallet" in n)
        wallet = pd.read_feather(io.BytesIO(archive.read(wallet_name)))
    return stats, wallet


def equity_curve(wallet: pd.DataFrame) -> list[dict]:
    """Portfolio equity per day.

    freqtrade's wallet frame carries ONE ROW PER CURRENCY per timestamp, and
    `total_quote` is that currency's quote value - not the portfolio's. Taking
    the last row of each day therefore picks whichever currency happened to be
    written last, which for a day holding BTC reads as if equity had collapsed
    to the value of the position alone. Sum across currencies first, then
    resample.
    """
    frame = wallet[["date", "currency", "total_quote"]].copy()
    frame["date"] = pd.to_datetime(frame["date"], utc=True)
    totals = frame.groupby("date", as_index=True)["total_quote"].sum().sort_index()
    daily = totals.resample("1D").last().dropna().reset_index()
    base = float(daily["total_quote"].iloc[0])
    return [
        {"d": d.strftime("%Y-%m-%d"), "v": round(v / base * 100, 3)}
        for d, v in zip(daily["date"], daily["total_quote"])
    ]


def benchmark_curves(datadir: Path, start, end) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for label, stem in (("BTC", "BTC_USDC"), ("ETH", "ETH_USDC"), ("SOL", "SOL_USDC")):
        path = datadir / f"{stem}-4h.feather"
        if not path.is_file():
            continue
        frame = read_candles(path)
        frame = frame[(frame["date"] >= start) & (frame["date"] <= end)]
        if frame.empty:
            continue
        daily = frame.set_index("date")["close"].resample("1D").last().dropna()
        base = float(daily.iloc[0])
        out[label] = [
            {"d": d.strftime("%Y-%m-%d"), "v": round(v / base * 100, 3)}
            for d, v in daily.items()
        ]
    return out


def entry_decisions(state_path: Path) -> list[dict]:
    if not state_path.is_file():
        return []
    conn = sqlite3.connect(f"file:{state_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            "SELECT code, allowed, COUNT(*) n FROM entry_decisions "
            "GROUP BY code, allowed ORDER BY n DESC"
        ).fetchall()
    except sqlite3.Error:
        return []
    finally:
        conn.close()
    return [{"code": r["code"], "allowed": bool(r["allowed"]), "n": r["n"]} for r in rows]


def test_matrix_tally(path: Path) -> dict[str, int]:
    if not path.is_file():
        return {}
    tally: dict[str, int] = {}
    for _tid, status in re.findall(r"^\| (T\d\d) \|[^|]*\| `(\w+)` \|", path.read_text("utf-8"), re.M):
        tally[status] = tally.get(status, 0) + 1
    return tally


def build_payload(args) -> dict:
    archive = Path(args.archive) if getattr(args, "archive", None) else latest_backtest(Path(args.results))
    if archive is None or not archive.is_file():
        raise SystemExit(
            f"no backtest archive in {args.results}. Run a backtest first:\n"
            "  python scripts/safe-run.py backtesting --config config/config.dry.json "
            "--strategy BaselineTrend4h --timerange 20250901-20260901 --enable-protections"
        )
    stats, wallet = load_backtest(archive, args.strategy)
    equity = equity_curve(wallet)
    totals = (
        wallet.assign(date=pd.to_datetime(wallet["date"], utc=True))
        .groupby("date")["total_quote"].sum().sort_index()
    )
    equity_start, equity_end = float(totals.iloc[0]), float(totals.iloc[-1])
    # Drawdown from the SAME mark-to-market series the chart draws. freqtrade's
    # max_drawdown_account counts closed trades only, and understated an 11%
    # equity dip as 8.2% right above a chart that showed it (audit finding).
    running_peak = totals.cummax()
    mtm_drawdown = float(((running_peak - totals) / running_peak).max()) if len(totals) else 0.0
    start = pd.Timestamp(equity[0]["d"], tz="UTC")
    end = pd.Timestamp(equity[-1]["d"], tz="UTC")

    manifest_path = Path(args.manifest)
    coverage = []
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text("utf-8"))
        coverage = [
            {"pair": c["pair"], "tf": c["timeframe"], "days": c["span_days"], "rows": c["rows"]}
            for c in manifest.get("coverage", [])
        ]

    return {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "source_archive": archive.name,
        "period": {"start": equity[0]["d"], "end": equity[-1]["d"]},
        "headline": {
            "return_pct": round(stats["profit_total"] * 100, 2),
            "trades": stats["total_trades"],
            "wins": stats["wins"],
            "losses": stats["losses"],
            "profit_factor": round(stats["profit_factor"], 2),
            "max_dd_pct": round(mtm_drawdown * 100, 2),
            "closed_trade_max_dd_pct": round(stats.get("max_drawdown_account", 0) * 100, 2),
            "expectancy": round(stats.get("expectancy", 0), 2),
            "start_equity": round(equity_start, 2),
            "end_equity": round(equity_end, 2),
        },
        "equity": equity,
        "benchmarks": benchmark_curves(Path(args.datadir), start, end),
        "trades": [
            {
                "pair": t["pair"],
                "open": t["open_date"][:16],
                "close": t["close_date"][:16],
                "open_rate": t["open_rate"],
                "close_rate": t["close_rate"],
                "profit_pct": round(t["profit_ratio"] * 100, 2),
                "profit_abs": round(t["profit_abs"], 2),
                "hours": round(t["trade_duration"] / 60, 1),
                "reason": t["exit_reason"],
            }
            for t in stats["trades"]
        ],
        "decisions": entry_decisions(Path(args.state)),
        "coverage": coverage,
        "test_matrix": test_matrix_tally(REPO_ROOT / "docs" / "TEST_MATRIX.md"),
    }


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results", default=str(REPO_ROOT / "user_data" / "backtest_results"))
    parser.add_argument("--archive", default=None,
                        help="a specific backtest zip; default: the newest in --results (which may be a cost-stress run)")
    parser.add_argument("--state", default=str(REPO_ROOT / "user_data" / "backtest" / "risk_state.sqlite"))
    parser.add_argument("--datadir", default=str(REPO_ROOT / "user_data" / "data" / "hyperliquid"))
    parser.add_argument("--manifest", default=str(REPO_ROOT / "reports" / "data_manifest.json"))
    parser.add_argument("--strategy", default="BaselineTrend4h")
    parser.add_argument("--out", default=str(REPO_ROOT / "reports" / "dashboard.html"))
    return parser.parse_args(argv)


def main(argv=None) -> int:
    install_redaction()
    args = parse_args(argv)
    payload = build_payload(args)

    html = TEMPLATE.read_text("utf-8")
    if "/*__DATA__*/{}" not in html:
        raise SystemExit("template is missing its /*__DATA__*/{} placeholder")
    html = html.replace("/*__DATA__*/{}", json.dumps(payload, ensure_ascii=False))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")

    head = payload["headline"]
    print(f"source     : {payload['source_archive']}")
    print(f"period     : {payload['period']['start']} -> {payload['period']['end']}")
    print(f"result     : {head['return_pct']}% over {head['trades']} trades, PF {head['profit_factor']}")
    print(f"decisions  : {sum(d['n'] for d in payload['decisions'])} recorded")
    print(f"written    : {out}  ({out.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
