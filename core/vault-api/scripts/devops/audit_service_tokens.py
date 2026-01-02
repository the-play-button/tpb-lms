#!/usr/bin/env python3
"""
Audit Service Tokens - Detect orphans between D1 and Cloudflare Access

Usage:
    python scripts/devops/audit_service_tokens.py              # Check for orphans
    python scripts/devops/audit_service_tokens.py --cleanup    # Remove orphans
"""

import argparse
import json
import subprocess
import sys
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
        if line.strip().startswith('[') or line.strip().startswith('{'):
            json_start = i
            break
    
    if json_start == -1:
        log("❌ Could not find JSON in wrangler output", "error")
        sys.exit(1)
    
    json_output = '\n'.join(lines[json_start:])
    return json.loads(json_output)

def get_d1_tokens() -> list:
    """Get service tokens from D1."""
    log("🔍 Fetching service tokens from D1...")
    result = run_cmd(["npx", "wrangler", "d1", "execute", "vault-db", 
                      "--remote", "--command", 
                      "SELECT id, cf_token_id, name, subject_email, created_at FROM iam_service_token WHERE revoked_at IS NULL"])
    
    data = extract_json_from_wrangler(result.stdout)
    tokens = []
    if data and data[0]["success"]:
        tokens = data[0]["results"]
    
    log(f"Found {len(tokens)} active tokens in D1", "success")
    return tokens

def get_cf_tokens() -> list:
    """Get service tokens from Cloudflare Access via vault-api."""
    log("🔍 Fetching service tokens from Cloudflare Access...")
    
    # Use vault-api to get CF credentials and call the new endpoint
    import requests
    import os
    
    # Load credentials from .devcontainer/.env (project root)
    # Navigate up to find the root (contains .devcontainer)
    current = Path(__file__).parent
    while current != current.parent:
        env_file = current / '.devcontainer' / '.env'
        if env_file.exists():
            break
        current = current.parent
    else:
        env_file = None
    
    if env_file and env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    os.environ[key] = val
    
    vault_client_id = os.environ.get('VAULT_CLIENT_ID')
    vault_client_secret = os.environ.get('VAULT_CLIENT_SECRET')
    
    if not vault_client_id or not vault_client_secret:
        log("❌ Missing VAULT_CLIENT_ID or VAULT_CLIENT_SECRET in .devcontainer/.env", "error")
        sys.exit(1)
    
    headers = {
        'CF-Access-Client-Id': vault_client_id,
        'CF-Access-Client-Secret': vault_client_secret
    }
    
    # Call vault-api to get CF service tokens
    resp = requests.get(
        'https://tpb-vault-infra.matthieu-marielouise.workers.dev/cloudflare/resources',
        headers=headers,
        timeout=30
    )
    
    if resp.status_code != 200:
        log(f"❌ Vault API Error: {resp.status_code}", "error")
        print(resp.text[:500])
        sys.exit(1)
    
    data = resp.json()
    tokens = data.get('resources', {}).get('service_tokens', [])
    log(f"Found {len(tokens)} tokens in Cloudflare Access", "success")
    return tokens

def audit_tokens(cleanup: bool = False):
    """Audit service tokens and optionally cleanup orphans."""
    print(f"\n{CYAN}{'='*60}{RESET}")
    print(f"{CYAN}🔍 Service Tokens Audit{RESET}")
    print(f"{CYAN}{'='*60}{RESET}")
    
    # Get tokens from both sources
    d1_tokens = get_d1_tokens()
    cf_tokens = get_cf_tokens()
    
    # Create ID mappings
    d1_token_ids = {t['cf_token_id'] for t in d1_tokens if t.get('cf_token_id')}
    cf_token_ids = {t['id'] for t in cf_tokens if t.get('id')}
    
    # Find orphans
    orphans_cf = cf_token_ids - d1_token_ids  # On CF but not in D1
    orphans_d1 = d1_token_ids - cf_token_ids  # In D1 but not on CF
    
    print(f"\n📊 Audit Results:")
    print(f"   D1 tokens: {len(d1_tokens)}")
    print(f"   CF tokens: {len(cf_tokens)}")
    print(f"   Orphans (CF only): {len(orphans_cf)}")
    print(f"   Orphans (D1 only): {len(orphans_d1)}")
    
    if orphans_cf:
        print(f"\n🚨 Orphan tokens on Cloudflare Access:")
        for token in cf_tokens:
            if token['id'] in orphans_cf:
                print(f"   - {token['name']} (ID: {token['id']})")
                print(f"     Created: {token.get('created_at', 'N/A')}")
        
        if cleanup:
            log("\n🧹 Cleaning up orphan tokens via vault-api...", "warn")
            log("   ⚠️  Requires admin login via browser (email auth)", "warn")
            log("   Run: curl -X DELETE https://tpb-vault-infra.matthieu-marielouise.workers.dev/iam/service-tokens/orphans", "info")
            log("   Or use the dashboard as an admin", "info")
    
    if orphans_d1:
        print(f"\n🚨 Orphan references in D1:")
        for token in d1_tokens:
            if token['cf_token_id'] in orphans_d1:
                print(f"   - {token['name']} (CF ID: {token['cf_token_id']})")
                print(f"     User: {token['subject_email']}")
        
        if cleanup:
            log("\n🧹 Cleaning up orphan references in D1...", "warn")
            for token_id in orphans_d1:
                run_cmd(["npx", "wrangler", "d1", "execute", "vault-db", 
                        "--remote", "--command", 
                        f"UPDATE iam_service_token SET revoked_at = datetime('now') WHERE cf_token_id = '{token_id}'"])
                log(f"   ✅ Marked D1 token {token_id} as revoked", "success")
    
    if not orphans_cf and not orphans_d1:
        log("✅ No orphan tokens found - system is clean!", "success")
    
    print(f"\n{CYAN}{'='*60}{RESET}")

def main():
    parser = argparse.ArgumentParser(description="Audit service tokens for orphans")
    parser.add_argument("--cleanup", action="store_true", help="Remove orphan tokens")
    args = parser.parse_args()
    
    audit_tokens(cleanup=args.cleanup)

if __name__ == "__main__":
    main()
