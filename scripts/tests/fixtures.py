#!/usr/bin/env python3
"""
Test fixture seeder via backend API.

The backend exposes /api/test/seed which applies fixtures directly in DB.
This is protected by a secret header (X-Test-Secret).

Usage:
    from fixtures import apply_fixture, list_fixtures
    
    apply_fixture("step3", user_id="contact_xxx")

Or via CLI:
    python fixtures.py step3 --user-id contact_xxx

One-liner (in Dev Container):
    cd 04.Execution/lms && python scripts/tests/fixtures.py --list
"""

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

import requests

from tpb_sdk.bastion import BastionClient

# Configuration
API_BASE = "https://lms-api.matthieu-marielouise.workers.dev"
LMS_ROOT = Path(__file__).parent.parent.parent

_FIXTURE_TIMEOUT = 30


def _get_access_credentials():
    """Get Cloudflare Access credentials from vault."""
    if not hasattr(_get_access_credentials, "_cache"):
        bastion = BastionClient.from_devcontainer()
        _get_access_credentials._cache = {
            "client_id": bastion.get_secret("tpb/infra/cloudflare_service_account_access_client_id"),
            "client_secret": bastion.get_secret("tpb/infra/cloudflare_service_account_access_client_secret"),
        }
    return _get_access_credentials._cache


# Test Secret (for /api/test/seed endpoint) - not really sensitive
TEST_SECRET = "lms_test_4e440fd30d7b4ed5ae22ff701e380f2e"

# Colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"

# Available fixtures
FIXTURES = {
    "clean_slate": "Fresh user with no progress",
    "step3": "User on step 3 (steps 1-2 completed)",
    "last_step": "User on last step (steps 1-5 completed)",
    "completed": "User completed entire course (all 6 steps)",
}


def get_user_id_from_db() -> Optional[str]:  # entropy-python-nesting-ok: nested iteration in fixtures over multi-level structured data
    """Get latest user_id from database via wrangler."""
    cmd = ["npx", "wrangler", "d1", "execute", "lms-db", "--remote", "--command",
           "SELECT user_id FROM v_user_progress ORDER BY updated_at DESC LIMIT 1;"]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=LMS_ROOT)
        if result.returncode == 0:
            output = result.stdout + result.stderr
            lines = output.split('\n')
            for i, line in enumerate(lines):
                if line.strip().startswith('['):
                    json_str = '\n'.join(lines[i:])
                    data = json.loads(json_str)
                    if data and data[0].get('results'):
                        return data[0]['results'][0].get('user_id')
    except Exception:
        pass
    return None


def apply_fixture(fixture: str, user_id: str, email: str = None, api_base: str = API_BASE) -> bool:  # entropy-python-long-function-ok: long function in fixtures is linear sequential script execution
    """
    Apply a fixture via the backend API.
    
    Args:
        fixture: Fixture name (clean_slate, step3, last_step, completed)
        user_id: User ID (CF Access sub) to apply fixture for
        email: User email (for contact_id resolution) - HIGHLY RECOMMENDED
        api_base: API base URL
    
    Returns:
        True if successful, False otherwise
    """
    if fixture not in FIXTURES:
        print(f"{RED}Unknown fixture: {fixture}{RESET}")
        list_fixtures()
        return False
    
    print(f"\n{CYAN}🌱 Seeding: {fixture}{RESET}")
    print(f"   User: {user_id}")
    if email:
        print(f"   Email: {email}")
    
    creds = _get_access_credentials()
    headers = {
        "CF-Access-Client-Id": creds["client_id"],
        "CF-Access-Client-Secret": creds["client_secret"],
        "X-Test-Secret": TEST_SECRET,
        "Content-Type": "application/json"
    }
    
    payload = {
        "fixture": fixture,
        "user_id": user_id
    }
    
    # Add email if provided (needed for proper clean_slate)
    if email:
        payload["email"] = email
    
    try:
        resp = requests.post(
            f"{api_base}/api/test/seed",
            json=payload,
            headers=headers,
            timeout=_FIXTURE_TIMEOUT
        )
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"{GREEN}✓ Fixture '{fixture}' applied successfully{RESET}")
            return True
        else:
            try:
                error = resp.json()
                print(f"{RED}✗ Error: {error.get('error', resp.text)}{RESET}")
            except:
                print(f"{RED}✗ Error: {resp.status_code} - {resp.text}{RESET}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"{RED}✗ Request failed: {e}{RESET}")
        return False


def list_fixtures():
    """Print available fixtures."""
    print(f"\n{CYAN}Available fixtures:{RESET}\n")
    for name, desc in FIXTURES.items():
        print(f"  {GREEN}{name}{RESET}")
        print(f"    {desc}")
    print()


def main():  # entropy-python-long-function-ok: long function in fixtures is linear CLI script flow
    """ Parse CLI args and apply a test fixture via the LMS backend API."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Apply test fixtures via backend API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python fixtures.py clean_slate --user-id UUID --email user@example.com
    python fixtures.py step3 --user-id UUID --email user@example.com
    python fixtures.py --list
    python fixtures.py --get-user-id

Note: --email is HIGHLY RECOMMENDED for clean_slate to work properly.
      The system uses both CF Access user_id AND contact_id (resolved from email).
        """
    )
    parser.add_argument("fixture", nargs="?", help="Fixture name")
    parser.add_argument("--list", "-l", action="store_true", help="List available fixtures")
    parser.add_argument("--user-id", "-u", help="CF Access user_id (sub from JWT)")
    parser.add_argument("--email", "-e", help="User email (for contact_id resolution)")
    parser.add_argument("--get-user-id", action="store_true", help="Get current user_id from DB")
    
    args = parser.parse_args()
    
    if args.get_user_id:
        user_id = get_user_id_from_db()
        if user_id:
            print(f"{GREEN}{user_id}{RESET}")
        else:
            print(f"{RED}No user found{RESET}")
            exit(1)
        exit(0)
    
    if args.list or not args.fixture:
        list_fixtures()
        exit(0)
    
    user_id = args.user_id
    if not user_id:
        print(f"{YELLOW}Detecting user_id...{RESET}", end=" ")
        user_id = get_user_id_from_db()
        if user_id:
            print(f"{GREEN}found: {user_id}{RESET}")
        else:
            print(f"{RED}not found{RESET}")
            print(f"\n{RED}Please provide --user-id parameter{RESET}")
            exit(1)
    
    # Warn if email not provided for clean_slate
    if args.fixture == 'clean_slate' and not args.email:
        print(f"{YELLOW}⚠ Warning: --email not provided. clean_slate may not fully clean all data.{RESET}")
    
    success = apply_fixture(args.fixture, user_id, email=args.email)
    exit(0 if success else 1)


if __name__ == "__main__":
    main()
