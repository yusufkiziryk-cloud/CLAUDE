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


def write_manifest(manifest: dict[str, Any], path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, indent=2, sort_keys=False), encoding="utf-8")
    return path
