"""Shared HTTP client for the LMS content import scripts (skool-import, masterclass-import).

The LMS API PAT is read from the bastion vault only (CLAUDE.md § CREDENTIAL HIERARCHY: no bespoke credential
environment variable). `request_with_backoff` honours the LMS rate limit (POST /api/{collection} is capped at
100/min per IP: 429 + Retry-After) and retries transient failures (timeouts, 5xx).
"""
from __future__ import annotations

import sys
import time

import httpx
from tpb_sdk.bastion import BastionClient

LMS_PAT_VAULT_PATH = "tpb/apps/lms/bastion_token"


def authenticated_lms_client(timeout: float = 40) -> httpx.Client:
    """An httpx client carrying the CF Access headers plus the LMS PAT from the vault; exits when absent."""
    bastion = BastionClient.from_devcontainer()
    pat = bastion.get_secret(LMS_PAT_VAULT_PATH)
    if not pat:
        print(f"FATAL: no LMS PAT in vault at {LMS_PAT_VAULT_PATH}", file=sys.stderr)
        sys.exit(2)
    headers = {**dict(bastion.effective_headers), "Authorization": f"Bearer {pat}",
               "Content-Type": "application/json"}
    return httpx.Client(timeout=timeout, headers=headers)


def request_with_backoff(client: httpx.Client, method: str, url: str, body: dict,
                         log_prefix: str = "    ") -> httpx.Response | None:
    """One request: waits on 429 (Retry-After, up to 12 times), retries timeouts/5xx twice, None on transport failure."""
    transient_left, rate_waits_left = 2, 12
    while True:
        try:
            response = client.request(method, url, json=body)
        except (httpx.TimeoutException, httpx.TransportError) as error:
            if transient_left <= 0:
                print(f"{log_prefix}! {method} {url} transport error: {error}")
                return None
            transient_left -= 1
            time.sleep(0.5)
            continue
        if response.status_code == 429 and rate_waits_left > 0:
            retry_after = int(response.headers.get("Retry-After") or "5")
            time.sleep(min(max(retry_after, 1), 60) + 1)
            rate_waits_left -= 1
            continue
        if response.status_code >= 500 and transient_left > 0:
            transient_left -= 1
            time.sleep(0.5)
            continue
        return response
