#!/usr/bin/env python3
"""
check_secrets.py - Verify secrets stored in the vault KV engine

Checks:
- Secret paths and metadata
- Secret value accessibility
- User secrets structure

Usage:
    python scripts/devops/check_secrets.py                          # List all secrets
    python scripts/devops/check_secrets.py --prefix infra           # List secrets with prefix
    python scripts/devops/check_secrets.py --verify infra/openai    # Verify specific secret exists
    python scripts/devops/check_secrets.py --user user_xxx          # List user's secrets

One-liner (from vault-api root):
    cd tpb_system/04.Execution/lms/core/vault-api && python scripts/devops/check_secrets.py
"""

import argparse
import sys
from pathlib import Path

# Add paths for imports
VAULT_API_ROOT = Path(__file__).parent.parent.parent
LMS_ROOT = VAULT_API_ROOT.parent.parent
EXECUTION_ROOT = LMS_ROOT.parent
sys.path.insert(0, str(EXECUTION_ROOT))

from vault_client import VaultClient

try:
    import requests
except ImportError:
    print("ERROR: requests not installed. Run: pip install requests")
    sys.exit(1)

# Colors
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"


def log(msg: str, level: str = "info"):
    """Print colored log message."""
    colors = {"info": CYAN, "success": GREEN, "warn": YELLOW, "error": RED}
    print(f"{colors.get(level, RESET)}{msg}{RESET}")


def list_secrets(vault: VaultClient, prefix: str = "") -> list:
    """List secrets with optional prefix."""
    try:
        secrets = vault.list_secrets(prefix)
        return secrets
    except Exception as e:
        return {"error": str(e)}


def verify_secret(vault: VaultClient, path: str) -> dict:
    """Verify a secret exists and is accessible."""
    try:
        value = vault.get_secret(path)
        if value:
            return {
                "path": path,
                "exists": True,
                "has_value": bool(value),
                "value_length": len(value) if value else 0,
                "preview": f"{value[:10]}..." if value and len(value) > 10 else "[short]"
            }
        else:
            return {"path": path, "exists": False}
    except Exception as e:
        return {"path": path, "error": str(e)}


def get_secret_metadata(vault: VaultClient, path: str) -> dict:
    """Get metadata for a secret."""
    resp = requests.get(
        f'{vault.base_url}/secret/metadata/{path}',
        headers=vault.headers,
        timeout=30
    )
    
    if resp.status_code == 200:
        return resp.json().get('metadata', {})
    elif resp.status_code == 404:
        return {"not_found": True}
    else:
        return {"error": f"HTTP {resp.status_code}"}


def main():
    parser = argparse.ArgumentParser(description="Check secrets in vault KV engine")
    parser.add_argument("--prefix", default="", help="Filter secrets by prefix")
    parser.add_argument("--verify", help="Verify specific secret path exists")
    parser.add_argument("--user", help="List secrets for specific user ID")
    parser.add_argument("--show-values", action="store_true", help="Show secret value previews")
    args = parser.parse_args()
    
    print(f"\n{BOLD}{CYAN}{'='*60}{RESET}")
    print(f"{BOLD}{CYAN}🔐 Vault API - Secrets Check{RESET}")
    print(f"{BOLD}{CYAN}{'='*60}{RESET}\n")
    
    # Initialize vault client
    try:
        vault = VaultClient.from_devcontainer()
        log("✅ Vault client initialized", "success")
    except Exception as e:
        log(f"❌ Failed to initialize vault client: {e}", "error")
        sys.exit(1)
    
    print()
    
    # Mode: Verify specific secret
    if args.verify:
        log(f"🔍 Verifying secret: {args.verify}")
        result = verify_secret(vault, args.verify)
        
        if "error" in result:
            log(f"   ❌ Error: {result['error']}", "error")
            sys.exit(1)
        elif result.get("exists"):
            log(f"   ✅ Secret exists", "success")
            print(f"   {DIM}Length: {result.get('value_length')} chars{RESET}")
            if args.show_values:
                print(f"   {DIM}Preview: {result.get('preview')}{RESET}")
            
            # Also get metadata
            meta = get_secret_metadata(vault, args.verify)
            if meta and not meta.get('not_found') and not meta.get('error'):
                print(f"   {DIM}Type: {meta.get('type', 'secret')}{RESET}")
                print(f"   {DIM}Created: {meta.get('created_at', 'N/A')}{RESET}")
                print(f"   {DIM}Updated: {meta.get('updated_at', 'N/A')}{RESET}")
        else:
            log(f"   ❌ Secret not found", "error")
            sys.exit(1)
        
        print()
        return
    
    # Mode: List secrets
    prefix = args.user if args.user else args.prefix
    if args.user:
        prefix = f"users/{args.user}"
        log(f"🔍 Listing secrets for user: {args.user}")
    else:
        log(f"🔍 Listing secrets{' with prefix: ' + prefix if prefix else ''}...")
    
    secrets = list_secrets(vault, prefix)
    
    if isinstance(secrets, dict) and "error" in secrets:
        log(f"   ❌ Error: {secrets['error']}", "error")
        sys.exit(1)
    
    if not secrets:
        log("   No secrets found", "warn")
        print()
        return
    
    log(f"   Found {len(secrets)} secrets", "success")
    print()
    
    # Group by category
    categories = {}
    for secret in secrets:
        path = secret.get('path', 'unknown')
        parts = path.split('/')
        category = parts[0] if parts else 'other'
        
        if category not in categories:
            categories[category] = []
        categories[category].append(secret)
    
    # Display by category
    for category, cat_secrets in sorted(categories.items()):
        print(f"{BOLD}📁 {category}/ ({len(cat_secrets)} secrets){RESET}")
        
        for secret in sorted(cat_secrets, key=lambda x: x.get('path', '')):
            path = secret.get('path', 'unknown')
            secret_type = secret.get('type', 'secret')
            description = secret.get('description', '')
            
            type_icon = {
                'api_key': '🔑',
                'token': '🎫',
                'secret': '🔐',
            }.get(secret_type, '📄')
            
            print(f"   {type_icon} {path}")
            if description:
                print(f"      {DIM}{description}{RESET}")
            
            if args.show_values:
                result = verify_secret(vault, path)
                if result.get('exists'):
                    print(f"      {DIM}Value: {result.get('preview', '[empty]')}{RESET}")
        
        print()
    
    # Summary
    print(f"{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}📊 Summary{RESET}")
    print(f"{'='*60}")
    print(f"   Total secrets: {len(secrets)}")
    print(f"   Categories: {', '.join(sorted(categories.keys()))}")
    print()
    
    log("✅ Check complete", "success")
    print()


if __name__ == "__main__":
    main()

