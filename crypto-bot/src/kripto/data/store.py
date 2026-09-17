"""Atomic, idempotent OHLCV storage in freqtrade's own on-disk format.

Two properties matter more than speed here:

* **Atomic** - a crash or a full disk during a write must never leave a
  truncated candle file that later reads as valid data.
* **Idempotent** - re-running a collection must converge to the same file.
  Overlapping re-downloads are normal (we always re-fetch a safety margin of
  recent candles), so merging has to be defined by the uniqueness key rather
  than by append order.
"""

from __future__ import annotations

import hashlib
import logging
import os
import tempfile
from pathlib import Path

import pandas as pd

from .quality import OHLCV_COLUMNS

logger = logging.getLogger(__name__)


def pair_to_filename(pair: str, timeframe: str) -> str:
    """freqtrade's feather naming: BTC/USDC 4h -> BTC_USDC-4h.feather"""
    return f"{pair.replace('/', '_')}-{timeframe}.feather"


def normalise(df: pd.DataFrame) -> pd.DataFrame:
    """Coerce to the canonical column set, dtypes and ordering."""
    frame = df.loc[:, OHLCV_COLUMNS].copy()
    frame["date"] = pd.to_datetime(frame["date"], utc=True)
    for column in ("open", "high", "low", "close", "volume"):
        frame[column] = pd.to_numeric(frame[column], errors="coerce").astype("float64")
    frame = frame.sort_values("date", kind="stable")
    frame = frame.drop_duplicates(subset="date", keep="last")
    return frame.reset_index(drop=True)


def merge_candles(existing: pd.DataFrame | None, incoming: pd.DataFrame) -> pd.DataFrame:
    """Merge on the uniqueness key, newest value wins for a repeated open_time.

    "Newest wins" is deliberate: the most recent fetch of a given candle is the
    settled one, while an older copy may have been captured while the candle
    was still forming.
    """
    incoming = normalise(incoming)
    if existing is None or existing.empty:
        return incoming
    combined = pd.concat([normalise(existing), incoming], ignore_index=True)
    return normalise(combined)


def atomic_write(df: pd.DataFrame, target: Path) -> str:
    """Write to a temp file in the same directory, fsync, then rename.

    The rename is atomic on POSIX, so a reader sees either the old complete
    file or the new complete file, never a half-written one.
    """
    target.parent.mkdir(parents=True, exist_ok=True)
    frame = normalise(df)

    handle, temp_name = tempfile.mkstemp(
        dir=str(target.parent), prefix=f".{target.name}.", suffix=".tmp"
    )
    os.close(handle)
    temp_path = Path(temp_name)
    try:
        frame.to_feather(temp_path, compression="lz4")
        with open(temp_path, "rb") as fh:
            os.fsync(fh.fileno())
        os.replace(temp_path, target)
        # Also fsync the directory so the rename itself survives a power cut.
        dir_fd = os.open(str(target.parent), os.O_RDONLY)
        try:
            os.fsync(dir_fd)
        finally:
            os.close(dir_fd)
    except BaseException:
        temp_path.unlink(missing_ok=True)
        raise

    return file_hash(target)


def read_candles(path: Path) -> pd.DataFrame | None:
    if not path.is_file():
        return None
    return normalise(pd.read_feather(path))


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return "sha256:" + digest.hexdigest()


def frame_hash(df: pd.DataFrame) -> str:
    """Content hash independent of file encoding, for manifests and reports."""
    frame = normalise(df)
    payload = frame.to_csv(index=False).encode("utf-8")
    return "sha256:" + hashlib.sha256(payload).hexdigest()
