#!/usr/bin/env python3
"""
Migrate LMS Users to vault-api

Reads existing users from LMS hris_employee table and creates
corresponding vault-api users and group memberships via the BastionClient SDK.

Prerequisites:
1. Run setup-vault-iam.js first to create roles and groups
2. Devcontainer bastion credentials available (.devcontainer/.env)

Usage:
    python scripts/migrate-users-to-vault.py

This is a one-time migration script. After migration, vault-api
becomes the SSOT for IAM and hris_employee is no longer used for roles.
"""

import json
import subprocess
import sys
from typing import Any

import httpx
from tpb_sdk.bastion import BastionClient

_CLI_SEPARATOR_WIDTH = 50


def get_bastion_client() -> BastionClient:
    """Construct a BastionClient via the canonical devcontainer creds path.

    Reads BASTION_CLIENT_ID / BASTION_CLIENT_SECRET / BASTION_TOKEN from
    .devcontainer/.env (cf. CLAUDE.md § BASTION AUTH).
    """
    try:
        return BastionClient.from_devcontainer()
    except (FileNotFoundError, ValueError, RuntimeError) as exc:
        print(f"❌ Missing bastion credentials: {exc}")
        print("   Configure .devcontainer/.env with BASTION_CLIENT_ID/SECRET/TOKEN.")
        sys.exit(1)

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

    result = subprocess.run(cmd, capture_output=True, text=True, cwd='../..', check=True)

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
        return []

    return []

def get_vault_groups(client: BastionClient) -> dict[str, str]:
    """Fetch existing groups from vault-api via the SDK.

    Args:
        client: Authenticated BastionClient.

    Returns:
        Mapping of group name → group id.
    """
    groups = client.list_groups()
    return {g['name']: g['id'] for g in groups}

def create_vault_user(client: BastionClient, email: str, display_name: str) -> str | None:
    """Create user in vault-api via the SDK.

    Args:
        client: Authenticated BastionClient.
        email: User email address.
        display_name: Human-readable name for the user.

    Returns:
        User ID string if created or found, None on failure.
    """
    payload = {
        'email': email,
        'display_name': display_name,
        'user_type': 'human',
        'grant_vault_access': True,
    }
    try:
        created = client.create_user(payload)
        return created['id'] if isinstance(created, dict) and 'id' in created else None
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 409:
            for user in client.list_users():
                if user.get('email') == email:
                    return user['id']
            return None
        print(f"      ❌ create_user failed: {exc.response.status_code}")
        return None

def add_user_to_group(client: BastionClient, user_id: str, group_id: str, group_name: str) -> bool:
    """Add user to vault-api group via the SDK.

    Args:
        client: Authenticated BastionClient.
        user_id: Vault user identifier.
        group_id: Vault group identifier.
        group_name: Group name for logging.

    Returns:
        True if user was added or already a member.
    """
    try:
        client.add_group_member(group_id, user_id)
        return True
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 409:
            return True
        print(f"      ❌ Failed to add to {group_name}: {exc.response.status_code}")
        return False

def migrate_employee(client: BastionClient, employee: dict[str, Any], groups: dict[str, str]) -> dict[str, str] | None:
    """Migrate a single employee to vault-api.

    Args:
        client: Authenticated BastionClient.
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
        return None

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
    user_id = create_vault_user(client, email, display_name)
    if not user_id:
        print(f"      ❌ Failed to create user")
        return None

    print(f"      ✅ User: {user_id}")

    # 2. Add to appropriate group
    group_id = groups.get(target_group)
    if group_id:
        if add_user_to_group(client, user_id, group_id, target_group):
            print(f"      ✅ Added to {target_group}")
    else:
        print(f"      ⚠️  Group {target_group} not found")

    return {
        'email': email,
        'user_id': user_id,
        'lms_role': lms_role,
        'group': target_group,
    }

def main() -> None:
    """ Migrate LMS employees to vault-api users and group memberships."""
    print("🚀 Migrating LMS users to vault-api...")
    client = get_bastion_client()
    print(f"   Target: {client.base_url}")
    print()

    # 1. Fetch existing vault groups
    print("📋 Fetching vault-api groups...")
    groups = get_vault_groups(client)
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
        result = migrate_employee(client, emp, groups)
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
