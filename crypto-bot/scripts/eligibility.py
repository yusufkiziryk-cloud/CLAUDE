#!/usr/bin/env python3
"""Apply the research plan's acceptance thresholds to backtest archives.

    .venv/bin/python scripts/eligibility.py \\
        --result user_data/backtest_results/<1x>.zip \\
        --result-2x user_data/backtest_results/<2x>.zip \\
        --experiments-used 1

Reads freqtrade's own result archives; never runs a backtest itself (that is
scripts/safe-run.py's job, with ``--cache none``). Prints the criteria table
and the verdict, optionally writes JSON, and exits:

    0  CANDIDATE_FOR_OBSERVATION
    1  INSUFFICIENT_EVIDENCE
    2  REJECTED

``--holdout-untouched`` is a human attestation and defaults to off. The
script cannot know whether a number was looked at before the hold-out was
frozen, so it assumes the honest worst until told otherwise.
"""

from __future__ import annotations

import argparse
import glob
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from kripto.research.eligibility import (  # noqa: E402
    Evidence,
    Verdict,
    evaluate,
    metrics_from_archive,
    render_markdown,
)

EXIT_BY_VERDICT = {
    Verdict.CANDIDATE_FOR_OBSERVATION: 0,
    Verdict.INSUFFICIENT_EVIDENCE: 1,
    Verdict.REJECTED: 2,
}


def latest_archive(results_dir: Path) -> Path | None:
    zips = sorted(glob.glob(str(results_dir / "*.zip")))
    return Path(zips[-1]) if zips else None


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--result", type=Path, help="1x-cost backtest zip (default: newest in user_data/backtest_results)")
    parser.add_argument("--result-2x", type=Path, help="2x-cost backtest zip of the same configuration and period")
    parser.add_argument("--strategy", default="BaselineTrend4h")
    parser.add_argument("--experiments-used", type=int, required=True,
                        help="how many parameter combinations have been tried so far, including this one")
    parser.add_argument("--holdout-untouched", action="store_true",
                        help="human attestation that no result over this period was seen before the hold-out was frozen")
    parser.add_argument("--json", type=Path, help="also write the verdict as JSON here")
    return parser.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)
    result_path = args.result or latest_archive(ROOT / "user_data" / "backtest_results")
    if result_path is None or not result_path.is_file():
        print("no backtest archive found; run scripts/safe-run.py backtesting first", file=sys.stderr)
        return 1

    base = metrics_from_archive(result_path, args.strategy)
    double = metrics_from_archive(args.result_2x, args.strategy) if args.result_2x else None
    if double is not None and (double.period_start, double.period_end) != (base.period_start, base.period_end):
        print(
            f"refusing: the 2x-cost run covers {double.period_start}..{double.period_end} "
            f"but the 1x run covers {base.period_start}..{base.period_end}; "
            "a cost stress over a different period is not the same experiment",
            file=sys.stderr,
        )
        return 1

    evidence = Evidence(
        base=base,
        double_cost=double,
        holdout_untouched=args.holdout_untouched,
        experiments_used=args.experiments_used,
        strategy=args.strategy,
    )
    result = evaluate(evidence)
    print(render_markdown(result, evidence))
    print(f"source 1x: {base.source}" + (f"\nsource 2x: {double.source}" if double else ""))

    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        payload = result.as_dict()
        payload["sources"] = {"base": base.source, "double_cost": double.source if double else None}
        payload["holdout_untouched"] = args.holdout_untouched
        payload["experiments_used"] = args.experiments_used
        args.json.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return EXIT_BY_VERDICT[result.verdict]


if __name__ == "__main__":
    sys.exit(main())
