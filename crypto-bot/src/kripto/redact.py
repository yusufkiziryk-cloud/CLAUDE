"""Secret redaction for logs, tracebacks, URLs, headers and reports.

This is a defence in depth layer, not a security boundary. The real boundary
is that production secrets never enter this process in the first place (see
docs/RUNBOOK.md). What this module buys us is that an accidental
``logger.info(config)`` or an exception carrying a signed request body does
not write a usable secret to disk.
"""

from __future__ import annotations

import logging
import re
from typing import Any

# Keys whose *values* are always masked, matched case-insensitively against
# the whole key or any underscore/dash separated part of it.
SECRET_KEY_PARTS = frozenset(
    {
        "password",
        "passwd",
        "secret",
        "token",
        "apikey",
        "api_key",
        "apisecret",
        "privatekey",
        "private_key",
        "key",
        "mnemonic",
        "seed",
        "seedphrase",
        "passphrase",
        "authorization",
        "auth",
        "cookie",
        "signature",
        "sig",
        "credential",
        "credentials",
        "chat_id",
        "chatid",
        "walletaddress",
        "wallet_address",
        "jwt",
    }
)

MASK = "***REDACTED***"

# Value-shaped patterns, for secrets that arrive without a helpful key name
# (inside a URL, a traceback, a raw HTTP dump).
_VALUE_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    # 0x + 64 hex = an EVM private key. Longest first so it wins over the
    # 40-hex address pattern below.
    ("evm_private_key", re.compile(r"\b0x[0-9a-fA-F]{64}\b")),
    ("evm_address", re.compile(r"\b0x[0-9a-fA-F]{40}\b")),
    # Telegram bot token: <digits>:<30+ base64-ish chars>. No leading \b: the
    # token is usually glued to a path segment ("/bot123456:AA..."), and "t1"
    # is not a word boundary, so \b would silently never match there.
    ("telegram_token", re.compile(r"(?<!\d)\d{6,12}:[A-Za-z0-9_-]{30,}")),
    # "Authorization: Bearer <token>" must be handled BEFORE the generic
    # key=value rule, which would otherwise mask the word "Bearer" and leave
    # the token itself in the clear.
    ("bearer", re.compile(r"(?i)\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}")),
    # key=value / key: value inside URLs, query strings and free text.
    (
        "inline_kv",
        re.compile(
            r"(?i)\b(" + "|".join(sorted(SECRET_KEY_PARTS, key=len, reverse=True)) + r")"
            r"(\s*[=:]\s*|%3D)"
            r"([^\s,&;'\"})\]]+)"
        ),
    ),
)


def _key_is_secret(key: str) -> bool:
    lowered = key.lower()
    if lowered in SECRET_KEY_PARTS:
        return True
    parts = re.split(r"[_\-\s.]+", lowered)
    return any(part in SECRET_KEY_PARTS for part in parts)


def redact_text(text: str) -> str:
    """Mask secret-shaped substrings in free text."""
    if not text:
        return text
    result = text
    for name, pattern in _VALUE_PATTERNS:
        if name == "inline_kv":
            result = pattern.sub(
                lambda m: m.group(0) if m.group(3).startswith("***") 
                else f"{m.group(1)}{m.group(2)}{MASK}",
                result,
            )
        elif name == "bearer":
            result = pattern.sub(lambda m: f"{m.group(1)} {MASK}", result)
        else:
            result = pattern.sub(MASK, result)
    return result


def redact(value: Any, _depth: int = 0) -> Any:
    """Recursively mask secrets in dicts, lists, tuples and strings.

    Values under a secret-looking key are replaced wholesale; everything else
    is scanned for secret-shaped content.
    """
    if _depth > 20:
        return "<max-depth>"
    if isinstance(value, dict):
        out = {}
        for key, item in value.items():
            if isinstance(key, str) and _key_is_secret(key):
                out[key] = MASK if item not in (None, "", {}, []) else item
            else:
                out[key] = redact(item, _depth + 1)
        return out
    if isinstance(value, (list, tuple, set)):
        rendered = [redact(item, _depth + 1) for item in value]
        return type(value)(rendered) if not isinstance(value, set) else set(rendered)
    if isinstance(value, str):
        return redact_text(value)
    return value


class RedactingFilter(logging.Filter):
    """Logging filter that masks the formatted message and the traceback.

    Installed on the root logger by ``install_redaction()`` so that it also
    covers freqtrade's and ccxt's own loggers.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            if record.args:
                record.msg = record.getMessage()
                record.args = ()
            if isinstance(record.msg, str):
                record.msg = redact_text(record.msg)
            if record.exc_info and record.exc_info[1] is not None:
                exc = record.exc_info[1]
                cleaned = tuple(redact(arg) for arg in getattr(exc, "args", ()))
                try:
                    exc.args = cleaned
                except Exception:  # some exceptions have read-only args
                    pass
            if record.exc_text:
                record.exc_text = redact_text(record.exc_text)
        except Exception:
            # A failure in redaction must never swallow the log record that
            # was being emitted, but it also must not emit unmasked text.
            record.msg = "<redaction failed; message suppressed>"
            record.args = ()
        return True


def install_redaction(logger: logging.Logger | None = None) -> RedactingFilter:
    """Attach the redacting filter to a logger and all of its handlers."""
    target = logger if logger is not None else logging.getLogger()
    filt = RedactingFilter()
    target.addFilter(filt)
    for handler in target.handlers:
        handler.addFilter(filt)
    return filt
