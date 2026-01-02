#!/usr/bin/env python3
"""
Migrate secrets from legacy format to new KV format.

Legacy: CONN_infra_OPENAI_API_KEY (sys_secret_ref)
New:    SECRET_infra_openai_api_key (sys_secret)

This script:
1. Reads legacy secrets from sys_secret_ref via vault-api
2. Creates new entries in sys_secret via /v1/secret/data/:path
3. Does NOT delete legacy entries (manual cleanup after verification)
"""

import os
import sys
import httpx

# Add parent to path for vault_client import
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))))
from vault_client import VaultClient

VAULT_URL = "https://tpb-vault-infra.matthieu-marielouise.workers.dev"

def get_headers():
    """Get auth headers from environment."""
    client_id = os.environ.get("VAULT_CLIENT_ID")
    client_secret = os.environ.get("VAULT_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        raise ValueError("VAULT_CLIENT_ID and VAULT_CLIENT_SECRET must be set")
    
    return {
        "CF-Access-Client-Id": client_id,
        "CF-Access-Client-Secret": client_secret,
        "Content-Type": "application/json"
    }

def migrate_connection_secrets(connection_id: str, headers: dict):
    """Migrate secrets from a legacy connection to new KV format."""
    print(f"\n📦 Migrating connection: {connection_id}")
    
    # 1. Get connection with secrets (legacy endpoint)
    resp = httpx.get(
        f"{VAULT_URL}/vault/connections/{connection_id}",
        headers=headers,
        timeout=30
    )
    
    if resp.status_code != 200:
        print(f"  ❌ Failed to get connection: {resp.status_code}")
        return []
    
    data = resp.json()
    connection = data.get("connection", {})
    auth = connection.get("auth", {})
    secrets = auth.get("secrets", {})
    
    if not secrets:
        print(f"  ⚠️ No secrets found in connection")
        return []
    
    migrated = []
    
    for name, secret_data in secrets.items():
        value = secret_data.get("value")
        secret_type = secret_data.get("type", "secret")
        
        # Convert to new path format
        # e.g., connection_id=conn_infra, name=OPENAI_API_KEY
        # -> path = infra/openai_api_key
        prefix = connection_id.replace("conn_", "")
        path = f"{prefix}/{name.lower()}"
        
        print(f"  → Migrating {name} to {path}...", end=" ")
        
        if value is None:
            print("⚠️ No value (skipped)")
            continue
        
        # 2. Create in new KV format
        resp = httpx.post(
            f"{VAULT_URL}/v1/secret/data/{path}",
            headers=headers,
            json={
                "value": value,
                "type": secret_type,
                "description": f"Migrated from {connection_id}/{name}"
            },
            timeout=30
        )
        
        if resp.status_code in (200, 201):
            print("✅")
            migrated.append(path)
        else:
            print(f"❌ {resp.status_code}: {resp.text[:100]}")
    
    return migrated

def main():
    print("=" * 60)
    print("🔄 Legacy to KV Secret Migration")
    print("=" * 60)
    
    try:
        headers = get_headers()
    except ValueError as e:
        print(f"❌ {e}")
        print("\nSet environment variables:")
        print("  export VAULT_CLIENT_ID='...'")
        print("  export VAULT_CLIENT_SECRET='...'")
        sys.exit(1)
    
    # List all connections
    print("\n📋 Fetching connections...")
    resp = httpx.get(
        f"{VAULT_URL}/vault/connections",
        headers=headers,
        timeout=30
    )
    
    if resp.status_code != 200:
        print(f"❌ Failed to list connections: {resp.status_code}")
        sys.exit(1)
    
    connections = resp.json().get("connections", [])
    print(f"   Found {len(connections)} connections")
    
    all_migrated = []
    
    for conn in connections:
        conn_id = conn.get("id")
        if conn_id:
            migrated = migrate_connection_secrets(conn_id, headers)
            all_migrated.extend(migrated)
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Migration Summary")
    print("=" * 60)
    print(f"   Total secrets migrated: {len(all_migrated)}")
    
    if all_migrated:
        print("\n   Migrated paths:")
        for path in all_migrated:
            print(f"     - {path}")
    
    print("\n⚠️  Legacy secrets NOT deleted. Verify migration, then cleanup manually.")
    print("   Use: /vault/connections/:id/secrets/:name DELETE endpoint")

if __name__ == "__main__":
    main()


