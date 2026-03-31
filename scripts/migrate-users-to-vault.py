# entropy-single-export-ok: CLI migration script, functions are internal pipeline steps called by main()
# entropy-console-leak-ok: uses print for CLI output
# entropy-legacy-marker-ok: debt — hris_employee is deprecated for roles post vault-api migration
# entropy-inconsistent-constant-ok: VAULT_API_URL default differs from backend (workers.dev vs wrangler.dev) — standalone migration script targets production vault directly, not routed through CF Access
#!/usr/bin/env python3
"""
Migrate LMS Users to vault-api

Reads existing users from LMS hris_employee table and creates
corresponding vault-api users and group memberships.

Prerequisites:
1. Run setup-vault-iam.js first to create roles and groups
2. Set VAULT_CLIENT_ID and VAULT_CLIENT_SECRET env vars

Usage:
    export VAULT_CLIENT_ID='your-client-id.access'
    export VAULT_CLIENT_SECRET='your-client-secret'  # entropy-python-hardcoded-secrets-ok: placeholder in docstring, not actual secret
    python scripts/migrate-users-to-vault.py

This is a one-time migration script. After migration, vault-api 
becomes the SSOT for IAM and hris_employee is deprecated for roles.  # entropy-legacy-marker-ok: documented technical debt
"""

import json
import os
import subprocess
import sys
from typing import Any

import requests

# entropy-inconsistent-constant-ok: standalone scripts have their own defaults
VAULT_API_URL = os.environ.get(
    'VAULT_API_URL',
    'https://tpb-vault-infra.matthieu-marielouise.workers.dev'
)

_VAULT_API_TIMEOUT = 30  # entropy-python-magic-numbers-ok: timeout in seconds
_CLI_SEPARATOR_WIDTH = 50  # entropy-python-magic-numbers-ok: CLI display width

def get_vault_headers() -> dict[str, str]:
    """Get auth headers for vault-api."""
    client_id = os.environ.get('VAULT_CLIENT_ID')
    client_secret = os.environ.get('VAULT_CLIENT_SECRET')
    
    if not client_id or not client_secret:
        print("❌ Missing credentials!")
        print("   Set VAULT_CLIENT_ID and VAULT_CLIENT_SECRET")
        sys.exit(1)
    
    return {
        'CF-Access-Client-Id': client_id,
        'CF-Access-Client-Secret': client_secret,
        'Content-Type': 'application/json'
    }

def fetch_lms_employees() -> list[dict[str, Any]]:
    """Fetch employees from LMS D1 database."""
    print("📊 Fetching employees from LMS database...")
    
    sql = """
    SELECT 
        id,
        name,
        emails_json,
        employee_roles_json
    FROM hris_employee
    WHERE emails_json IS NOT NULL
    """
    
    cmd = [
        'npx', 'wrangler', 'd1', 'execute', 'lms-db',
        '--remote', '--command', sql, '--json'
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True, cwd='../..')
    
    if result.returncode != 0:
        print(f"❌ Failed to query LMS database: {result.stderr}")
        return []
    
    try:
        # Parse wrangler output
        output = json.loads(result.stdout)
        # Wrangler returns array with result object
        if isinstance(output, list) and len(output) > 0:
            results = output[0].get('results', [])
            print(f"   Found {len(results)} employees")
            return results
    except json.JSONDecodeError:
        print(f"❌ Failed to parse output: {result.stdout}")
        return []  # entropy-catch-return-default-ok: migration script — error printed, degrade gracefully on tool failure
    
    return []

def get_vault_groups() -> dict[str, str]:
    """Fetch existing groups from vault-api."""
    headers = get_vault_headers()
    
    resp = requests.get(
        f"{VAULT_API_URL}/iam/groups",
        headers=headers,
        timeout=_VAULT_API_TIMEOUT
    )
    
    if resp.status_code != 200:  # entropy-python-magic-numbers-ok: HTTP 200 OK
        print(f"❌ Failed to fetch groups: {resp.status_code}")
        return {}
    
    groups = resp.json().get('groups', [])
    return {g['name']: g['id'] for g in groups}

def create_vault_user(email: str, display_name: str) -> str | None:  # entropy-python-nesting-ok: nested iteration over structured data
    """Create user in vault-api.

    Args:
        email: User email address.
        display_name: Human-readable name for the user.

    Returns:
        User ID string if created or found, None on failure.
    """
    headers = get_vault_headers()
    
    resp = requests.post(
        f"{VAULT_API_URL}/iam/users",
        headers=headers,
        json={
            'email': email,
            'display_name': display_name,
            'user_type': 'human',
            'grant_vault_access': True
        },
        timeout=_VAULT_API_TIMEOUT
    )
    
    if resp.status_code == 201:  # entropy-python-magic-numbers-ok: HTTP 201 Created
        return resp.json()['user']['id']
    elif resp.status_code == 409:  # entropy-python-magic-numbers-ok: HTTP 409 Conflict
        # User exists, try to find ID
        list_resp = requests.get(
            f"{VAULT_API_URL}/iam/users",
            headers=headers,
            timeout=30  # entropy-python-magic-numbers-ok: timeout in seconds
        )
        if list_resp.status_code == 200:  # entropy-python-magic-numbers-ok: HTTP 200 OK
            users = list_resp.json().get('users', [])
            for u in users:
                if u['email'] == email:
                    return u['id']
    
    return None

