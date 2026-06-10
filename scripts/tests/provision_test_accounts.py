#!/usr/bin/env python3
"""
Provision Test Accounts via bastion IAM

Creates test accounts with real authentication via bastion.
Users can then login via CF Access with proper roles.

Uses BastionClient SDK exclusively — devcontainer credentials read from .devcontainer/.env.
"""

import subprocess
import sys
from typing import Any

import httpx

from tpb_sdk.bastion import BastionClient

_CLI_SEPARATOR_WIDTH = 50

# Test accounts to create
# Uses real emails with +alias for actual authentication via CF Access
# Role names use tpblms_ namespace prefix in vault-api
TEST_ACCOUNTS = [
    {
        'email': 'matthieu.marielouise@komdab.net',
        'display_name': 'Test Student',
        'lms_role': 'student',  # No vault role needed (default)
        'description': 'Test student account - real email with +alias'
    },
    {
        'email': 'wayzate@gmail.com',
        'display_name': 'Test Instructor',
        'lms_role': 'instructor',  # Maps to tpblms_instructor vault role
        'description': 'Test instructor account - real email with +alias'
    },
    {
        'email': 'matthieu.marielouise@gmail.com',
        'display_name': 'Test Admin',
        'lms_role': 'admin',  # Maps to tpblms_admin vault role
        'description': 'Test admin account - real email with +alias'
    }
]


def get_bastion_client() -> BastionClient:
    """Build a BastionClient from the canonical devcontainer creds path."""
    try:
        return BastionClient.from_devcontainer()
    except (FileNotFoundError, ValueError, RuntimeError) as exc:
        print(f"❌ Missing bastion credentials: {exc}")
        print("   Configure .devcontainer/.env with BASTION_CLIENT_ID/SECRET/TOKEN.")
        sys.exit(1)


def create_user_via_vault(client: BastionClient, account: dict[str, Any]) -> str | None:
    """Create user via vault-api using the SDK.

    Args:
        client: Authenticated BastionClient.
        account: Account config dict with email, display_name, and lms_role.

    Returns:
        User ID string if created or found, None on failure.
    """
    print(f"🔧 Creating user: {account['email']} ({account['lms_role']})")

    payload = {
        'email': account['email'],
        'display_name': account['display_name'],
        'user_type': 'human',
        'grant_vault_access': True,
    }

    try:
        created = client.create_user(payload)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 409:
            print(f"  ⚠️  User {account['email']} already exists")
            for user in client.list_users():
                if user.get('email') == account['email']:
                    print(f"  ✅ Found existing user: {user['id']}")
                    return user['id']
            print("  ❌ Could not find existing user")
            return None
        print(f"  ❌ Failed to create user: {exc.response.status_code} {exc.response.text}")
        return None

    user_id = created.get('id') if isinstance(created, dict) else None
    if not user_id:
        print(f"  ❌ create_user returned no id: {created}")
        return None

    print(f"  ✅ User created: {user_id}")
    cf_access = created.get('cf_access', {}) if isinstance(created, dict) else {}
    if cf_access.get('error'):
        print(f"  ⚠️  CF Access failed: {cf_access['error']}")
    elif cf_access:
        print(f"  ✅ CF Access granted")

    return user_id


def get_vault_role_name(lms_role: str) -> str | None:
    """Map LMS role to vault-api role name.

    Uses tpblms namespace prefix (matches app namespace).
    """
    if lms_role == 'admin':
        return 'tpblms_admin'
    elif lms_role == 'instructor':
        return 'tpblms_instructor'
    else:
        return None  # Students don't need a vault role


