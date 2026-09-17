#!/usr/bin/env python3
"""Out-of-process health observer.

    python scripts/watchdog.py --state user_data/dryrun/risk_state.sqlite
    python scripts/watchdog.py --state ... --interval 60     # keep watching
    python scripts/watchdog.py --state ... --json            # machine readable

Read-only by construction: the state file is opened with SQLite's ``mode=ro``,
so this process cannot write to it even if it tried. It holds no credentials,
sends no orders, and is not a standby trader.

LIMITATION, stated rather than hidden: a watchdog running on the same host
cannot tell you the host went down. For that you need a heartbeat to
something off-box - see docs/RUNBOOK.md. This script does not start or pay
for any such service.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src"))

from kripto.ops.watchdog import Level, Watchdog  # noqa: E402
from kripto.policy import load_policy  # noqa: E402
from kripto.redact import install_redaction  # noqa: E402

EXIT_OK = 0
EXIT_WARN = 1
EXIT_CRITICAL = 2


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--state", default=str(REPO_ROOT / "user_data" / "dryrun" / "risk_state.sqlite")
    )
    parser.add_argument("--policy", default=str(REPO_ROOT / "config" / "policy.yaml"))
    parser.add_argument("--timeframe", default="4h")
    parser.add_argument("--interval", type=float, default=0.0, help="0 = run once and exit")
    parser.add_argument("--json", action="store_true")
    return parser.parse_args(argv)


def render(report) -> str:
    lines = [f"health: {report.level.value}   action: {report.action.value}"]
    for check in report.checks:
        marker = {"OK": "  ok ", "WARN": " WARN", "CRITICAL": " CRIT"}[check.level.value]
        lines.append(f"{marker}  {check.name:22} {check.message}")
        if check.measured:
            lines.append(f"        {check.measured}")
    return "\n".join(lines)


def main(argv=None) -> int:
    install_redaction()
    args = parse_args(argv)
    policy = load_policy(args.policy)
    watchdog = Watchdog(args.state, policy, timeframe=args.timeframe)

    while True:
        report = watchdog.run()
        print(json.dumps(report.as_dict(), indent=2) if args.json else render(report), flush=True)

        if args.interval <= 0:
            return {
                Level.OK: EXIT_OK,
                Level.WARN: EXIT_WARN,
                Level.CRITICAL: EXIT_CRITICAL,
            }[report.level]
        time.sleep(args.interval)


if __name__ == "__main__":
    raise SystemExit(main())
