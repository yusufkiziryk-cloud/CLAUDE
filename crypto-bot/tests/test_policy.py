"""Policy schema must fail closed: a limit that silently does not apply is
worse than no limit at all, because the operator believes it is active."""

import copy

import pytest
import yaml

from kripto.policy import PolicyError, load_policy

POLICY_PATH = "config/policy.yaml"


@pytest.fixture
def raw_policy():
    with open(POLICY_PATH, encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def write_policy(tmp_path, data):
    target = tmp_path / "policy.yaml"
    target.write_text(yaml.safe_dump(data), encoding="utf-8")
    return target


def test_shipped_policy_loads_and_is_dry_run_shaped(raw_policy):
    policy = load_policy(POLICY_PATH)

    assert policy.exchange["trading_mode"] == "spot"
    # The verified capability gap must be recorded in the policy itself.
    assert policy.exchange["stoploss_on_exchange_available"] is False
    assert policy.strategy["trailing_stop_enabled"] is False
    assert policy.strategy["position_adjustment_enabled"] is False
    assert policy.policy_hash.startswith("sha256:")


def test_unknown_key_is_rejected(tmp_path, raw_policy):
    data = copy.deepcopy(raw_policy)
    data["risk"]["risk_pre_trade"] = 0.02  # typo of risk_per_trade

    with pytest.raises(PolicyError, match="unknown key"):
        load_policy(write_policy(tmp_path, data))


def test_unknown_section_is_rejected(tmp_path, raw_policy):
    data = copy.deepcopy(raw_policy)
    data["leverage"] = {"max": 3}

    with pytest.raises(PolicyError, match="unknown section"):
        load_policy(write_policy(tmp_path, data))


def test_missing_required_key_is_rejected(tmp_path, raw_policy):
    data = copy.deepcopy(raw_policy)
    del data["risk"]["daily_loss_limit"]

    with pytest.raises(PolicyError, match="required key is missing"):
        load_policy(write_policy(tmp_path, data))


def test_percent_written_as_whole_number_is_rejected(tmp_path, raw_policy):
    """The classic: writing 3 for "3%" would be a 300% daily loss budget."""
    data = copy.deepcopy(raw_policy)
    data["risk"]["daily_loss_limit"] = 3

    with pytest.raises(PolicyError, match="ratio, not a percentage"):
        load_policy(write_policy(tmp_path, data))


def test_negative_value_is_rejected(tmp_path, raw_policy):
    data = copy.deepcopy(raw_policy)
    data["risk"]["risk_per_trade"] = -0.01

    with pytest.raises(PolicyError, match="negative"):
        load_policy(write_policy(tmp_path, data))


@pytest.mark.parametrize("literal", [".nan", ".inf", "-.inf"])
def test_nan_and_infinity_are_rejected(tmp_path, raw_policy, literal):
    data = copy.deepcopy(raw_policy)
    text = yaml.safe_dump(data).replace("risk_per_trade: 0.01", f"risk_per_trade: {literal}")
    target = tmp_path / "policy.yaml"
    target.write_text(text, encoding="utf-8")

    with pytest.raises(PolicyError):
        load_policy(target)


def test_zero_risk_per_trade_is_rejected(tmp_path, raw_policy):
    data = copy.deepcopy(raw_policy)
    data["risk"]["risk_per_trade"] = 0

    with pytest.raises(PolicyError, match="below the allowed minimum"):
        load_policy(write_policy(tmp_path, data))


def test_per_trade_risk_above_portfolio_risk_is_rejected(tmp_path, raw_policy):
    data = copy.deepcopy(raw_policy)
    data["risk"]["risk_per_trade"] = 0.04
    data["risk"]["max_total_open_risk"] = 0.03

    with pytest.raises(PolicyError, match="exceeds risk.max_total_open_risk"):
        load_policy(write_policy(tmp_path, data))


def test_unreachable_portfolio_risk_limit_is_rejected(tmp_path, raw_policy):
    """1% x 3 positions = 3%. A 10% portfolio cap could never bind, so the
    operator would believe in a limit that does nothing."""
    data = copy.deepcopy(raw_policy)
    data["risk"]["max_total_open_risk"] = 0.10

    with pytest.raises(PolicyError, match="can never be reached"):
        load_policy(write_policy(tmp_path, data))


def test_daily_limit_above_weekly_limit_is_rejected(tmp_path, raw_policy):
    data = copy.deepcopy(raw_policy)
    data["risk"]["daily_loss_limit"] = 0.08

    with pytest.raises(PolicyError, match="weekly limit"):
        load_policy(write_policy(tmp_path, data))


def test_fast_ema_not_shorter_than_slow_ema_is_rejected(tmp_path, raw_policy):
    data = copy.deepcopy(raw_policy)
    data["strategy"]["ema_fast"] = 200

    with pytest.raises(PolicyError, match="must be shorter than"):
        load_policy(write_policy(tmp_path, data))


def test_startup_candles_below_slow_ema_is_rejected(tmp_path, raw_policy):
    data = copy.deepcopy(raw_policy)
    data["strategy"]["startup_candles"] = 100

    with pytest.raises(PolicyError, match="incomplete warm-up"):
        load_policy(write_policy(tmp_path, data))


def test_emergency_slippage_above_adapter_cap_is_rejected(tmp_path, raw_policy):
    data = copy.deepcopy(raw_policy)
    data["costs"]["emergency_exit_max_slippage"] = 0.08

    with pytest.raises(PolicyError, match="ccxt_market_order_slippage_cap"):
        load_policy(write_policy(tmp_path, data))


def test_futures_or_margin_mode_is_rejected(tmp_path, raw_policy):
    data = copy.deepcopy(raw_policy)
    data["exchange"]["trading_mode"] = "futures"

    with pytest.raises(PolicyError, match="expected one of"):
        load_policy(write_policy(tmp_path, data))


def test_missing_file_is_rejected():
    with pytest.raises(PolicyError, match="not found"):
        load_policy("config/does-not-exist.yaml")


def test_malformed_yaml_is_rejected(tmp_path):
    target = tmp_path / "policy.yaml"
    target.write_text("risk: [unclosed\n", encoding="utf-8")

    with pytest.raises(PolicyError, match="invalid YAML"):
        load_policy(target)
