"""The data manifest: what we have, where it came from, and what is missing.

A report that says "backtested on 12 months of data" is only meaningful if
the manifest behind it can name the exchange, the market id, the first and
last candle, every gap, and the hash of the exact bytes used. This module
produces that record.
"""

from __future__ import annotations

import json
import platform
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MANIFEST_VERSION = 1


def build_manifest(
    *,
    exchange: str,
    source_url: str,
    results: list[Any],
    markets: dict[str, Any],
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "manifest_version": MANIFEST_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "exchange": exchange,
        "source_url": source_url,
        "//source_warning": (
            "Every row below was fetched from the exchange named above. Data from "
            "any other venue must never be merged into these files or labelled as "
            "this exchange's history."
        ),
        "environment": {
            "python": platform.python_version(),
            "platform": platform.platform(),
        },
        "markets": markets,
        "coverage": [r.as_dict() if hasattr(r, "as_dict") else r for r in results],
        **(extra or {}),
    }


def merge_with_previous(manifest: dict[str, Any], previous: dict[str, Any] | None) -> dict[str, Any]:
    """Keep coverage records this run did not touch.

    A run for one timeframe used to REPLACE the whole manifest, erasing the
    hash and gap record of every other timeframe on disk (audit finding).
    Records are keyed by (pair, timeframe); this run's entries win, the
    previous run's entries for other keys are carried over and marked with
    the time they were last collected.
    """
    if not previous:
        return manifest
    merged = dict(manifest)
    new_keys = {(c.get("pair"), c.get("timeframe")) for c in manifest.get("coverage", [])}
    carried = []
    for entry in previous.get("coverage", []):
        key = (entry.get("pair"), entry.get("timeframe"))
        if key in new_keys:
            continue
        kept = dict(entry)
        kept.setdefault("collected_at", previous.get("generated_at"))
        carried.append(kept)
    merged["coverage"] = list(manifest.get("coverage", [])) + carried
    markets = dict(previous.get("markets", {}))
    markets.update(manifest.get("markets", {}))
    merged["markets"] = markets
    return merged


def read_manifest(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def write_manifest(manifest: dict[str, Any], path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    for entry in manifest.get("coverage", []):
        entry.setdefault("collected_at", manifest.get("generated_at"))
    merged = merge_with_previous(manifest, read_manifest(path))
    path.write_text(json.dumps(merged, indent=2, sort_keys=False), encoding="utf-8")
    return path