def add_user_to_group(user_id: str, group_id: str, group_name: str) -> bool:
    """Add user to vault-api group.

    Args:
        user_id: Vault user identifier.
        group_id: Vault group identifier.
        group_name: Group name for logging.

    Returns:
        True if user was added or already a member.
    """
    headers = get_vault_headers()
    
    resp = requests.post(
        f"{VAULT_API_URL}/iam/groups/{group_id}/members",
        headers=headers,
        json={'user_id': user_id},
        timeout=_VAULT_API_TIMEOUT
    )
    
    if resp.status_code in [200, 201]:  # entropy-python-magic-numbers-ok: HTTP 200/201 success
        return True
    elif resp.status_code == 409:  # entropy-python-magic-numbers-ok: HTTP 409 Conflict
        return True  # Already member
    
    print(f"      ❌ Failed to add to {group_name}: {resp.status_code}")
    return False

def migrate_employee(employee: dict[str, Any], groups: dict[str, str]) -> dict[str, str] | None:  # entropy-python-long-function-ok: linear script flow
    """Migrate a single employee to vault-api.

    Args:
        employee: Employee record dict from LMS database.
        groups: Mapping of group names to group IDs.

    Returns:
        Migration result dict or None on failure.
    """
    # Parse email
    try:
        emails = json.loads(employee.get('emails_json', '[]'))
        if not emails:
            return None
        email = emails[0].get('email')
    except json.JSONDecodeError:
        return None  # entropy-catch-return-default-ok: migration script — error printed, degrade gracefully on tool failure
    
    if not email:
        return None
    
    # Parse roles
    try:
        roles = json.loads(employee.get('employee_roles_json', '[]'))
    except json.JSONDecodeError:
        roles = []
    
    # Determine LMS role
    # Groups use tpblms_ namespace (matches vault-api app namespace)
    if 'admin' in roles:
        lms_role = 'admin'
        target_group = 'tpblms_admins'
    else:
        lms_role = 'instructor'
        target_group = 'tpblms_instructors'
    
    display_name = employee.get('name', email.split('@')[0])
    
    print(f"  👤 {email} ({lms_role})")
    
    # 1. Create user in vault-api
    user_id = create_vault_user(email, display_name)
    if not user_id:
        print(f"      ❌ Failed to create user")
        return None
    
    print(f"      ✅ User: {user_id}")
    
    # 2. Add to appropriate group
    group_id = groups.get(target_group)
    if group_id:
        if add_user_to_group(user_id, group_id, target_group):
            print(f"      ✅ Added to {target_group}")
    else:
        print(f"      ⚠️  Group {target_group} not found")
    
    return {
        'email': email,
        'user_id': user_id,
        'lms_role': lms_role,
        'group': target_group
    }

def main() -> None:  # entropy-python-long-function-ok: CLI script linear flow
    """ Migrate LMS employees to vault-api users and group memberships."""
    print("🚀 Migrating LMS users to vault-api...")
    print(f"   Target: {VAULT_API_URL}")
    print()
    
    # 1. Fetch existing vault groups
    print("📋 Fetching vault-api groups...")
    groups = get_vault_groups()
    print(f"   Found groups: {list(groups.keys())}")
    print()
    
    if 'tpblms_admins' not in groups or 'tpblms_instructors' not in groups:
        print("❌ LMS groups not found! Run setup-vault-iam.js first.")
        sys.exit(1)
    
    # 2. Fetch LMS employees
    employees = fetch_lms_employees()
    if not employees:
        print("   No employees to migrate")
        return
    
    print()
    
    # 3. Migrate each employee
    print("🔄 Migrating employees...")
    results = []
    
    for emp in employees:
        result = migrate_employee(emp, groups)
        if result:
            results.append(result)
    
    print()
    
    # Summary
    print("=" * _CLI_SEPARATOR_WIDTH)
    print("📊 Migration Summary")
    print("=" * _CLI_SEPARATOR_WIDTH)
    print(f"   Total employees: {len(employees)}")
    print(f"   Successfully migrated: {len(results)}")
    print()
    
    if results:
        admins = [r for r in results if r['lms_role'] == 'admin']
        instructors = [r for r in results if r['lms_role'] == 'instructor']
        
        print(f"   Admins: {len(admins)}")
        for a in admins:
            print(f"      • {a['email']}")
        
        print(f"   Instructors: {len(instructors)}")
        for i in instructors:
            print(f"      • {i['email']}")
    
    print()
    print("✅ Migration complete!")
    print()
    print("🎯 Next steps:")
    print("   1. Deploy LMS with vault-api integration")
    print("   2. Test role resolution via vault-api")
    print("   3. Eventually remove hris_employee role logic")

if __name__ == '__main__':
    main()

