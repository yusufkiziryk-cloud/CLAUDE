#!/usr/bin/env python3
"""Back up the bot's state, and prove the backup restores.

    python scripts/backup.py                      # take a backup
    python scripts/backup.py --verify             # take one AND restore it
    python scripts/backup.py --verify-only <dir>  # check an existing backup

Two things make this more than `cp`:

* **The databases are live.** Copying a SQLite file while a process is writing
  can capture a torn page or miss a WAL that has not been checkpointed. The
  backup goes through SQLite's own backup API, which produces a consistent
  snapshot of a database that is being written to.
* **An unverified backup is not a backup.** `--verify` restores into a
  temporary directory and checks the result: integrity_check passes, the
  tables that must exist do exist, and the row counts match the source. A
  backup nobody has restored is a hope.

Secrets are not backed up, because none are stored in this repository.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sqlite3
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src"))

from kripto.redact import install_redaction  # noqa: E402

# (source path, tables that must survive the round trip)
DATABASES = {
    "risk_state.sqlite": ("bot_state", "periods", "locks", "reservations", "entry_decisions"),
    "tradesv3.dryrun.sqlite": ("trades", "orders"),
}
PLAIN_FILES = ["policy.yaml", "config.dry.json"]


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return "sha256:" + digest.hexdigest()


def snapshot_database(source: Path, target: Path) -> None:
    """Consistent copy of a database that may be in use.

    Opened read-only, copied through SQLite's backup API, so a concurrent
    writer cannot hand us a half-written page.
    """
    src = sqlite3.connect(f"file:{source}?mode=ro", uri=True, timeout=30.0)
    dst = sqlite3.connect(str(target))
    try:
        src.backup(dst)
        dst.commit()
    finally:
        dst.close()
        src.close()


def table_counts(path: Path, tables: tuple[str, ...]) -> dict[str, int | None]:
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    counts: dict[str, int | None] = {}
    try:
        for table in tables:
            try:
                counts[table] = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            except sqlite3.Error:
                counts[table] = None  # table absent - reported, not hidden
    finally:
        conn.close()
    return counts


def take_backup(args) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = Path(args.out) / stamp
    out.mkdir(parents=True, exist_ok=False)

    manifest: dict = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source_dir": str(Path(args.state_dir).resolve()),
        "databases": {},
        "files": {},
        "//": "Contains no credentials: none are stored in this repository.",
    }

    for name, tables in DATABASES.items():
        source = Path(args.state_dir) / name
        if not source.is_file():
            manifest["databases"][name] = {"status": "ABSENT"}
            print(f"  {name:28} ABSENT (nothing to back up yet)")
            continue
        target = out / name
        snapshot_database(source, target)
        counts = table_counts(target, tables)
        manifest["databases"][name] = {
            "status": "OK",
            "hash": file_hash(target),
            "bytes": target.stat().st_size,
            "row_counts": counts,
        }
        print(f"  {name:28} {target.stat().st_size:>9,} B  {counts}")

    for name in PLAIN_FILES:
        for candidate in (Path(args.config_dir) / name, Path(args.state_dir) / name):
            if candidate.is_file():
                shutil.copy2(candidate, out / name)
                manifest["files"][name] = file_hash(out / name)
                print(f"  {name:28} copied")
                break
        else:
            manifest["files"][name] = None

    (out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return out


def verify_backup(backup_dir: Path) -> bool:
    """Restore into a temp directory and check the result is usable."""
    manifest_path = backup_dir / "manifest.json"
    if not manifest_path.is_file():
        print(f"FAIL: no manifest in {backup_dir}")
        return False
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    ok = True
    with tempfile.TemporaryDirectory() as tmp:
        restored = Path(tmp)
        for name, info in manifest["databases"].items():
            if info.get("status") != "OK":
                continue
            source = backup_dir / name
            if not source.is_file():
                print(f"FAIL: {name} listed in the manifest but missing from the backup")
                ok = False
                continue

            # A real restore: copy it out, then open the copy.
            target = restored / name
            shutil.copy2(source, target)

            if file_hash(target) != info["hash"]:
                print(f"FAIL: {name} hash mismatch after restore")
                ok = False
                continue

            conn = sqlite3.connect(str(target))
            try:
                integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
            finally:
                conn.close()
            if integrity != "ok":
                print(f"FAIL: {name} integrity_check returned {integrity!r}")
                ok = False
                continue

            counts = table_counts(target, tuple(info["row_counts"]))
            if counts != info["row_counts"]:
                print(f"FAIL: {name} row counts changed: {info['row_counts']} -> {counts}")
                ok = False
                continue

            missing = [t for t, c in counts.items() if c is None]
            if missing:
                print(f"FAIL: {name} is missing table(s) {missing}")
                ok = False
                continue

            print(f"  {name:28} restored OK  integrity=ok  {counts}")

    return ok


def rotate(root: Path, keep: int) -> None:
    backups = sorted(p for p in root.iterdir() if p.is_dir() and (p / "manifest.json").is_file())
    for old in backups[:-keep] if keep > 0 else []:
        shutil.rmtree(old)
        print(f"  rotated out: {old.name}")


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state-dir", default=str(REPO_ROOT / "user_data" / "dryrun"))
    parser.add_argument("--config-dir", default=str(REPO_ROOT / "config"))
    parser.add_argument("--out", default=str(REPO_ROOT / "backups"))
    parser.add_argument("--keep", type=int, default=14, help="0 keeps everything")
    parser.add_argument("--verify", action="store_true", help="restore the new backup and check it")
    parser.add_argument("--verify-only", default=None, metavar="DIR")
    return parser.parse_args(argv)


def main(argv=None) -> int:
    install_redaction()
    args = parse_args(argv)

    if args.verify_only:
        print(f"verifying {args.verify_only}")
        return 0 if verify_backup(Path(args.verify_only)) else 1

    print("backing up ...")
    out = take_backup(args)
    rotate(Path(args.out), args.keep)
    print(f"written: {out}")

    if args.verify:
        print("\nrestoring it back to check ...")
        if not verify_backup(out):
            print("\nBACKUP VERIFICATION FAILED - do not rely on this backup")
            return 1
        print("\nverified: this backup restores cleanly")
    else:
        print("\nNOT VERIFIED. Run with --verify at least weekly; an unrestored "
              "backup is a hope, not a backup.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
