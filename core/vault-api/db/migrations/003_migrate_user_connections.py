#!/usr/bin/env python3
"""
migrate_user_connections.py - Migrate user connections to UUID-based IDs

Migrates existing user_settings connections from email-based slugs to UUID-based IDs
and updates Cloudflare Secrets accordingly.

Usage:
    python scripts/execution/migrate_user_connections.py              # Dry run
    python scripts/execution/migrate_user_connections.py --apply     # Apply changes
"""

import argparse
import json
import subprocess
import sys
import uuid
from pathlib import Path

# Colors
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
RESET = "\033[0m"

def log(msg: str, level: str = "info"):
    """Print colored log message."""
    colors = {"info": CYAN, "success": GREEN, "warn": YELLOW, "error": RED}
    print(f"{colors.get(level, RESET)}{msg}{RESET}")

def run_cmd(cmd: list, check: bool = True) -> subprocess.CompletedProcess:
    """Run a command with error handling."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if check and result.returncode != 0:
            log(f"❌ Command failed: {' '.join(cmd)}", "error")
            if result.stderr:
                print(result.stderr)
            sys.exit(1)
        return result
    except subprocess.TimeoutExpired:
        log(f"❌ Command timed out: {' '.join(cmd)}", "error")
        sys.exit(1)
    except FileNotFoundError:
        log(f"❌ Command not found: {cmd[0]}", "error")
        sys.exit(1)

def extract_json_from_wrangler(output: str) -> dict:
    """Extract JSON from wrangler output (skip header lines)."""
    lines = output.strip().split('\n')
    json_start = -1
    for i, line in enumerate(lines):
        if line.strip().startswith('['):
            json_start = i
            break
    
    if json_start == -1:
        log("❌ Could not find JSON in wrangler output", "error")
        sys.exit(1)
    
    json_output = '\n'.join(lines[json_start:])
    return json.loads(json_output)

def get_user_connections() -> list:
    """Get existing user_settings connections."""
    log("🔍 Fetching user_settings connections...")
    result = run_cmd(["npx", "wrangler", "d1", "execute", "vault-db", 
                      "--remote", "--command", 
                      "SELECT id, integration_name, owner_user_id FROM connection WHERE integration_type = 'user_settings'"])
    
    data = extract_json_from_wrangler(result.stdout)
    connections = []
    if data and data[0]["success"]:
        connections = data[0]["results"]
    
    log(f"Found {len(connections)} user_settings connections", "success")
    return connections

def get_cf_secrets() -> list:
    """Get all Cloudflare Secrets."""
    log("🔍 Fetching Cloudflare Secrets...")
    result = run_cmd(["npx", "wrangler", "secret", "list"])
    secrets = json.loads(result.stdout)
    log(f"Found {len(secrets)} Cloudflare Secrets", "success")
    return secrets

def extract_email_from_slug(connection_id: str) -> str:
    """Extract email from connection slug (best effort)."""
    # conn_user_matthieu_marielouise_at_theplaybutton_ai -> matthieu.marielouise@theplaybutton.ai
    if not connection_id.startswith("conn_user_"):
        return None
    
    slug = connection_id[10:]  # Remove "conn_user_"
    email = slug.replace("_at_", "@").replace("_", ".")
    return email

def generate_new_connection_id() -> str:
    """Generate new UUID-based connection ID."""
    return f"conn_user_{uuid.uuid4().hex[:8]}"

def migrate_connection(conn, cf_secrets, apply: bool = False):
    """Migrate a single connection."""
    old_id = conn["id"]
    
    # Skip if already migrated (UUID format)
    if len(old_id.split("_")) == 3 and len(old_id.split("_")[2]) == 8:
        log(f"⏭️  {old_id} already migrated (UUID format)", "warn")
        return None
    
    # Extract email and generate new ID
    email = extract_email_from_slug(old_id)
    if not email:
        log(f"❌ Could not extract email from {old_id}", "error")
        return None
    
    new_id = generate_new_connection_id()
    
    # Find related secrets
    old_prefix = f"CONN_{old_id.replace('conn_', '')}_"
    new_prefix = f"CONN_{new_id.replace('conn_', '')}_"
    
    related_secrets = [s for s in cf_secrets if s["name"].startswith(old_prefix)]
    
    migration_plan = {
        "old_id": old_id,
        "new_id": new_id,
        "email": email,
        "owner_user_id": conn.get("owner_user_id"),
        "secrets": []
    }
    
    for secret in related_secrets:
        old_name = secret["name"]
        new_name = old_name.replace(old_prefix, new_prefix)
        migration_plan["secrets"].append({
            "old_name": old_name,
            "new_name": new_name
        })
    
    if apply:
        log(f"🔄 Migrating {old_id} -> {new_id}...", "info")
        
        # 1. Update connection ID in D1
        update_conn_sql = f"UPDATE connection SET id = '{new_id}' WHERE id = '{old_id}'"
        run_cmd(["npx", "wrangler", "d1", "execute", "vault-db", 
                "--remote", "--command", update_conn_sql])
        
        # 2. Update connection_auth
        update_auth_sql = f"UPDATE connection_auth SET connection_id = '{new_id}' WHERE connection_id = '{old_id}'"
        run_cmd(["npx", "wrangler", "d1", "execute", "vault-db", 
                "--remote", "--command", update_auth_sql])
        
        # 3. Update sys_secret_ref
        for secret_info in migration_plan["secrets"]:
            update_ref_sql = f"""
            UPDATE sys_secret_ref 
            SET connection_id = '{new_id}', cf_key = '{secret_info["new_name"]}' 
            WHERE cf_key = '{secret_info["old_name"]}'
            """
            run_cmd(["npx", "wrangler", "d1", "execute", "vault-db", 
                    "--remote", "--command", update_ref_sql])
        
        # 4. Migrate Cloudflare Secrets (copy old -> new, then delete old)
        for secret_info in migration_plan["secrets"]:
            old_name = secret_info["old_name"]
            new_name = secret_info["new_name"]
            
            # Get old value
            get_result = run_cmd(["npx", "wrangler", "secret", "list"], check=False)
            if get_result.returncode == 0:
                # Create new secret with same value (wrangler doesn't have a rename command)
                log(f"   📝 Creating {new_name}...", "info")
                # Note: We can't get the actual value via wrangler, so we'll need manual intervention
                log(f"   ⚠️  Manual step required: Copy secret value from {old_name} to {new_name}", "warn")
                log(f"      wrangler secret put {new_name}", "warn")
                log(f"      wrangler secret delete {old_name}", "warn")
        
        log(f"✅ Migrated {old_id} -> {new_id}", "success")
    else:
        log(f"[DRY-RUN] Would migrate {old_id} -> {new_id}", "warn")
        log(f"   Email: {email}", "info")
        log(f"   Secrets: {len(migration_plan['secrets'])}", "info")
        for secret_info in migration_plan["secrets"]:
            log(f"     {secret_info['old_name']} -> {secret_info['new_name']}", "info")
    
    return migration_plan

def main():
    parser = argparse.ArgumentParser(description="Migrate user connections to UUID format")
    parser.add_argument("--apply", action="store_true", help="Apply changes (default: dry run)")
    args = parser.parse_args()
    
    print(f"\n{CYAN}{'='*60}{RESET}")
    print(f"{CYAN}🔄 Migrate User Connections to UUID{RESET}")
    print(f"{CYAN}{'='*60}{RESET}")
    
    if not args.apply:
        log("🔍 DRY RUN MODE - No changes will be made", "warn")
    
    # Get current state
    user_connections = get_user_connections()
    cf_secrets = get_cf_secrets()
    
    if not user_connections:
        log("✅ No user_settings connections found to migrate", "success")
        return
    
    # Migrate each connection
    migrations = []
    for conn in user_connections:
        migration = migrate_connection(conn, cf_secrets, args.apply)
        if migration:
            migrations.append(migration)
    
    # Summary
    print()
    log(f"📊 Migration Summary:", "info")
    print(f"   - Connections processed: {len(user_connections)}")
    print(f"   - Migrations planned: {len(migrations)}")
    
    if migrations and not args.apply:
        print()
        log("⚠️  Manual steps required after running with --apply:", "warn")
        for migration in migrations:
            for secret_info in migration["secrets"]:
                print(f"   wrangler secret put {secret_info['new_name']}")
                print(f"   wrangler secret delete {secret_info['old_name']}")
    
    if args.apply and migrations:
        log("✅ Migration complete! Don't forget the manual secret migration steps above.", "success")
    elif not args.apply:
        log("🔍 Dry run complete. Use --apply to execute migration.", "warn")

if __name__ == "__main__":
    main()
