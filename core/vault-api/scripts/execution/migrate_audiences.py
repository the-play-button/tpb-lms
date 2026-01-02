#!/usr/bin/env python3
"""
Migration Script: Configure Audiences for Existing Applications

This script:
1. Updates the tpblms application with audiences: ["lms-viewer", "lms-api"]
2. Provisions the audiences via the infra provider (creates CF Access Groups + Policies)
3. Syncs current group members to the audiences

Usage:
    cd tpb_system/04.Execution/lms/core/vault-api
    python scripts/execution/migrate_audiences.py

Prerequisites:
- VAULT_CLIENT_ID and VAULT_CLIENT_SECRET in .devcontainer/.env
- Superadmin privileges (run as admin user, not service token)
"""

import sys
import json
import requests
from pathlib import Path

# Add vault_client to path
VAULT_API_ROOT = Path(__file__).parent.parent.parent
LMS_ROOT = VAULT_API_ROOT.parent.parent
EXECUTION_ROOT = LMS_ROOT.parent
sys.path.insert(0, str(EXECUTION_ROOT))

from vault_client import VaultClient

# Configuration
TPBLMS_AUDIENCES = ["lms-viewer", "lms-api"]


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'


def log_info(msg):
    print(f"{Colors.BLUE}ℹ️  {msg}{Colors.END}")


def log_success(msg):
    print(f"{Colors.GREEN}✅ {msg}{Colors.END}")


def log_warning(msg):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.END}")


def log_error(msg):
    print(f"{Colors.RED}❌ {msg}{Colors.END}")


def log_section(title):
    print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{title}{Colors.END}")
    print(f"{Colors.BOLD}{'='*60}{Colors.END}\n")


def main():
    log_section("🚀 Audience Migration for TPB LMS")
    
    # Initialize vault client
    try:
        vault = VaultClient.from_devcontainer()
        log_info(f"Connected to vault: {vault.base_url}")
    except Exception as e:
        log_error(f"Failed to connect to vault: {e}")
        sys.exit(1)
    
    # Step 1: Get current tpblms application
    log_section("Step 1: Check Current Application State")
    
    resp = requests.get(
        f"{vault.base_url}/iam/applications/app_tpblms",
        headers=vault.headers,
        timeout=30
    )
    
    if resp.status_code == 404:
        log_error("Application 'tpblms' not found. Please create it first.")
        sys.exit(1)
    elif resp.status_code != 200:
        log_error(f"Failed to get application: {resp.status_code} - {resp.text}")
        sys.exit(1)
    
    app_data = resp.json()
    app = app_data.get("application", {})
    current_audiences = app.get("audiences", [])
    
    log_info(f"Application: {app.get('name')} ({app.get('id')})")
    log_info(f"Current audiences: {current_audiences or 'none'}")
    log_info(f"Target audiences: {TPBLMS_AUDIENCES}")
    
    # Step 2: Update application with audiences
    log_section("Step 2: Update Application Audiences")
    
    if current_audiences == TPBLMS_AUDIENCES:
        log_success("Audiences already configured correctly")
    else:
        log_warning("This requires superadmin privileges via browser auth")
        log_info("Manual step: Run this SQL query via wrangler:")
        print(f"""
    npx wrangler d1 execute vault-db --remote --command "UPDATE iam_application SET audiences = '{json.dumps(TPBLMS_AUDIENCES)}' WHERE id = 'app_tpblms';"
        """)
        
        confirm = input("Press Enter after running the SQL, or 'skip' to continue anyway: ").strip()
        if confirm.lower() != 'skip':
            # Verify update
            resp = requests.get(
                f"{vault.base_url}/iam/applications/app_tpblms",
                headers=vault.headers,
                timeout=30
            )
            app_data = resp.json()
            updated_audiences = app_data.get("application", {}).get("audiences", [])
            if updated_audiences == TPBLMS_AUDIENCES:
                log_success(f"Audiences updated: {updated_audiences}")
            else:
                log_warning(f"Audiences not updated yet: {updated_audiences}")
    
    # Step 3: Sync audiences (provision to CF Access)
    log_section("Step 3: Sync Audiences to Infrastructure")
    
    log_warning("This requires superadmin privileges")
    log_info("Manual step: Run sync-audiences via browser or admin token:")
    print(f"""
    # Via browser console:
    fetch('{vault.base_url}/iam/applications/app_tpblms/sync-audiences', {{
        method: 'POST',
        credentials: 'include'
    }}).then(r => r.json()).then(console.log)
    """)
    
    # Try with current token (will fail if not superadmin)
    log_info("Attempting sync with current credentials...")
    resp = requests.post(
        f"{vault.base_url}/iam/applications/app_tpblms/sync-audiences",
        headers=vault.headers,
        timeout=60
    )
    
    if resp.status_code == 200:
        sync_data = resp.json()
        log_success("Audiences synced successfully!")
        log_info(f"Members synced: {len(sync_data.get('members', []))}")
        for result in sync_data.get("synced", []):
            status = "✅" if result.get("status") == "synced" else "❌"
            log_info(f"  {status} {result.get('audience')}: {result.get('status')}")
    elif resp.status_code == 403:
        log_warning("Superadmin privileges required for sync")
        log_info("Please run sync-audiences via browser with admin account")
    else:
        log_error(f"Sync failed: {resp.status_code} - {resp.text}")
    
    # Step 4: Check for orphan resources
    log_section("Step 4: Check for Orphan Resources")
    
    resp = requests.get(
        f"{vault.base_url}/iam/applications/orphans",
        headers=vault.headers,
        timeout=30
    )
    
    if resp.status_code == 200:
        orphan_data = resp.json()
        orphans = orphan_data.get("orphans", [])
        if orphans:
            log_warning(f"Found {len(orphans)} orphan resources:")
            for orphan in orphans:
                log_info(f"  - {orphan.get('type')}: {orphan.get('name')} ({orphan.get('id')})")
        else:
            log_success("No orphan resources found")
    elif resp.status_code == 403:
        log_warning("Admin privileges required to check orphans")
    else:
        log_error(f"Failed to check orphans: {resp.status_code}")
    
    # Summary
    log_section("Migration Complete")
    log_info("Next steps:")
    log_info("1. Verify audiences in application detail page")
    log_info("2. Add a test user to a tpblms_* group and verify CF Access sync")
    log_info("3. Test login with the user on lms-viewer.matthieu-marielouise.workers.dev")


if __name__ == "__main__":
    main()

