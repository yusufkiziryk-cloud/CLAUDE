#!/usr/bin/env python3
"""The only supported entry point for running the bot.

Usage:
    python scripts/safe-run.py trade
    python scripts/safe-run.py trade --config config/config.dry.json
    python scripts/safe-run.py backtesting --timerange 20250401-20260301

Everything after the subcommand is passed through to freqtrade unchanged,
except that ``--dry-run`` is always appended for trade runs.

This script cannot start live trading. There is no flag for it. Going live
is a manual operator procedure documented in docs/LIVE_READINESS.md, and it
is deliberately not automated anywhere in this repository.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src"))

from kripto.launcher import (  # noqa: E402
    LiveModeRejected,
    assert_dry_run,
    audit_summary,
    build_effective_config,
)
from kripto.policy import PolicyError, load_policy  # noqa: E402
from kripto.redact import install_redaction  # noqa: E402

DEFAULT_CONFIG = REPO_ROOT / "config" / "config.dry.json"
DEFAULT_POLICY = REPO_ROOT / "config" / "policy.yaml"

# Subcommands that can reach the exchange with write intent. These get the
# strictest treatment plus an explicit --dry-run.
TRADING_COMMANDS = {"trade"}


def extract_config_paths(argv: list[str]) -> list[str]:
    """Collect every -c/--config argument, in the order freqtrade sees them."""
    paths: list[str] = []
    index = 0
    while index < len(argv):
        arg = argv[index]
        if arg in ("-c", "--config"):
            if index + 1 < len(argv):
                paths.append(argv[index + 1])
                index += 1
        elif arg.startswith("--config="):
            paths.append(arg.split("=", 1)[1])
        index += 1
    return paths or [str(DEFAULT_CONFIG)]


def main(argv: list[str] | None = None) -> int:
    install_redaction()
    args = list(sys.argv[1:] if argv is None else argv)

    if not args:
        print(__doc__)
        return 2

    command = args[0]
    config_paths = extract_config_paths(args)

    # --- our own policy must be valid before anything else ----------------
    try:
        policy = load_policy(DEFAULT_POLICY)
    except PolicyError as exc:
        print(f"POLICY REJECTED\n{exc}", file=sys.stderr)
        return 3

    # --- the effective freqtrade config must be a keyless dry run ---------
    try:
        config = build_effective_config(config_paths)
        audit = assert_dry_run(config, config_files=config_paths)
    except LiveModeRejected as exc:
        print(f"\n{exc}\n", file=sys.stderr)
        return 4
    except Exception as exc:  # malformed config, missing file, ...
        print(f"CONFIG COULD NOT BE LOADED: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 5

    print("=" * 72)
    print("kripto-bot safe launcher")
    print("=" * 72)
    print(audit_summary(audit))
    print(f"policy         : {policy.meta['policy_id']} ({policy.policy_hash[:19]}...)")
    print(f"exchange       : {policy.exchange['id']} / {policy.exchange['trading_mode']}")
    print(
        "stop-on-exchange: "
        f"{'AVAILABLE' if policy.exchange['stoploss_on_exchange_available'] else 'NOT AVAILABLE (LIVE_BLOCKER)'}"
    )
    print("=" * 72)

    forwarded = list(args)
    if command in TRADING_COMMANDS and "--dry-run" not in forwarded:
        # Belt and braces: freqtrade's own flag also strips exchange secrets.
        forwarded.append("--dry-run")

    from freqtrade.main import main as freqtrade_main

    try:
        freqtrade_main(forwarded)
    except SystemExit as exc:
        return int(exc.code or 0)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
