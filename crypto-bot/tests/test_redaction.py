"""T25 - canary secrets must never survive into logs, tracebacks or reports."""

import json
import logging

import pytest

from kripto.redact import MASK, install_redaction, redact, redact_text

# Canary values: fake, but shaped exactly like the real thing.
CANARY_PRIVKEY = "0x" + "ab12cd34" * 8  # 64 hex chars
CANARY_WALLET = "0x" + "9f" * 20  # 40 hex chars
CANARY_TG_TOKEN = "123456789:AAFakeTelegramTokenValue_ForTestingOnly01"


def _assert_clean(text: str, *canaries: str) -> None:
    for canary in canaries:
        assert canary not in text, f"canary leaked: {canary[:12]}... in {text[:200]}"


def test_t25_private_key_is_masked_in_free_text():
    out = redact_text(f"connecting with privateKey={CANARY_PRIVKEY} to exchange")
    _assert_clean(out, CANARY_PRIVKEY)
    assert MASK in out


def test_t25_bare_private_key_without_a_key_name_is_masked():
    """A raw hex blob in a traceback has no helpful 'privateKey=' prefix."""
    out = redact_text(f"ValueError: bad signature for {CANARY_PRIVKEY}")
    _assert_clean(out, CANARY_PRIVKEY)


def test_t25_wallet_address_is_masked():
    out = redact_text(f"walletAddress={CANARY_WALLET}")
    _assert_clean(out, CANARY_WALLET)


def test_t25_telegram_token_is_masked():
    out = redact_text(f"https://api.telegram.org/bot{CANARY_TG_TOKEN}/sendMessage")
    _assert_clean(out, CANARY_TG_TOKEN)


def test_t25_url_query_string_is_masked():
    out = redact_text(
        f"GET https://example.test/v1/order?api_key={CANARY_PRIVKEY}&signature=deadbeefcafe"
    )
    _assert_clean(out, CANARY_PRIVKEY)
    assert "deadbeefcafe" not in out


def test_t25_authorization_header_is_masked():
    out = redact_text("Authorization: Bearer abcdefghijklmnop0123456789")
    assert "abcdefghijklmnop0123456789" not in out


def test_t25_nested_config_dict_is_masked():
    config = {
        "exchange": {
            "name": "hyperliquid",
            "walletAddress": CANARY_WALLET,
            "privateKey": CANARY_PRIVKEY,
            "pair_whitelist": ["UBTC/USDC"],
        },
        "telegram": {"enabled": False, "token": CANARY_TG_TOKEN, "chat_id": "987654321"},
        "dry_run": True,
    }
    out = redact(config)
    serialised = json.dumps(out)

    _assert_clean(serialised, CANARY_PRIVKEY, CANARY_WALLET, CANARY_TG_TOKEN, "987654321")
    # Non-secret structure survives untouched, or the masking is useless.
    assert out["exchange"]["name"] == "hyperliquid"
    assert out["exchange"]["pair_whitelist"] == ["UBTC/USDC"]
    assert out["dry_run"] is True


def test_t25_logging_filter_masks_message_and_args(caplog):
    logger = logging.getLogger("kripto.test.redaction")
    logger.propagate = True
    install_redaction(logger)

    with caplog.at_level(logging.INFO, logger="kripto.test.redaction"):
        logger.info("submitting with key %s", CANARY_PRIVKEY)

    _assert_clean(caplog.text, CANARY_PRIVKEY)


def test_t25_logging_filter_masks_exception_payload(caplog):
    logger = logging.getLogger("kripto.test.redaction.exc")
    install_redaction(logger)

    with caplog.at_level(logging.ERROR, logger="kripto.test.redaction.exc"):
        try:
            raise RuntimeError(f"signing failed for privateKey={CANARY_PRIVKEY}")
        except RuntimeError:
            logger.exception("order submission failed")

    _assert_clean(caplog.text, CANARY_PRIVKEY)


def test_t25_redaction_preserves_non_secret_numbers():
    """Over-masking would hide the risk numbers we need in reports."""
    out = redact({"equity": "1000.50", "amount": "0.98687", "pair": "UBTC/USDC"})
    assert out == {"equity": "1000.50", "amount": "0.98687", "pair": "UBTC/USDC"}
