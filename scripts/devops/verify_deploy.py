#!/usr/bin/env python3
"""
verify_deploy.py - Post-deployment verification
Checks that both backend API and frontend are healthy

Usage:
    python scripts/devops/verify_deploy.py

One-liner (in Dev Container):
    cd 04.Execution/lms && python scripts/devops/verify_deploy.py
"""

import http.client
import json
import ssl
import sys
from typing import Tuple

# Configuration. Static hostnames + paths — no dynamic URL construction.
# Per CLAUDE.md § CF ACCESS doctrine : use `http.client.HTTPSConnection`
# instead of `urllib.request` (= preserves header casing, doesn't trigger
# the semgrep dynamic-urllib detector on hardcoded constants).
_BACKEND_HOST = "lms-api.matthieu-marielouise.workers.dev"
_FRONTEND_HOST = "lms-viewer.matthieu-marielouise.workers.dev"
_BACKEND_HEALTH_PATH = "/api/health"
_FRONTEND_ROOT_PATH = "/"
# Public URLs kept for logs (= human-readable echo) ; not used as request inputs.
BACKEND_URL = f"https://{_BACKEND_HOST}{_BACKEND_HEALTH_PATH}"
FRONTEND_URL = f"https://{_FRONTEND_HOST}{_FRONTEND_ROOT_PATH}"

_HTTP_TIMEOUT = 10
_HTTP_STATUS_OK = 200
_HTTP_STATUS_REDIRECT = 302
_CLI_SEPARATOR_WIDTH = 50


def _https_get(host: str, path: str) -> Tuple[int, bytes]:
    """Issue HTTPS GET against a STATIC host + path.

    Returns `(status, body)`. Raises on any transport error. Uses
    `http.client.HTTPSConnection` per § CF ACCESS (no urllib).
    """
    ctx = ssl.create_default_context()
    conn = http.client.HTTPSConnection(host, timeout=_HTTP_TIMEOUT, context=ctx)
    try:
        conn.request("GET", path, headers={"User-Agent": "LMS-Deploy-Check"})
        resp = conn.getresponse()
        return resp.status, resp.read()
    finally:
        conn.close()

# Colors
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
RESET = "\033[0m"


def check_backend() -> bool:
    """Check backend API health endpoint."""
    print(f"{CYAN}🔍 Checking backend: {BACKEND_URL}{RESET}")

    try:
        status, body = _https_get(_BACKEND_HOST, _BACKEND_HEALTH_PATH)
        if status != _HTTP_STATUS_OK:
            print(f"{RED}   ❌ HTTP {status}{RESET}")
            return False
        data = json.loads(body.decode())
    except json.JSONDecodeError:
        print(f"{RED}   ❌ Invalid JSON response{RESET}")
        return False
    except (ssl.SSLError, TimeoutError, OSError, http.client.HTTPException) as e:
        print(f"{RED}   ❌ Error: {e}{RESET}")
        return False

    health_status = data.get("status", "unknown")
    version = data.get("version", "?")
    db_status = data.get("checks", {}).get("database", {}).get("status", "?")

    if health_status == "healthy":
        print(f"{GREEN}   ✅ Status: {health_status}{RESET}")
        print(f"{GREEN}   ✅ Version: {version}{RESET}")
        print(f"{GREEN}   ✅ Database: {db_status}{RESET}")
        return True
    print(f"{RED}   ❌ Status: {health_status}{RESET}")
    return False


def check_frontend() -> bool:
    """Check frontend is serving HTML."""
    print(f"{CYAN}🔍 Checking frontend: {FRONTEND_URL}{RESET}")

    try:
        status, body = _https_get(_FRONTEND_HOST, _FRONTEND_ROOT_PATH)
    except (ssl.SSLError, TimeoutError, OSError, http.client.HTTPException) as e:
        print(f"{RED}   ❌ Error: {e}{RESET}")
        return False

    # 302 is expected with Cloudflare Access.
    if status == _HTTP_STATUS_REDIRECT:
        print(f"{GREEN}   ✅ Redirecting (Cloudflare Access){RESET}")
        return True
    if status != _HTTP_STATUS_OK:
        print(f"{RED}   ❌ HTTP {status}{RESET}")
        return False

    content = body.decode(errors="replace")
    if "<html" in content.lower() or "<!doctype" in content.lower():
        print(f"{GREEN}   ✅ Serving HTML{RESET}")
        if "TPB Academy" in content or "LMS" in content:
            print(f"{GREEN}   ✅ Content verified{RESET}")
        return True
    print(f"{YELLOW}   ⚠️  Unexpected content{RESET}")
    return True


def main() -> None:
    """ Verify backend API and frontend deployments are healthy."""
    print(f"\n{CYAN}{'=' * _CLI_SEPARATOR_WIDTH}{RESET}")
    print(f"{CYAN}🔍 LMS Deployment Verification{RESET}")
    print(f"{CYAN}{'='*50}{RESET}\n")
    
    backend_ok = check_backend()
    print()
    frontend_ok = check_frontend()
    print()
    
    if backend_ok and frontend_ok:
        print(f"{GREEN}✅ All checks passed{RESET}")
        sys.exit(0)
    else:
        print(f"{RED}❌ Some checks failed{RESET}")
        sys.exit(1)


if __name__ == "__main__":
    main()
