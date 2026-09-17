"""Optional notifications that can never block or break the trading loop.

Two rules, both learned from the failure mode where a monitoring system
takes down the thing it was monitoring:

1. **Delivery is best effort.** A dead Telegram must not stop stop-loss
   management, so every send failure is swallowed, counted and reported as a
   health signal - never raised into the caller.
2. **The queue is bounded.** An outage that lasts hours must not grow a
   queue until the process runs out of memory. Old messages are dropped
   first, and the drop is counted so the report can say so.

Notifications are entirely optional. With no transport configured the bot
runs normally and this class is a no-op that still records health.
"""

from __future__ import annotations

import logging
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable

from ..redact import redact_text

logger = logging.getLogger(__name__)

MAX_QUEUE = 200


@dataclass
class Notification:
    text: str
    created_at: datetime
    attempts: int = 0


@dataclass
class Notifier:
    """Bounded, non-blocking, redacting notification sink."""

    transport: Callable[[str], None] | None = None
    """Anything that takes a string. None means notifications are disabled."""

    recorder: object | None = None
    """Optional HealthRecorder, so outages show up in the health report."""

    max_attempts: int = 3
    max_queue: int = MAX_QUEUE

    queue: deque[Notification] = field(default_factory=lambda: deque(maxlen=MAX_QUEUE))
    dropped: int = 0
    delivered: int = 0
    failed: int = 0

    def __post_init__(self):
        if self.queue.maxlen != self.max_queue:
            self.queue = deque(self.queue, maxlen=self.max_queue)

    @property
    def enabled(self) -> bool:
        return self.transport is not None

    def send(self, text: str, now: datetime) -> bool:
        """Queue and attempt a message. NEVER raises.

        Returns whether this particular message was delivered, which callers
        are free to ignore - and mostly should.
        """
        if not self.enabled:
            return False

        # Mode and secrets: the message says DRY-RUN where relevant, and no
        # key, address or token survives redaction.
        safe = redact_text(text)

        if len(self.queue) == self.queue.maxlen:
            self.dropped += 1
            logger.warning(
                "notification queue full (%d); dropping the oldest message", self.max_queue
            )
        self.queue.append(Notification(safe, now))
        return self.flush(now)

    def flush(self, now: datetime) -> bool:
        """Try to drain the queue. Never raises, never blocks indefinitely."""
        if not self.enabled:
            return False

        delivered_any = False
        remaining: deque[Notification] = deque(maxlen=self.queue.maxlen)

        while self.queue:
            item = self.queue.popleft()
            item.attempts += 1
            try:
                self.transport(item.text)  # type: ignore[misc]
                self.delivered += 1
                delivered_any = True
            except BaseException as exc:  # noqa: BLE001 - deliberate catch-all
                self.failed += 1
                logger.warning(
                    "notification delivery failed (attempt %d/%d): %s: %s",
                    item.attempts, self.max_attempts, type(exc).__name__, exc,
                )
                if item.attempts < self.max_attempts:
                    remaining.append(item)
                else:
                    self.dropped += 1
                # Stop trying the rest this round; the transport is clearly down.
                remaining.extend(self.queue)
                self.queue.clear()
                break

        self.queue = remaining

        if self.recorder is not None:
            try:
                self.recorder.record_notification_result(now, delivered_any)  # type: ignore[attr-defined]
            except BaseException:  # noqa: BLE001
                logger.warning("could not record notification health", exc_info=True)

        return delivered_any


def format_health(report, *, mode: str, version: str) -> str:
    """A health message that names the mode, loudly.

    Anyone reading an alert must be able to tell at a glance whether it came
    from a simulation or from something touching real money.
    """
    lines = [
        f"[{mode.upper()}] kripto-bot health: {report.level.value}",
        f"version: {version}",
        f"action: {report.action.value}",
    ]
    for check in report.failures:
        lines.append(f"  {check.level.value} {check.name}: {check.message} ({check.measured})")
    if not report.failures:
        lines.append("  all checks passing")
    return "\n".join(lines)
