#!/usr/bin/env python3
"""
Migrate user secrets from legacy conn_user_* connections to users/{user_id}/* paths.

This script:
1. Lists all connections with integration_type='user_settings'
2. For each connection, extracts the user email from the id (conn_user_<email_slug>)
3. Gets the user_id from vault IAM
4. Copies each secret to users/{user_id}/{secret_name_lowercase}
5. Optionally deletes the old connection

Usage:
    python migrate_user_secrets.py --dry-run    # Preview only
    python migrate_user_secrets.py              # Actual migration
    python migrate_user_secrets.py --delete     # Also delete old connections
"""

import sys
import argparse
import httpx
from pathlib import Path

# Add parent directory to path for vault_client
sys.path.insert(0, str(Path(__file__).parents[5]))
from vault_client import VaultClient


def slugify_to_email(slug: str) -> str:
    """Convert connection slug back to email."""
    # conn_user_matthieu_at_theplaybutton_ai -> matthieu@theplaybutton.ai
    email = slug.replace("_at_", "@").replace("_", ".")
    return email


def get_user_id_by_email(vault: VaultClient, email: str) -> str | None:
    """Get user ID from IAM by email."""
    try:
        result = vault._get(f"/iam/users/{email}")
        return result.get("user", {}).get("id")
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return None
        raise


def migrate_connection(vault: VaultClient, conn: dict, dry_run: bool = True) -> dict:
    """Migrate a single connection's secrets to user path."""
    conn_id = conn["id"]
    
    # Extract email from conn_id
    if not conn_id.startswith("conn_user_"):
        return {"skipped": True, "reason": "Not a user connection"}
    
    email_slug = conn_id[len("conn_user_"):]
    email = slugify_to_email(email_slug)
    
    # Get user ID
    user_id = get_user_id_by_email(vault, email)
    if not user_id:
        return {"skipped": True, "reason": f"User not found in IAM: {email}"}
    
    # Get secrets from legacy connection
    try:
        result = vault._get(f"/vault/connections/{conn_id}")
        legacy_secrets = result.get("connection", {}).get("auth", {}).get("secrets", {})
    except Exception as e:
        return {"error": str(e)}
    
    if not legacy_secrets:
        return {"skipped": True, "reason": "No secrets to migrate"}
    
    # Migrate each secret
    migrated = []
    for secret_name, secret_data in legacy_secrets.items():
        new_path = f"users/{user_id}/{secret_name.lower()}"
        value = secret_data.get("value")
        desc = secret_data.get("description", "")
        
        if dry_run:
            migrated.append({"path": new_path, "dry_run": True})
        else:
            try:
                vault.set_secret(new_path, value, description=f"Migrated from {conn_id}: {desc}")
                migrated.append({"path": new_path, "success": True})
            except Exception as e:
                migrated.append({"path": new_path, "error": str(e)})
    
    return {
        "conn_id": conn_id,
        "email": email,
        "user_id": user_id,
        "migrated": migrated,
        "count": len(migrated)
    }


def main():
    parser = argparse.ArgumentParser(description="Migrate user secrets to new path format")
    parser.add_argument("--dry-run", action="store_true", help="Preview only, don't make changes")
    parser.add_argument("--delete", action="store_true", help="Delete old connections after migration")
    args = parser.parse_args()
    
    vault = VaultClient.from_devcontainer()
    
    print("=" * 60)
    print("User Secrets Migration: conn_user_* -> users/{id}/*")
    print("=" * 60)
    if args.dry_run:
        print("DRY RUN - No changes will be made\n")
    
    # Get all user_settings connections
    try:
        result = vault._get("/vault/connections")
        connections = [c for c in result.get("connections", []) 
                      if c.get("integration_type") == "user_settings"]
    except Exception as e:
        print(f"Error listing connections: {e}")
        sys.exit(1)
    
    print(f"Found {len(connections)} user_settings connections\n")
    
    total_migrated = 0
    for conn in connections:
        print(f"\n--- {conn['id']} ---")
        result = migrate_connection(vault, conn, dry_run=args.dry_run)
        
        if result.get("skipped"):
            print(f"  Skipped: {result['reason']}")
            continue
        
        if result.get("error"):
            print(f"  Error: {result['error']}")
            continue
        
        print(f"  Email: {result['email']}")
        print(f"  User ID: {result['user_id']}")
        print(f"  Secrets: {result['count']}")
        
        for m in result.get("migrated", []):
            if m.get("error"):
                print(f"    ❌ {m['path']}: {m['error']}")
            elif m.get("dry_run"):
                print(f"    🔄 {m['path']} (would migrate)")
            else:
                print(f"    ✅ {m['path']}")
        
        total_migrated += result['count']
        
        # Delete old connection if requested
        if args.delete and not args.dry_run and result['count'] > 0:
            try:
                vault._delete(f"/vault/connections/{conn['id']}")
                print(f"  🗑️  Deleted old connection")
            except Exception as e:
                print(f"  ⚠️  Failed to delete: {e}")
    
    print(f"\n{'=' * 60}")
    print(f"Total secrets {'would be ' if args.dry_run else ''}migrated: {total_migrated}")
    
    if args.dry_run:
        print("\nRun without --dry-run to perform actual migration")


if __name__ == "__main__":
    main()


