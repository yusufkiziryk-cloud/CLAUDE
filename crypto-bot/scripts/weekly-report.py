#!/usr/bin/env python3
"""Generate the weekly operations report.

    python scripts/weekly-report.py
    python scripts/weekly-report.py --weeks 2 --out reports/weekly

Reads only: freqtrade's trade database, the risk state, the data manifest and
the collected candles. Writes a Markdown file and a JSON file locally.
Nothing is sent anywhere, and no credential is used.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src"))

from kripto.policy import load_policy  # noqa: E402
from kripto.redact import install_redaction  # noqa: E402
from kripto.report.weekly import build_report, render_markdown, write_report  # noqa: E402
from kripto.risk.state import RiskStore  # noqa: E402


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state", default=str(REPO_ROOT / "user_data" / "dryrun" / "risk_state.sqlite"))
    parser.add_argument(
        "--db-url", default=f"sqlite:///{REPO_ROOT / 'user_data' / 'dryrun' / 'tradesv3.dryrun.sqlite'}"
    )
    parser.add_argument("--policy", default=str(REPO_ROOT / "config" / "policy.yaml"))
    parser.add_argument("--manifest", default=str(REPO_ROOT / "reports" / "data_manifest.json"))
    parser.add_argument("--benchmarks", default=str(REPO_ROOT / "reports" / "faz4" / "benchmarks.json"))
    parser.add_argument("--out", default=str(REPO_ROOT / "reports" / "weekly"))
    parser.add_argument("--weeks", type=float, default=1.0)
    parser.add_argument("--end", default=None, help="ISO timestamp; defaults to now")
    parser.add_argument("--mode", default="dry-run")
    parser.add_argument(
        "--observation-started",
        default=None,
        help="ISO timestamp of when continuous observation began. Without it the "
        "report counts only this period, which understates nothing but cannot "
        "credit earlier weeks either.",
    )
    return parser.parse_args(argv)


def load_benchmarks(path: Path) -> dict:
    if not path.is_file():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    out = {}
    for pair, values in (raw.get("pairs") or {}).items():
        out[f"buy & hold {pair}"] = values
    if "equal_weight_basket" in raw:
        out["equal-weight basket"] = raw["equal_weight_basket"]
    if "usdc_cash" in raw:
        out["hold USDC (0% yield assumed)"] = raw["usdc_cash"]
    return out


def main(argv=None) -> int:
    install_redaction()
    args = parse_args(argv)

    end = datetime.fromisoformat(args.end) if args.end else datetime.now(timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    start = end - timedelta(weeks=args.weeks)

    observation_started = (
        datetime.fromisoformat(args.observation_started).replace(tzinfo=timezone.utc)
        if args.observation_started
        else None
    )

    policy = load_policy(args.policy)
    store = RiskStore(args.state)
    try:
        report = build_report(
            store=store,
            db_url=args.db_url,
            policy=policy,
            start=start,
            end=end,
            mode=args.mode,
            manifest_path=Path(args.manifest),
            benchmarks=load_benchmarks(Path(args.benchmarks)),
            observation_started=observation_started,
        )
    finally:
        store.close()

    md_path, json_path = write_report(report, Path(args.out))
    print(render_markdown(report))
    print(f"\nwritten: {md_path}\nwritten: {json_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
