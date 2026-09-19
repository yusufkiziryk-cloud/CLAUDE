"""Safe launcher: the only supported way to start this bot.

The threat this guards against is not malice, it is a slip: a stray
``FREQTRADE__DRY_RUN=false`` inherited from a shell, a second ``-c`` file
that deep-merges live settings over the safe ones, a copied config with a
leftover private key.

The check deliberately runs against the *effective* configuration computed
by freqtrade's own loader, not against a re-implementation of it. If
freqtrade changes how it merges files and environment variables, this check
changes with it instead of drifting into a comfortable lie.

There is no flag, env var or argument in this module that enables live
trading. Enabling live trading is a manual operator procedure documented in
docs/LIVE_READINESS.md, and this repository does not automate it.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping, Sequence

from freqtrade.configuration.environment_vars import _flat_vars_to_nested_dict
from freqtrade.configuration.load_config import load_from_files
from freqtrade.constants import ENV_VAR_PREFIX
from freqtrade.misc import deep_merge_dicts

from .redact import redact

# Exchange credential fields. Any of these being non-empty in a development
# session means a real secret has entered a process that must never hold one.
# Matched by NORMALISED name (lower case, letters only) at ANY depth of the
# exchange section: freqtrade deep-merges exchange.ccxt_config /
# ccxt_sync_config / ccxt_async_config straight into the ccxt constructor, so
# a privateKey placed there is a live signing key even in a dry run, and
# freqtrade's --dry-run credential stripping does not touch it (audit finding).
SECRET_CONFIG_KEYS = (
    "key",
    "secret",
    "password",
    "passphrase",
    "uid",
    "privateKey",
    "private_key",
    "walletAddress",
    "wallet_address",
    "apiKey",
    "api_key",
    "apiSecret",
    "api_secret",
    "accountId",
    "account_id",
    "token",
    "authorization",
)
_SECRET_NAMES = frozenset(re.sub(r"[^a-z]", "", k.lower()) for k in SECRET_CONFIG_KEYS)
_SECRET_SUFFIXES = ("key", "secret", "password", "passphrase", "token")


def _looks_like_credential(name: str) -> bool:
    normalised = re.sub(r"[^a-z]", "", str(name).lower())
    return normalised in _SECRET_NAMES or normalised.endswith(_SECRET_SUFFIXES)


def find_credentials(mapping: Mapping[str, Any], prefix: str = "exchange") -> list[str]:
    """Dotted paths of every populated credential-looking field, at any depth."""
    found: list[str] = []
    for key, value in mapping.items():
        path = f"{prefix}.{key}"
        if isinstance(value, Mapping):
            found.extend(find_credentials(value, path))
        elif _looks_like_credential(key) and isinstance(value, str) and value.strip():
            found.append(path)
    return found


class LiveModeRejected(RuntimeError):
    """Raised when the effective configuration is not a keyless dry run.

    Always fatal. Never caught and downgraded to a warning.
    """


@dataclass
class ConfigAudit:
    """Result of auditing an effective configuration."""

    dry_run: bool | None
    violations: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)
    env_overrides: list[str] = field(default_factory=list)

    @property
    def safe(self) -> bool:
        return not self.violations


def build_effective_config(
    config_files: Sequence[str | Path],
    environ: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    """Compute the configuration freqtrade will actually run with.

    Mirrors freqtrade's precedence: config files are deep-merged in order,
    then ``FREQTRADE__*`` environment variables are merged on top.
    """
    env = os.environ if environ is None else environ

    config: dict[str, Any] = load_from_files([str(path) for path in config_files])
    env_config = _flat_vars_to_nested_dict(dict(env), ENV_VAR_PREFIX)
    if env_config:
        # Same precedence as freqtrade: environment variables win over files.
        config = deep_merge_dicts(env_config, config)
    return config


def _collect_env_overrides(environ: Mapping[str, str]) -> list[str]:
    return sorted(name for name in environ if name.startswith(ENV_VAR_PREFIX))


def audit_config(
    config: Mapping[str, Any],
    environ: Mapping[str, str] | None = None,
    *,
    config_files: Sequence[str | Path] = (),
) -> ConfigAudit:
    """Audit an effective configuration for keyless-dry-run safety.

    Returns the findings rather than raising, so that callers (and tests) can
    inspect every violation at once instead of only the first.
    """
    env = os.environ if environ is None else environ
    audit = ConfigAudit(
        dry_run=config.get("dry_run") if isinstance(config.get("dry_run"), bool) else None,
        sources=[str(path) for path in config_files],
        env_overrides=_collect_env_overrides(env),
    )

    # --- 1. dry_run must be present and be the boolean True ---------------
    if "dry_run" not in config:
        audit.violations.append(
            "dry_run is missing from the effective configuration. It is a required "
            "key for trade mode and has no safe default - refusing to guess."
        )
    else:
        raw = config["dry_run"]
        if raw is not True:
            audit.violations.append(
                f"dry_run must be the boolean true, got {raw!r} "
                f"({type(raw).__name__}). This launcher only starts dry runs."
            )

    # --- 2. name the environment variable that tried to flip it -----------
    for name in audit.env_overrides:
        tail = name[len(ENV_VAR_PREFIX) :].upper()
        if tail in ("DRY_RUN", "DRY__RUN"):
            value = env[name]
            if str(value).strip().lower() in ("f", "false", "0", "no"):
                audit.violations.append(
                    f"environment variable {name}={value!r} attempts to disable dry run. "
                    "Refusing to start. Unset it in the shell that launches the bot."
                )
        if any(secret.upper() in tail for secret in ("KEY", "SECRET", "PASSWORD", "WALLET")):
            audit.violations.append(
                f"environment variable {name} carries an exchange credential. "
                "Development and dry-run sessions must not hold real secrets."
            )

    # --- 3. no exchange credentials at all --------------------------------
    exchange = config.get("exchange")
    if isinstance(exchange, Mapping):
        for path in find_credentials(exchange):
            audit.violations.append(
                f"{path} is populated. A keyless dry run must leave every "
                "credential field empty, at any depth of the exchange section; "
                "remove it from the config file."
            )
    else:
        audit.violations.append("exchange section is missing from the effective configuration.")

    # --- 4. spot, long-only, no leverage ----------------------------------
    trading_mode = config.get("trading_mode", "spot")
    if trading_mode != "spot":
        audit.violations.append(
            f"trading_mode is {trading_mode!r}. This project is spot-only by design; "
            "futures and margin are out of scope."
        )
    margin_mode = config.get("margin_mode", "")
    if margin_mode:
        audit.violations.append(f"margin_mode is {margin_mode!r}. Leverage is out of scope.")
    if config.get("can_short"):
        audit.violations.append("can_short is enabled. This project is long-only.")

    # --- 5. never expose the API server ------------------------------------
    api_server = config.get("api_server")
    if isinstance(api_server, Mapping) and api_server.get("enabled"):
        listen = api_server.get("listen_ip_address", "127.0.0.1")
        if listen not in ("127.0.0.1", "::1", "localhost"):
            audit.violations.append(
                f"api_server.listen_ip_address is {listen!r}. The REST/UI interface "
                "must never be reachable from outside the host."
            )
        password = api_server.get("password", "")
        if not password or password in ("freqtrader", "SuperSecret1!", "password", "changeme"):
            audit.violations.append(
                "api_server is enabled with a missing or well-known default password."
            )

    # --- 6. things that are suspicious but not fatal ----------------------
    if config.get("dry_run_wallet") in (None, 0):
        audit.warnings.append("dry_run_wallet is unset or zero; simulated equity will be zero.")
    telegram = config.get("telegram")
    if isinstance(telegram, Mapping) and telegram.get("enabled"):
        audit.warnings.append(
            "telegram is enabled. Notifications are optional; the bot must run without them."
        )

    return audit


def assert_dry_run(
    config: Mapping[str, Any],
    environ: Mapping[str, str] | None = None,
    *,
    config_files: Sequence[str | Path] = (),
) -> ConfigAudit:
    """Audit and raise ``LiveModeRejected`` on any violation."""
    audit = audit_config(config, environ, config_files=config_files)
    if not audit.safe:
        numbered = "\n".join(f"  {n}. {v}" for n, v in enumerate(audit.violations, 1))
        raise LiveModeRejected(
            "REFUSING TO START - the effective configuration is not a keyless dry run.\n"
            f"{numbered}\n"
            "\nThis launcher cannot enable live trading. Going live is a manual "
            "operator procedure; see docs/LIVE_READINESS.md."
        )
    return audit


def audit_summary(audit: ConfigAudit) -> str:
    """Human-readable, secret-free summary for the startup banner."""
    lines = [
        "MODE           : DRY-RUN (no real orders will be placed)",
        f"dry_run        : {audit.dry_run!r}",
        f"config sources : {', '.join(audit.sources) or '(none)'}",
    ]
    if audit.env_overrides:
        lines.append(f"env overrides  : {', '.join(audit.env_overrides)}")
    for warning in audit.warnings:
        lines.append(f"WARNING        : {warning}")
    return "\n".join(str(line) for line in redact(lines))
