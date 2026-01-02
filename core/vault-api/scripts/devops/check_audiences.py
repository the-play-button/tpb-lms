#!/usr/bin/env python3
"""
check_audiences.py - Check IAM application audiences and Cloudflare Access sync status

Shows:
- Application audiences configuration
- CF Access Group sync status
- Orphan policies (CF policies without vault mapping)

Usage:
    python scripts/devops/check_audiences.py                    # Check all apps
    python scripts/devops/check_audiences.py --app app_tpblms   # Check specific app
    python scripts/devops/check_audiences.py --orphans          # Only show orphans

One-liner (from vault-api root):
    cd tpb_system/04.Execution/lms/core/vault-api && python scripts/devops/check_audiences.py
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


def check_application(vault: VaultClient, app_id: str) -> dict:
    """Check a single application's audience state."""
    resp = requests.get(
        f'{vault.base_url}/iam/applications/{app_id}',
        headers=vault.headers,
        timeout=30
    )
    
    if resp.status_code != 200:
        return {"error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
    
    return resp.json().get('application', {})


def check_orphans(vault: VaultClient) -> dict:
    """Check for orphan policies."""
    resp = requests.get(
        f'{vault.base_url}/iam/applications/orphans',
        headers=vault.headers,
        timeout=30
    )
    
    if resp.status_code != 200:
        return {"error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
    
    return resp.json()


def list_applications(vault: VaultClient) -> list:
    """List all IAM applications."""
    resp = requests.get(
        f'{vault.base_url}/iam/applications',
        headers=vault.headers,
        timeout=30
    )
    
    if resp.status_code != 200:
        return []
    
    return resp.json().get('applications', [])


def print_audience_state(state: dict) -> None:
    """Pretty print an audience state."""
    audience = state.get('audience', 'unknown')
    exists = state.get('exists', False)
    members = state.get('members', [])
    provider_id = state.get('provider_resource_id', 'N/A')
    
    status_icon = f"{GREEN}✓{RESET}" if exists else f"{RED}✗{RESET}"
    print(f"      {status_icon} {audience}")
    print(f"         {DIM}CF Group ID: {provider_id}{RESET}")
    print(f"         {DIM}Members: {len(members)}{RESET}")
    if members:
        for email in members[:5]:
            print(f"           - {email}")
        if len(members) > 5:
            print(f"           {DIM}... and {len(members) - 5} more{RESET}")


def main():
    parser = argparse.ArgumentParser(description="Check IAM audiences and CF Access sync status")
    parser.add_argument("--app", help="Check specific application (e.g., app_tpblms)")
    parser.add_argument("--orphans", action="store_true", help="Only show orphan policies")
    args = parser.parse_args()
    
    print(f"\n{BOLD}{CYAN}{'='*60}{RESET}")
    print(f"{BOLD}{CYAN}🔍 Vault API - Audience & Access Sync Check{RESET}")
    print(f"{BOLD}{CYAN}{'='*60}{RESET}\n")
    
    # Initialize vault client
    try:
        vault = VaultClient.from_devcontainer()
        log("✅ Vault client initialized", "success")
    except Exception as e:
        log(f"❌ Failed to initialize vault client: {e}", "error")
        sys.exit(1)
    
    print()
    
    # Check orphans
    if args.orphans or not args.app:
        log("🔍 Checking for orphan policies...")
        orphan_data = check_orphans(vault)
        
        if "error" in orphan_data:
            log(f"   ⚠️  Could not check orphans: {orphan_data['error']}", "warn")
        else:
            orphan_count = orphan_data.get('count', 0)
            orphans = orphan_data.get('orphans', [])
            
            if orphan_count == 0:
                log(f"   ✅ No orphan policies found", "success")
            else:
                log(f"   ⚠️  Found {orphan_count} orphan policies:", "warn")
                for orphan in orphans:
                    print(f"      - {orphan.get('name', 'unknown')} (App: {orphan.get('app_name', 'N/A')})")
        
        print()
        
        if args.orphans:
            return
    
    # Check specific app or all apps
    if args.app:
        apps_to_check = [{"id": args.app}]
    else:
        log("🔍 Listing all applications...")
        apps = list_applications(vault)
        apps_to_check = [{"id": app.get('id')} for app in apps if app.get('id')]
        log(f"   Found {len(apps_to_check)} applications", "success")
        print()
    
    # Check each application
    for app_ref in apps_to_check:
        app_id = app_ref['id']
        log(f"📱 Application: {app_id}")
        
        app = check_application(vault, app_id)
        
        if "error" in app:
            log(f"   ❌ Error: {app['error']}", "error")
            continue
        
        # Basic info
        print(f"   {DIM}Name: {app.get('name', 'N/A')}{RESET}")
        print(f"   {DIM}Namespace: {app.get('namespace', 'N/A')}{RESET}")
        
        # Audiences
        audiences = app.get('audiences', [])
        if audiences:
            print(f"   Audiences configured: {len(audiences)}")
            for aud in audiences:
                print(f"      - {aud}")
        else:
            print(f"   {YELLOW}No audiences configured{RESET}")
        
        # Audience states (sync status with CF)
        audience_states = app.get('audienceStates', [])
        if audience_states:
            print(f"   Sync status:")
            for state in audience_states:
                print_audience_state(state)
        
        # CF Access Group ID
        cf_group_id = app.get('cf_access_group_id')
        if cf_group_id:
            print(f"   {DIM}Legacy CF Group ID: {cf_group_id}{RESET}")
        
        print()
    
    # Summary
    print(f"{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}📊 Summary{RESET}")
    print(f"{'='*60}")
    print(f"   Applications checked: {len(apps_to_check)}")
    
    orphan_data = check_orphans(vault)
    if "error" not in orphan_data:
        print(f"   Orphan policies: {orphan_data.get('count', 0)}")
    
    print()
    print(f"{GREEN}✅ Check complete{RESET}")
    print(f"\nTo sync audiences: python scripts/devops/sync_audiences.py")
    print()


if __name__ == "__main__":
    main()

