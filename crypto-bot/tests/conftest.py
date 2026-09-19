"""Shared fixtures.

Network-touching tests are opt-out via ``-m "not network"`` so the suite
still runs in an offline environment; they are never silently skipped
without saying so.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent


def pytest_sessionstart(session):
    # Fixtures load config/policy.yaml and config/config.dry.json by relative
    # path; running from the monorepo root or an IDE errored at fixture setup
    # instead of reporting the safety results (audit finding).
    os.chdir(ROOT)


def pytest_configure(config):
    config.addinivalue_line("markers", "network: needs outbound access to public exchange APIs")
    config.addinivalue_line("markers", "integration: runs against the pinned freqtrade build")


@pytest.fixture(scope="session")
def ca_bundle() -> str | None:
    """CA bundle for environments behind a TLS-terminating egress proxy.

    ccxt sets ``session.trust_env = False``, so the standard REQUESTS_CA_BUNDLE
    variable is ignored and has to be applied to the session explicitly. On a
    normal machine this fixture returns None and nothing is changed.
    """
    return os.environ.get("REQUESTS_CA_BUNDLE") or os.environ.get("SSL_CERT_FILE")


@pytest.fixture
def apply_ca_bundle(ca_bundle):
    def _apply(exchange_obj) -> None:
        session = getattr(exchange_obj, "session", None)
        if ca_bundle and session is not None:
            session.trust_env = True
            session.verify = ca_bundle

    return _apply