def assign_role_to_user(client: BastionClient, user_id: str, lms_role: str) -> bool:
    """Assign LMS role to user via vault-api groups.

    Role assignment in vault-api works via groups:
    1. User added to group (e.g., tpblms_admins)
    2. Group has role assigned (e.g., tpblms_admin)
    3. User inherits role through group membership

    Args:
        client: Authenticated BastionClient.
        user_id: Vault user identifier.
        lms_role: LMS role name (admin, instructor, or student).

    Returns:
        True if role was assigned successfully.
    """
    vault_role = get_vault_role_name(lms_role)

    if not vault_role:
        print(f"  ℹ️  No vault role needed for '{lms_role}' (default)")
        return True

    print(f"🎭 Assigning role '{vault_role}' to user {user_id}")

    group_name = f"{vault_role}s"  # tpblms_admin -> tpblms_admins

    groups = client.list_groups()
    target_group = next((g for g in groups if g.get('name') == group_name), None)

    if not target_group:
        print(f"  ⚠️  Group '{group_name}' not found. Run setup-vault-iam.js first.")
        return False

    try:
        client.add_group_member(target_group['id'], user_id)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 409:
            print(f"  ⚠️  User already in group '{group_name}'")
            return True
        print(f"  ❌ Failed to add to group: {exc.response.status_code} {exc.response.text}")
        return False

    print(f"  ✅ User added to group '{group_name}'")
    return True


def create_lms_contact_data(account: dict[str, Any], user_id: str) -> str | bool:
    """Create corresponding data in LMS database via wrangler.

    Args:
        account: Account config dict with email, display_name, and lms_role.
        user_id: Vault user identifier.

    Returns:
        Contact ID string if created, False on failure.
    """
    print(f"📊 Creating LMS data for {account['email']}")

    # This creates the crm_contact and hris_employee records
    # that LMS uses for role resolution

    contact_id = f"contact_{user_id}"
    contact_sql = f"""
    INSERT OR REPLACE INTO crm_contact (id, name, emails_json, created_at, updated_at)
    VALUES (
        '{contact_id}',
        '{account['display_name']}',
        '[{{"email":"{account['email']}","type":"WORK"}}]',
        datetime('now'),
        datetime('now')
    );
    """

    if account['lms_role'] in ['instructor', 'admin']:
        roles_json = '["admin"]' if account['lms_role'] == 'admin' else '["instructor"]'
        employee_sql = f"""
        INSERT OR REPLACE INTO hris_employee (
            id, name, emails_json, employee_roles_json, created_at, updated_at
        ) VALUES (
            'emp_{contact_id}',
            '{account['display_name']}',
            '[{{"email":"{account['email']}","type":"WORK"}}]',
            '{roles_json}',
            datetime('now'),
            datetime('now')
        );
        """
        contact_sql += employee_sql

    cmd = [
        'npx', 'wrangler', 'd1', 'execute', 'lms-db',
        '--remote', '--command', contact_sql
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, cwd='../..', check=True)
    if result.returncode != 0:
        print(f"  ❌ Failed to create LMS data: {result.stderr}")
        return False

    print(f"  ✅ LMS data created: {contact_id}")
    return contact_id


def main():
    """Main provisioning function."""
    print("🚀 Provisioning test accounts via vault-api...")
    client = get_bastion_client()
    print(f"   Target: {client.base_url}")
    print(f"   Accounts: {len(TEST_ACCOUNTS)}")
    print()

    results = []

    for account in TEST_ACCOUNTS:
        print(f"📝 Processing: {account['email']}")

        user_id = create_user_via_vault(client, account)
        if not user_id:
            print(f"  ❌ Skipping {account['email']} - user creation failed")
            continue

        role_success = assign_role_to_user(client, user_id, account['lms_role'])
        if not role_success:
            print(f"  ⚠️  Role assignment failed for {account['email']}")

        contact_id = create_lms_contact_data(account, user_id)

        results.append({
            'email': account['email'],
            'user_id': user_id,
            'contact_id': contact_id,
            'lms_role': account['lms_role'],
            'status': 'success' if contact_id else 'partial'
        })

        print()

    print("📊 Provisioning Summary:")
    print("=" * _CLI_SEPARATOR_WIDTH)

    for result in results:
        status_icon = "✅" if result['status'] == 'success' else "⚠️"
        print(f"{status_icon} {result['email']}")
        print(f"   User ID: {result['user_id']}")
        print(f"   Contact ID: {result['contact_id']}")
        print(f"   LMS Role: {result['lms_role']}")
        print()

    print("🎯 Next Steps:")
    print("1. Users can now login via CF Access at:")
    print("   https://lms-viewer.matthieu-marielouise.workers.dev")
    print("2. They will have the correct roles in LMS")
    print("3. Use these accounts for manual testing")


if __name__ == '__main__':
    main()
