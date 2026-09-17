"""T01 - default startup is a keyless dry run, and every live-override path
is refused.

The audit deliberately runs against the configuration produced by
freqtrade's OWN loader, so these tests also pin the assumption that
config files and FREQTRADE__* environment variables merge the way we think.
"""

import json

import pytest

from kripto.launcher import (
    LiveModeRejected,
    assert_dry_run,
    audit_config,
    build_effective_config,
)

SHIPPED_CONFIG = "config/config.dry.json"


def write_config(tmp_path, data, name="extra.json"):
    target = tmp_path / name
    target.write_text(json.dumps(data), encoding="utf-8")
    return str(target)


# --------------------------------------------------------------------------
# The happy path
# --------------------------------------------------------------------------


def test_t01_shipped_config_is_a_safe_keyless_dry_run():
    config = build_effective_config([SHIPPED_CONFIG], environ={})
    audit = assert_dry_run(config, environ={}, config_files=[SHIPPED_CONFIG])

    assert audit.safe
    assert audit.dry_run is True
    assert config["trading_mode"] == "spot"
    assert config["margin_mode"] == ""
    assert config["order_types"]["stoploss_on_exchange"] is False
    assert config["force_entry_enable"] is False

    # Absent, not merely disabled. freqtrade's schema demands a token for any
    # telegram block and a username/password/jwt secret for any api_server
    # block, even when enabled is false - so a "disabled" block would force
    # placeholder credentials into a committed file. No block at all means no
    # notifier and no listener.
    assert not config.get("telegram", {}).get("enabled", False)
    assert not config.get("api_server", {}).get("enabled", False)


def test_t01_shipped_config_carries_no_credentials():
    config = build_effective_config([SHIPPED_CONFIG], environ={})
    exchange = config["exchange"]

    for field in ("key", "secret", "password", "uid", "privateKey", "walletAddress"):
        assert not exchange.get(field), f"{field} must be absent or empty"


# --------------------------------------------------------------------------
# Override path 1: environment variables
# --------------------------------------------------------------------------


@pytest.mark.parametrize("value", ["false", "False", "FALSE", "f", "0", "no"])
def test_t01_env_var_cannot_disable_dry_run(value):
    env = {"FREQTRADE__DRY_RUN": value}
    config = build_effective_config([SHIPPED_CONFIG], environ=env)

    with pytest.raises(LiveModeRejected, match="dry run"):
        assert_dry_run(config, environ=env, config_files=[SHIPPED_CONFIG])


def test_t01_env_var_really_does_reach_the_effective_config():
    """Guard against the check passing because the env merge silently no-ops.
    If freqtrade ever stops merging env vars this way, this test fails and
    tells us the T01 protection has become theatre."""
    env = {"FREQTRADE__DRY_RUN": "false"}
    config = build_effective_config([SHIPPED_CONFIG], environ=env)

    assert config["dry_run"] is False, "env override no longer reaches the config"


def test_t01_env_var_carrying_a_credential_is_refused():
    env = {"FREQTRADE__EXCHANGE__PRIVATEKEY": "0x" + "ab" * 32}
    config = build_effective_config([SHIPPED_CONFIG], environ=env)

    with pytest.raises(LiveModeRejected) as excinfo:
        assert_dry_run(config, environ=env, config_files=[SHIPPED_CONFIG])

    message = str(excinfo.value)
    assert "credential" in message
    # The refusal itself must not echo the secret back into the terminal.
    assert "ab" * 32 not in message


# --------------------------------------------------------------------------
# Override path 2: a second config file that deep-merges over the first
# --------------------------------------------------------------------------


def test_t01_second_config_file_cannot_enable_live(tmp_path):
    live_overlay = write_config(tmp_path, {"dry_run": False})
    files = [SHIPPED_CONFIG, live_overlay]
    config = build_effective_config(files, environ={})

    assert config["dry_run"] is False, "overlay no longer reaches the config"
    with pytest.raises(LiveModeRejected, match="dry run"):
        assert_dry_run(config, environ={}, config_files=files)


def test_t01_second_config_file_cannot_smuggle_credentials(tmp_path):
    overlay = write_config(
        tmp_path, {"exchange": {"privateKey": "0x" + "cd" * 32, "walletAddress": "0x" + "ef" * 20}}
    )
    files = [SHIPPED_CONFIG, overlay]
    config = build_effective_config(files, environ={})

    with pytest.raises(LiveModeRejected, match="credential"):
        assert_dry_run(config, environ={}, config_files=files)


# --------------------------------------------------------------------------
# Override path 3: truthy-but-not-true values
# --------------------------------------------------------------------------


@pytest.mark.parametrize("value", ["true", 1, "yes", None, 0, "", "True"])
def test_t01_dry_run_must_be_the_boolean_true(value):
    """A string "true" is truthy in Python but is NOT what freqtrade's schema
    accepts, and a config that fails schema validation later would already
    have been treated as live by a naive truthiness check here."""
    config = dict(build_effective_config([SHIPPED_CONFIG], environ={}))
    config["dry_run"] = value

    with pytest.raises(LiveModeRejected, match="boolean true"):
        assert_dry_run(config, environ={}, config_files=[SHIPPED_CONFIG])


def test_t01_missing_dry_run_key_is_refused():
    config = dict(build_effective_config([SHIPPED_CONFIG], environ={}))
    del config["dry_run"]

    with pytest.raises(LiveModeRejected, match="missing"):
        assert_dry_run(config, environ={}, config_files=[SHIPPED_CONFIG])


# --------------------------------------------------------------------------
# Scope violations that are not about dry_run
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "overrides,pattern",
    [
        ({"trading_mode": "futures"}, "spot-only"),
        ({"margin_mode": "isolated"}, "Leverage"),
        ({"can_short": True}, "long-only"),
    ],
)
def test_t01_out_of_scope_modes_are_refused(overrides, pattern):
    config = dict(build_effective_config([SHIPPED_CONFIG], environ={}))
    config.update(overrides)

    with pytest.raises(LiveModeRejected, match=pattern):
        assert_dry_run(config, environ={}, config_files=[SHIPPED_CONFIG])


def test_t01_api_server_exposed_to_the_network_is_refused():
    config = dict(build_effective_config([SHIPPED_CONFIG], environ={}))
    config["api_server"] = {
        "enabled": True,
        "listen_ip_address": "0.0.0.0",
        "password": "SuperSecret1!",
    }

    audit = audit_config(config, environ={})
    joined = " ".join(audit.violations)
    assert "listen_ip_address" in joined
    assert "default password" in joined


def test_t01_all_violations_are_reported_at_once():
    """An operator fixing one problem at a time is an operator who eventually
    gets bored and disables the check."""
    config = dict(build_effective_config([SHIPPED_CONFIG], environ={}))
    config["dry_run"] = False
    config["trading_mode"] = "futures"
    config["exchange"] = dict(config["exchange"], privateKey="0x" + "11" * 32)

    audit = audit_config(config, environ={})

    assert len(audit.violations) >= 3
