#!/usr/bin/env python3
"""The only supported entry point for running the bot.

Usage:
    python scripts/safe-run.py trade
    python scripts/safe-run.py trade --config config/config.dry.json
    python scripts/safe-run.py backtesting --timerange 20250401-20260301

Everything after the subcommand is passed through to freqtrade unchanged,
except that ``--dry-run`` is always appended for trade runs, ``--cache none``
for backtesting, and ``--config config/config.dry.json`` whenever no
configuration was given (so the audited files ARE the files freqtrade runs).

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

# Commands whose output is evidence. freqtrade caches backtest results for a
# day and silently REUSES them when the strategy file is unchanged - printing
# a full result table with no hint that nothing ran. Every change outside the
# strategy file (the risk layer, the policy, the data) is then invisible, and
# a "reproduced identically" claim becomes a cache hit. So backtesting
# defaults to --cache none; pass --cache explicitly to opt back in.
# lookahead-analysis and recursive-analysis have NO --cache option in
# freqtrade 2026.8 and force backtest_cache="none" internally
# (freqtrade/optimize/analysis/*_helpers.py); passing the flag made argparse
# reject the whole command (audit finding).
UNCACHED_COMMANDS = {"backtesting"}
INTERNALLY_UNCACHED = {"lookahead-analysis", "recursive-analysis"}

# Commands this launcher refuses. `new-config` writes ./config.json, and a
# ./config.json is exactly the file freqtrade picks up when no --config is
# given - a landmine next to the safe configuration.
BLOCKED_COMMANDS = {"new-config"}


def resolve_configs(argv: list[str]) -> tuple[list[str], list[str]]:
    """Return (config paths freqtrade will use, argv to forward).

    Parsed with freqtrade's OWN argument parser, so every spelling it accepts
    (-c X, -cX, --config X, --config=X, --conf X, ...) is seen here too. When
    the user gave no configuration, the shipped dry-run config is injected
    into the forwarded argv: without that, the audit ran on
    config/config.dry.json while freqtrade quietly loaded ./config.json or
    user_data/config.json (audit finding). The audited files and the
    effective files must be the same files.

    Raises SystemExit(2) on arguments freqtrade rejects.
    """
    from freqtrade.commands import Arguments

    arguments = Arguments(argv)
    arguments.get_parsed_arg()  # builds the parser and validates the argv
    raw = arguments.parser.parse_args(argv)
    user_configs = list(getattr(raw, "config", None) or [])
    forwarded = list(argv)
    if "config" in vars(raw) and not user_configs:
        forwarded.extend(["--config", str(DEFAULT_CONFIG)])
        user_configs = [str(DEFAULT_CONFIG)]
    return user_configs, forwarded


def main(argv: list[str] | None = None) -> int:
    install_redaction()
    args = list(sys.argv[1:] if argv is None else argv)

    if not args:
        print(__doc__)
        return 2

    command = args[0]
    if command in BLOCKED_COMMANDS:
        print(
            f"'{command}' is not available through the safe launcher. The bot runs from "
            "config/config.dry.json; do not create a second configuration file.",
            file=sys.stderr,
        )
        return 2

    try:
        config_paths, forwarded = resolve_configs(args)
    except SystemExit as exc:
        # argparse already printed the reason. Never report success for it.
        return int(exc.code) if isinstance(exc.code, int) and exc.code else 2

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

    if command in TRADING_COMMANDS and "--dry-run" not in forwarded:
        # Belt and braces: freqtrade's own flag also strips exchange secrets.
        forwarded.append("--dry-run")

    if command in UNCACHED_COMMANDS and not any(a.startswith("--cache") for a in forwarded):
        forwarded.extend(["--cache", "none"])
        print(
            "note           : --cache none applied. freqtrade would otherwise reuse "
            "today's cached result and print it as if it had just run."
        )
    elif command in INTERNALLY_UNCACHED:
        print("note           : freqtrade forces backtest_cache=none for this command itself.")

    return run_freqtrade(forwarded)


def run_freqtrade(forwarded: list[str]) -> int:
    """Run the subcommand the way freqtrade.main does, but with honest exit codes.

    freqtrade's main() ends in ``finally: sys.exit(return_code)`` with
    return_code still None after an argparse error or a ConfigurationError,
    which turns both into exit status 0 (audit finding). Calling the
    subcommand directly keeps every failure non-zero.
    """
    from freqtrade.commands import Arguments
    from freqtrade.exceptions import ConfigurationError, FreqtradeException
    from freqtrade.loggers import setup_logging_pre
    from freqtrade.system import asyncio_setup, gc_set_threshold, set_mp_start_method

    try:
        setup_logging_pre()
        asyncio_setup()
        parsed = Arguments(forwarded).get_parsed_arg()
        if "func" not in parsed:
            print("no freqtrade subcommand given", file=sys.stderr)
            return 2
        gc_set_threshold()
        set_mp_start_method()
        return_code = parsed["func"](parsed)
    except SystemExit as exc:
        return int(exc.code) if isinstance(exc.code, int) else 2
    except KeyboardInterrupt:
        print("SIGINT received, aborting ...", file=sys.stderr)
        return 130
    except ConfigurationError as exc:
        print(f"CONFIGURATION ERROR: {exc}", file=sys.stderr)
        return 6
    except FreqtradeException as exc:
        print(f"freqtrade error: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:  # noqa: BLE001
        print(f"fatal: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1
    return int(return_code or 0)


if __name__ == "__main__":
    raise SystemExit(main())
