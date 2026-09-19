#!/usr/bin/env python3
"""Dead-man heartbeat: ping an off-box service ONLY while the bot is healthy.

    KRIPTO_DEADMAN_URL=https://... python scripts/deadman.py --state <path>
    python scripts/deadman.py --state <path> --url-file ~/.config/kripto/deadman.url
    python scripts/deadman.py --state <path> --interval 60     # keep running

The point that makes this worth having: **the ping is gated on the health
report.** A heartbeat that fires unconditionally from a timer keeps saying
"alive" while the trading loop is frozen, the data feed is dead and the clock
has drifted - it monitors the timer, not the bot. Here, a CRITICAL check means
no ping goes out, the external service stops hearing from us, and it alerts.

That inversion is also why this covers what the in-host watchdog cannot: if
the machine dies, the pings stop by themselves.

This repository does not start, configure or pay for the receiving service.
You choose one and put its URL where this script can read it - never in the
repository, never in a committed file.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src"))

from kripto.ops.watchdog import Action, Level, Watchdog  # noqa: E402
from kripto.policy import load_policy  # noqa: E402
from kripto.redact import install_redaction  # noqa: E402

EXIT_PINGED = 0
EXIT_WITHHELD = 1
EXIT_MISCONFIGURED = 2


def mask(url: str) -> str:
    """A ping URL is a capability. Never print it whole."""
    if not url:
        return "(unset)"
    try:
        from urllib.parse import urlparse

        parsed = urlparse(url)
        # The netloc can carry the capability itself: user:token@host, or a
        # token as the hostname's first label (token.hc.example). Keep only
        # the scheme and the registrable domain (audit finding).
        host = parsed.hostname or ""
        labels = host.split(".")
        shown = ".".join(labels[-2:]) if len(labels) > 2 else host
        if len(labels) > 2:
            shown = "***." + shown
        return f"{parsed.scheme}://{shown}/***"
    except Exception:  # noqa: BLE001
        return "***"


def resolve_url(args) -> str | None:
    if args.url_file:
        path = Path(args.url_file).expanduser()
        if path.is_file():
            return path.read_text(encoding="utf-8").strip()
        return None
    return os.environ.get("KRIPTO_DEADMAN_URL") or None


def should_ping(report) -> tuple[bool, str]:
    """Healthy enough to say "still here"?

    WARN still pings: a warning is something to look at, not a reason to fire
    the emergency alarm. CRITICAL - or anything that recommends halting
    entries or calling a human - withholds the ping.
    """
    if report.level is Level.CRITICAL:
        return False, "; ".join(f"{c.name}: {c.message}" for c in report.failures)
    if report.action is not Action.NONE:
        return False, f"health recommends {report.action.value}"
    return True, "all checks healthy"


def ping(url: str, timeout: float) -> tuple[bool, str]:
    try:
        request = urllib.request.Request(url, method="GET",
                                         headers={"User-Agent": "kripto-deadman/1"})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return 200 <= response.status < 300, f"HTTP {response.status}"
    except Exception as exc:  # noqa: BLE001 - never raise out of a monitor
        return False, f"{type(exc).__name__}: {exc}"


def run_once(args, url: str) -> int:
    policy = load_policy(args.policy)
    report = Watchdog(args.state, policy, timeframe=args.timeframe).run()
    allowed, reason = should_ping(report)
    stamp = datetime.now(timezone.utc).strftime("%H:%M:%SZ")

    if not allowed:
        print(f"{stamp} PING WITHHELD ({report.level.value}) - {reason}", flush=True)
        print(f"{stamp}   the receiving service will stop hearing from us and "
              f"should alert you", flush=True)
        return EXIT_WITHHELD

    ok, detail = ping(url, args.timeout)
    if ok:
        print(f"{stamp} pinged {mask(url)} - {reason}", flush=True)
        return EXIT_PINGED

    # A failed send is not a failed bot. Say which one it is.
    print(f"{stamp} bot is healthy but the ping FAILED to send: {detail}", flush=True)
    print(f"{stamp}   target {mask(url)} - check the network, not the bot", flush=True)
    return EXIT_WITHHELD


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state", default=str(REPO_ROOT / "user_data" / "dryrun" / "risk_state.sqlite"))
    parser.add_argument("--policy", default=str(REPO_ROOT / "config" / "policy.yaml"))
    parser.add_argument("--timeframe", default="4h")
    parser.add_argument("--url-file", default=None,
                        help="file holding the ping URL; preferred over the env var")
    parser.add_argument("--interval", type=float, default=0.0, help="0 = run once and exit")
    parser.add_argument("--timeout", type=float, default=15.0)
    return parser.parse_args(argv)


def main(argv=None) -> int:
    install_redaction()
    args = parse_args(argv)

    url = resolve_url(args)
    if not url:
        print(
            "no ping URL. Set KRIPTO_DEADMAN_URL or pass --url-file.\n"
            "Pick an external heartbeat service yourself and store its URL outside "
            "this repository - it is a capability, not a setting.",
            file=sys.stderr,
        )
        return EXIT_MISCONFIGURED
    if not url.startswith("https://"):
        print("the ping URL must be https. Refusing to send over plain HTTP.",
              file=sys.stderr)
        return EXIT_MISCONFIGURED

    if args.interval <= 0:
        return run_once(args, url)

    while True:
        run_once(args, url)
        time.sleep(args.interval)


if __name__ == "__main__":
    raise SystemExit(main())
