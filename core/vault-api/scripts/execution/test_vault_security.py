#!/usr/bin/env python3
"""
Test TPB Vault Security & API

Tests:
1. Health endpoint (public)
2. List connections (service token READ)
3. Get connection with secrets
4. List secret refs  
5. Service token CANNOT write (403)
6. Unauthenticated blocked

Usage:
    python3 test_vault_security.py
"""

import httpx
import sys
from pathlib import Path

# Load .env
ENV_PATH = Path(__file__).parent.parent.parent / ".env"
env_vars = {}
if ENV_PATH.exists():
    with open(ENV_PATH) as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                key, value = line.split("=", 1)
                env_vars[key.strip()] = value.strip().strip('"').strip("'")

VAULT_URL = "https://tpb-vault-infra.matthieu-marielouise.workers.dev"
CLIENT_ID = env_vars.get("CLOUDFLARE_SERVICE_ACCOUNT_ACCESS_CLIENT_ID")
CLIENT_SECRET = env_vars.get("CLOUDFLARE_SERVICE_ACCOUNT_ACCESS_CLIENT_SECRET")

def headers():
    return {
        "CF-Access-Client-Id": CLIENT_ID,
        "CF-Access-Client-Secret": CLIENT_SECRET,
    }


def test_health():
    """Test 1: Health endpoint (public)"""
    print("\n1. Health (public)...")
    try:
        resp = httpx.get(f"{VAULT_URL}/health", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "healthy":
                print(f"   ✅ PASS: {data['stats']['connections']} connections, {data['stats']['secrets']} secrets")
                return True
        print(f"   ❌ FAIL: {resp.status_code}")
        return False
    except Exception as e:
        print(f"   ❌ FAIL: {e}")
        return False


def test_list_connections():
    """Test 2: List connections"""
    print("\n2. List connections (service token)...")
    if not CLIENT_ID:
        print("   ⚠️  SKIP: No credentials")
        return None
    
    try:
        resp = httpx.get(f"{VAULT_URL}/vault/connections", headers=headers(), timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            conns = data.get("connections", [])
            print(f"   ✅ PASS: {len(conns)} connections")
            return True
        print(f"   ❌ FAIL: {resp.status_code}")
        return False
    except Exception as e:
        print(f"   ❌ FAIL: {e}")
        return False


def test_get_connection_with_secrets():
    """Test 3: Get connection with secrets"""
    print("\n3. Get connection with secrets...")
    if not CLIENT_ID:
        print("   ⚠️  SKIP: No credentials")
        return None
    
    try:
        resp = httpx.get(f"{VAULT_URL}/vault/connections/conn_infra", headers=headers(), timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            secrets = data.get("connection", {}).get("auth", {}).get("secrets", {})
            if secrets:
                print(f"   ✅ PASS: {len(secrets)} secrets in conn_infra")
                return True
            print("   ❌ FAIL: No secrets returned")
            return False
        print(f"   ❌ FAIL: {resp.status_code}")
        return False
    except Exception as e:
        print(f"   ❌ FAIL: {e}")
        return False


def test_list_secret_refs():
    """Test 4: List secret refs"""
    print("\n4. List secret refs...")
    if not CLIENT_ID:
        print("   ⚠️  SKIP: No credentials")
        return None
    
    try:
        resp = httpx.get(f"{VAULT_URL}/vault/connections/conn_infra/secrets", headers=headers(), timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            refs = data.get("secrets", [])
            has_value_count = sum(1 for r in refs if r.get("has_value"))
            print(f"   ✅ PASS: {len(refs)} refs, {has_value_count} with values")
            return True
        print(f"   ❌ FAIL: {resp.status_code}")
        return False
    except Exception as e:
        print(f"   ❌ FAIL: {e}")
        return False


def test_service_token_write_blocked():
    """Test 5: Service token CANNOT write"""
    print("\n5. Write blocked (service token)...")
    if not CLIENT_ID:
        print("   ⚠️  SKIP: No credentials")
        return None
    
    try:
        resp = httpx.post(
            f"{VAULT_URL}/vault/connections",
            headers={**headers(), "Content-Type": "application/json"},
            json={"integration_type": "test_blocked"},
            timeout=10
        )
        if resp.status_code == 403:
            print("   ✅ PASS: Write blocked (403)")
            return True
        print(f"   ❌ FAIL: Expected 403, got {resp.status_code}")
        return False
    except Exception as e:
        print(f"   ❌ FAIL: {e}")
        return False


def test_unauthenticated_blocked():
    """Test 6: Unauthenticated blocked"""
    print("\n6. Unauthenticated blocked...")
    try:
        resp = httpx.get(f"{VAULT_URL}/vault/connections", timeout=10, follow_redirects=False)
        if resp.status_code in [302, 401, 403]:
            print(f"   ✅ PASS: Blocked ({resp.status_code})")
            return True
        print(f"   ❌ FAIL: Expected block, got {resp.status_code}")
        return False
    except Exception as e:
        print(f"   ❌ FAIL: {e}")
        return False


def main():
    print("=" * 50)
    print("TPB VAULT TESTS")
    print("=" * 50)
    print(f"URL: {VAULT_URL}")
    print(f"Credentials: {'✓' if CLIENT_ID else '✗'}")
    
    tests = [
        ("Health", test_health),
        ("List Connections", test_list_connections),
        ("Get Connection", test_get_connection_with_secrets),
        ("List Secret Refs", test_list_secret_refs),
        ("Write Blocked", test_service_token_write_blocked),
        ("Unauth Blocked", test_unauthenticated_blocked),
    ]
    
    results = [(name, func()) for name, func in tests]
    
    print("\n" + "=" * 50)
    print("SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for _, r in results if r is True)
    failed = sum(1 for _, r in results if r is False)
    skipped = sum(1 for _, r in results if r is None)
    
    for name, result in results:
        status = "✅" if result is True else ("❌" if result is False else "⚠️")
        print(f"  {status} {name}")
    
    print(f"\nPassed: {passed}, Failed: {failed}, Skipped: {skipped}")
    
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
