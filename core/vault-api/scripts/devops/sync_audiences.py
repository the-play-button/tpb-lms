#!/usr/bin/env python3
"""
sync_audiences.py - Synchronize IAM audiences with Cloudflare Access

Forces a sync between vault-api IAM groups and Cloudflare Access groups/policies.
Use this when:
- You suspect drift between vault and CF Access
- After manual changes to CF Access
- To repair sync state

Usage:
    python scripts/devops/sync_audiences.py                    # Sync all apps
    python scripts/devops/sync_audiences.py --app app_tpblms   # Sync specific app
    python scripts/devops/sync_audiences.py --dry-run          # Preview changes

One-liner (from vault-api root):
    cd tpb_system/04.Execution/lms/core/vault-api && python scripts/devops/sync_audiences.py
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
RESET = "\033[0m"


def log(msg: str, level: str = "info"):
    """Print colored log message."""
    colors = {"info": CYAN, "success": GREEN, "warn": YELLOW, "error": RED}
    print(f"{colors.get(level, RESET)}{msg}{RESET}")


def sync_application(vault: VaultClient, app_id: str, dry_run: bool = False) -> dict:
    """Sync audiences for a single application."""
    if dry_run:
        # In dry-run, just check current state
        resp = requests.get(
            f'{vault.base_url}/iam/applications/{app_id}',
            headers=vault.headers,
            timeout=30
        )
        if resp.status_code != 200:
            return {"error": f"HTTP {resp.status_code}"}
        
        app = resp.json().get('application', {})
        return {
            "dry_run": True,
            "app_id": app_id,
            "audiences": app.get('audiences', []),
            "current_states": app.get('audienceStates', [])
        }
    
    # Actual sync via POST endpoint
    resp = requests.post(
        f'{vault.base_url}/iam/applications/{app_id}/sync-audiences',
        headers=vault.headers,
        timeout=60
    )
    
    if resp.status_code != 200:
        return {"error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
    
    return resp.json()


def list_applications(vault: VaultClient) -> list:
    """List all IAM applications with audiences."""
    resp = requests.get(
        f'{vault.base_url}/iam/applications',
        headers=vault.headers,
        timeout=30
    )
    
    if resp.status_code != 200:
        return []
    
    apps = resp.json().get('applications', [])
    # Filter to only apps with audiences configured
    return [app for app in apps if app.get('audiences')]


def main():
    parser = argparse.ArgumentParser(description="Sync IAM audiences with Cloudflare Access")
    parser.add_argument("--app", help="Sync specific application (e.g., app_tpblms)")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without applying")
    parser.add_argument("--force", action="store_true", help="Force sync even if no changes detected")
    args = parser.parse_args()
    
    print(f"\n{BOLD}{CYAN}{'='*60}{RESET}")
    print(f"{BOLD}{CYAN}🔄 Vault API - Audience Synchronization{RESET}")
    print(f"{BOLD}{CYAN}{'='*60}{RESET}")
    
    if args.dry_run:
        print(f"{YELLOW}   [DRY RUN MODE - No changes will be made]{RESET}")
    
    print()
    
    # Initialize vault client
    try:
        vault = VaultClient.from_devcontainer()
        log("✅ Vault client initialized", "success")
    except Exception as e:
        log(f"❌ Failed to initialize vault client: {e}", "error")
        sys.exit(1)
    
    print()
    
    # Determine apps to sync
    if args.app:
        apps_to_sync = [{"id": args.app, "name": args.app}]
    else:
        log("🔍 Finding applications with audiences...")
        apps = list_applications(vault)
        apps_to_sync = apps
        
        if not apps:
            log("   No applications with audiences found", "warn")
            return
        
        log(f"   Found {len(apps)} applications with audiences", "success")
        print()
    
    # Sync each application
    results = []
    for app in apps_to_sync:
        app_id = app.get('id', app.get('name'))
        log(f"🔄 Syncing: {app_id}")
        
        result = sync_application(vault, app_id, dry_run=args.dry_run)
        results.append({"app_id": app_id, **result})
        
        if "error" in result:
            log(f"   ❌ Error: {result['error']}", "error")
        elif args.dry_run:
            audiences = result.get('audiences', [])
            states = result.get('current_states', [])
            log(f"   Would sync {len(audiences)} audiences", "info")
            for state in states:
                status = "✓" if state.get('exists') else "!"
                print(f"      [{status}] {state.get('audience')} - {len(state.get('members', []))} members")
        else:
            synced = result.get('synced', [])
            log(f"   ✅ Synced {len(synced)} audiences", "success")
            for sync_result in synced:
                print(f"      ✓ {sync_result.get('audience')} -> {sync_result.get('provider_resource_id', 'N/A')}")
        
        print()
    
    # Summary
    print(f"{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}📊 Summary{RESET}")
    print(f"{'='*60}")
    
    success_count = len([r for r in results if "error" not in r])
    error_count = len([r for r in results if "error" in r])
    
    print(f"   Applications processed: {len(results)}")
    print(f"   Successful: {success_count}")
    if error_count > 0:
        print(f"   {RED}Errors: {error_count}{RESET}")
    
    print()
    
    if args.dry_run:
        log("🔍 Dry run complete - no changes made", "info")
        print(f"\nTo apply changes: python scripts/devops/sync_audiences.py")
    else:
        log("✅ Synchronization complete", "success")
        print(f"\nTo verify: python scripts/devops/check_audiences.py")
    
    print()
    
    sys.exit(0 if error_count == 0 else 1)


if __name__ == "__main__":
    main()

