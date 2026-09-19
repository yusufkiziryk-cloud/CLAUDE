#!/usr/bin/env python3
"""Operator tool for the risk state: look, and make the few changes only a
human may make.

    scripts/risk-state.py show      --state user_data/dryrun/risk_state.sqlite
    scripts/risk-state.py set READY --state ... --reason "reviewed: position X is mine" --operator-ack
    scripts/risk-state.py clear-lock <lock_id> --state ... --reason "..." --operator-ack
    scripts/risk-state.py release <intent_id> --state ... --reason "..." --operator-ack

RECOVERY_REQUIRED and the operator-only locks (MAX_DRAWDOWN, RECONCILIATION,
OPERATOR) exist precisely so that the bot does not clear them itself. This is
the hand that clears them, and it leaves a trail: every change needs
``--operator-ack`` and a reason, and both are written into the state.

It cannot start live trading, place orders, or touch keys. It writes only to
the risk state file, and it refuses to change anything while a bot process on
this host holds the writer lock unless ``--while-running`` is given (the bot
re-reads the state every loop, so a state change is safe; a lock or
reservation change while it runs is your call).
"""

from __future__ import annotations

import argparse
import os
import socket
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from kripto.risk.state import BotState, RiskStore, _pid_alive  # noqa: E402


def show(store: RiskStore, now: datetime) -> None:
    print(f"state:        {store.get_state().value}")
    holder = store.writer_lock_holder()
    if holder:
        alive = holder["host"] == socket.gethostname() and _pid_alive(int(holder["pid"]))
        print(
            f"writer lock:  {holder['owner']} (pid {holder['pid']} on {holder['host']}, "
            f"heartbeat {holder['heartbeat_at']}, {'ALIVE' if alive else 'not running here'})"
        )
    else:
        print("writer lock:  none")
    print(f"peak equity:  {store.get_peak_equity()}")
    print(f"stops:        {store.consecutive_stops()} consecutive")
    locks = store.active_locks(now)
    print(f"active locks: {len(locks)}")
    for lock in locks:
        expiry = lock.expires_at.isoformat() if lock.expires_at else "operator only"
        print(f"  {lock.lock_id}  {lock.kind.value:18} {lock.pair or '*':10} until {expiry}  {lock.reason}")
    reservations = store.open_reservations()
    print(f"open reservations: {len(reservations)}")
    for r in reservations:
        print(f"  {r.intent_id}  {r.pair:10} {r.state.value:16} amount {r.amount_base} risk {r.risk_quote} since {r.created_at.isoformat()}")
    pending = store.pending_entries()
    print(f"pending approvals: {len(pending)}")
    for p in pending:
        print(f"  {p['intent_id']}  {p['pair']:10} stop {p['stop_price']} since {p['created_at'].isoformat()}")


def guard_running(store: RiskStore, allow: bool) -> None:
    holder = store.writer_lock_holder()
    if not holder:
        return
    if holder["host"] == socket.gethostname() and _pid_alive(int(holder["pid"])):
        if allow:
            print(f"note: bot pid {holder['pid']} is running; it will see this change on its next loop")
            return
        print(
            f"refusing: bot pid {holder['pid']} holds the writer lock on this host. "
            "Stop it first, or pass --while-running if you know what you are changing.",
            file=sys.stderr,
        )
        sys.exit(2)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["show", "set", "clear-lock", "release"])
    parser.add_argument("target", nargs="?", help="state name, lock id or intent id")
    parser.add_argument("--state", required=True, help="path to risk_state.sqlite")
    parser.add_argument("--reason", default="")
    parser.add_argument("--operator-ack", action="store_true")
    parser.add_argument("--while-running", action="store_true")
    args = parser.parse_args(argv)

    now = datetime.now(timezone.utc)
    if not Path(args.state).is_file():
        print(f"no state file at {args.state}", file=sys.stderr)
        return 1
    store = RiskStore(args.state)
    try:
        if args.command == "show":
            show(store, now)
            return 0

        if not args.operator_ack or not args.reason.strip():
            print("changes need --operator-ack and a non-empty --reason", file=sys.stderr)
            return 2
        if not args.target:
            print("missing target", file=sys.stderr)
            return 2
        guard_running(store, args.while_running)
        who = f"operator {os.environ.get('USER', 'unknown')}@{socket.gethostname()}"

        if args.command == "set":
            try:
                target = BotState(args.target.upper())
            except ValueError:
                print(f"unknown state {args.target}; one of {[s.value for s in BotState]}", file=sys.stderr)
                return 2
            store.set_state(target, f"{who}: {args.reason}", now)
            print(f"state -> {target.value}")
        elif args.command == "clear-lock":
            store.clear_lock(args.target, now, operator_ack=True)
            print(f"lock {args.target} cleared ({who}: {args.reason})")
        elif args.command == "release":
            reservation = store.get_reservation(args.target)
            if reservation is None:
                print(f"no reservation {args.target}", file=sys.stderr)
                return 1
            store.release(args.target, f"{who}: {args.reason}", now)
            print(f"reservation {args.target} released")
        show(store, now)
        return 0
    finally:
        store.close()


if __name__ == "__main__":
    sys.exit(main())
