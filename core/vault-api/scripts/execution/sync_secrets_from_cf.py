#!/usr/bin/env python3
"""
sync_secrets_from_cf.py - Synchronize D1 secret refs with existing Cloudflare Secrets

Scans all Cloudflare Secrets and creates missing D1 references.
This ensures the vault API can access all existing secrets.

Usage:
    python scripts/execution/sync_secrets_from_cf.py              # Dry run
    python scripts/execution/sync_secrets_from_cf.py --apply     # Apply changes
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

def get_cf_secrets() -> list:
    """Get all Cloudflare Secrets."""
    log("🔍 Fetching Cloudflare Secrets...")
    result = run_cmd(["npx", "wrangler", "secret", "list"])
    secrets = json.loads(result.stdout)
    log(f"Found {len(secrets)} Cloudflare Secrets", "success")
    return secrets

def get_d1_secret_refs() -> dict:
    """Get existing D1 secret references."""
    log("🔍 Fetching D1 secret references...")
    result = run_cmd(["npx", "wrangler", "d1", "execute", "vault-db", 
                      "--remote", "--command", "SELECT cf_key FROM sys_secret_ref"])
    
    # Extract JSON from wrangler output (skip header lines)
    lines = result.stdout.strip().split('\n')
    json_start = -1
    for i, line in enumerate(lines):
        if line.strip().startswith('['):
            json_start = i
            break
    
    if json_start == -1:
        log("❌ Could not find JSON in wrangler output", "error")
        sys.exit(1)
    
    json_output = '\n'.join(lines[json_start:])
    data = json.loads(json_output)
    
    existing_refs = set()
    if data and data[0]["success"]:
        for row in data[0]["results"]:
            existing_refs.add(row["cf_key"])
    
    log(f"Found {len(existing_refs)} D1 secret references", "success")
    return existing_refs

def get_d1_connections() -> dict:
    """Get existing D1 connections."""
    log("🔍 Fetching D1 connections...")
    result = run_cmd(["npx", "wrangler", "d1", "execute", "vault-db", 
                      "--remote", "--command", "SELECT id, integration_type FROM connection"])
    
    # Extract JSON from wrangler output (skip header lines)
    lines = result.stdout.strip().split('\n')
    json_start = -1
    for i, line in enumerate(lines):
        if line.strip().startswith('['):
            json_start = i
            break
    
    if json_start == -1:
        log("❌ Could not find JSON in wrangler output", "error")
        sys.exit(1)
    
    json_output = '\n'.join(lines[json_start:])
    data = json.loads(json_output)
    
    connections = {}
    if data and data[0]["success"]:
        for row in data[0]["results"]:
            connections[row["id"]] = row["integration_type"]
    
    log(f"Found {len(connections)} D1 connections", "success")
    return connections

def parse_secret_name(cf_key: str) -> dict:
    """Parse Cloudflare secret key to extract connection and name."""
    if not cf_key.startswith("CONN_"):
        return None
    
    # CONN_infra_OPENAI_API_KEY -> connection_id=conn_infra, name=OPENAI_API_KEY
    # CONN_user_a1b2c3d4_USER_TRIGRAM -> connection_id=conn_user_a1b2c3d4, name=USER_TRIGRAM (new UUID format)
    # CONN_user_matthieu_marielouise_at_theplaybutton_ai_USER_TRIGRAM -> legacy format (still supported)
    
    parts = cf_key.split("_", 2)  # Split into max 3 parts: CONN, type, rest
    if len(parts) < 3:
        return None
    
    conn_type = parts[1]  # infra, integrations, user
    rest = parts[2]       # rest of the key
    
    if conn_type in ["infra", "integrations"]:
        connection_id = f"conn_{conn_type}"
        name = rest
    elif conn_type == "user":
        # Check if it's new UUID format: CONN_user_a1b2c3d4_SECRET_NAME
        parts_rest = rest.split("_", 1)
        if len(parts_rest) == 2 and len(parts_rest[0]) == 8:
            # New UUID format: conn_user_a1b2c3d4
            connection_id = f"conn_user_{parts_rest[0]}"
            name = parts_rest[1]
        else:
            # Legacy email-based format
            # Find the last underscore to separate connection from secret name
            # CONN_user_matthieu_marielouise_at_theplaybutton_ai_USER_TRIGRAM
            # -> conn_user_matthieu_marielouise_at_theplaybutton_ai + USER_TRIGRAM
            
            # Look for common secret patterns at the end
            common_secrets = ["USER_TRIGRAM", "MHO_CALENDAR_EMAIL", "OVH_ANDJCE_ID", "OVH_ANDJCE_PWD", 
                             "OVH_KOMDAN_ID", "OVH_KOMDAN_PWD", "OVH_WONDERGRIP_MC_ID", "OVH_WONDERGRIP_MC_PWD",
                             "OVH_WONDERGRIP_MML_ID", "OVH_WONDERGRIP_MML_PWD"]
            
            for secret in common_secrets:
                if rest.endswith(secret):
                    user_part = rest[:-len(secret)-1]  # Remove secret and underscore
                    connection_id = f"conn_user_{user_part}"
                    name = secret
                    break
            else:
                # Fallback: assume last part is the secret name
                parts = rest.rsplit("_", 1)
                if len(parts) == 2:
                    connection_id = f"conn_user_{parts[0]}"
                    name = parts[1]
                else:
                    return None
    else:
        return None
    
    return {
        "connection_id": connection_id,
        "name": name,
        "cf_key": cf_key
    }

def create_missing_connections(missing_connections: set, apply: bool = False):
    """Create missing user connections."""
    if not missing_connections:
        return
    
    log(f"🔧 Creating {len(missing_connections)} missing connections...")
    
    for conn_id in missing_connections:
        if conn_id.startswith("conn_user_"):
            user_part = conn_id[10:]  # Remove "conn_user_"
            email = user_part.replace("_at_", "@").replace("_", ".")
            
            if apply:
                # Insert connection
                conn_sql = f"""
                INSERT OR IGNORE INTO connection (id, organization_id, integration_type, integration_name, categories_json)
                VALUES ('{conn_id}', 'org_tpb', 'user_settings', '{email} Settings', '["personal"]')
                """
                
                # Insert connection_auth
                auth_sql = f"""
                INSERT OR IGNORE INTO connection_auth (id, connection_id, name)
                VALUES ('{conn_id.replace("conn_", "auth_")}', '{conn_id}', '{email} Settings')
                """
                
                run_cmd(["npx", "wrangler", "d1", "execute", "vault-db", 
                        "--remote", "--command", conn_sql])
                run_cmd(["npx", "wrangler", "d1", "execute", "vault-db", 
                        "--remote", "--command", auth_sql])
                
                log(f"✅ Created connection: {conn_id}", "success")
            else:
                log(f"[DRY-RUN] Would create connection: {conn_id} for {email}", "warn")

def create_missing_secret_refs(missing_refs: list, apply: bool = False):
    """Create missing secret references."""
    if not missing_refs:
        return
    
    log(f"🔧 Creating {len(missing_refs)} missing secret references...")
    
    for ref in missing_refs:
        ref_id = f"ref_{uuid.uuid4().hex[:8]}"
        
        if apply:
            sql = f"""
            INSERT OR IGNORE INTO sys_secret_ref (id, connection_id, name, cf_key, type, description)
            VALUES ('{ref_id}', '{ref["connection_id"]}', '{ref["name"]}', '{ref["cf_key"]}', 'api_key', 'Auto-synced from Cloudflare')
            """
            
            run_cmd(["npx", "wrangler", "d1", "execute", "vault-db", 
                    "--remote", "--command", sql])
            
            log(f"✅ Created ref: {ref['name']} -> {ref['cf_key']}", "success")
        else:
            log(f"[DRY-RUN] Would create ref: {ref['name']} -> {ref['cf_key']}", "warn")

def main():
    parser = argparse.ArgumentParser(description="Sync D1 secret refs with Cloudflare Secrets")
    parser.add_argument("--apply", action="store_true", help="Apply changes (default: dry run)")
    args = parser.parse_args()
    
    print(f"\n{CYAN}{'='*60}{RESET}")
    print(f"{CYAN}🔄 Sync Secrets from Cloudflare{RESET}")
    print(f"{CYAN}{'='*60}{RESET}")
    
    if not args.apply:
        log("🔍 DRY RUN MODE - No changes will be made", "warn")
    
    # Get current state
    cf_secrets = get_cf_secrets()
    existing_refs = get_d1_secret_refs()
    existing_connections = get_d1_connections()
    
    # Parse CF secrets and find missing ones
    missing_refs = []
    missing_connections = set()
    
    for secret in cf_secrets:
        cf_key = secret["name"]
        
        # Skip non-CONN secrets (they're legacy/direct secrets)
        if not cf_key.startswith("CONN_"):
            continue
        
        # Skip if already referenced in D1
        if cf_key in existing_refs:
            continue
        
        # Parse the secret
        parsed = parse_secret_name(cf_key)
        if not parsed:
            log(f"⚠️  Could not parse: {cf_key}", "warn")
            continue
        
        # Check if connection exists
        if parsed["connection_id"] not in existing_connections:
            missing_connections.add(parsed["connection_id"])
        
        missing_refs.append(parsed)
    
    # Report findings
    log(f"📊 Analysis complete:", "info")
    print(f"   - CF Secrets: {len(cf_secrets)}")
    print(f"   - CONN_* Secrets: {len([s for s in cf_secrets if s['name'].startswith('CONN_')])}")
    print(f"   - Existing D1 refs: {len(existing_refs)}")
    print(f"   - Missing connections: {len(missing_connections)}")
    print(f"   - Missing secret refs: {len(missing_refs)}")
    
    if missing_connections or missing_refs:
        print()
        
        # Create missing connections first
        create_missing_connections(missing_connections, args.apply)
        
        # Then create missing secret refs
        create_missing_secret_refs(missing_refs, args.apply)
        
        print()
        if args.apply:
            log("✅ Sync complete! All secrets are now referenced in D1.", "success")
        else:
            log("🔍 Dry run complete. Use --apply to make changes.", "warn")
    else:
        log("✅ All secrets are already synced!", "success")

if __name__ == "__main__":
    main()
