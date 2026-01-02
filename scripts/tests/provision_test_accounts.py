#!/usr/bin/env python3
"""
Provision Test Accounts via vault-api

Creates test accounts with real authentication via vault-api.
Users can then login via CF Access with proper roles.

Uses VaultClient for credentials (reads from .env file automatically).
"""

import requests
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path for vault_client import
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
from vault_client import VaultClient

# vault-api endpoint
VAULT_API_BASE = VaultClient.DEFAULT_URL

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

def get_vault_headers():
    """
    Get auth headers for vault-api IAM operations.
    
    Flow:
    1. Use VaultClient (your personal credentials from .devcontainer/.env) to access the vault
    2. Fetch TPB LMS application credentials from vault
    3. Return headers with app credentials for IAM operations
    """
    try:
        # Step 1: Connect to vault with personal credentials
        vault = VaultClient.from_devcontainer()
        
        # Step 2: Get TPB LMS app credentials from vault
        client_id = vault.get_secret("apps/lms/vault_client_id")
        client_secret = vault.get_secret("apps/lms/vault_client_secret")
        
        if not client_id or not client_secret:
            print("❌ Missing TPB LMS credentials in vault!")
            print()
            print("   Add these secrets to vault:")
            print("   - apps/lms/vault_client_id")
            print("   - apps/lms/vault_client_secret")
            print()
            print("   Via: vault.set_secret('apps/lms/vault_client_id', '...')")
            sys.exit(1)
        
        # Step 3: Return headers with app credentials
        return {
            'CF-Access-Client-Id': client_id,
            'CF-Access-Client-Secret': client_secret,
            'Content-Type': 'application/json'
        }
    except ValueError as e:
        print(f"❌ {e}")
        sys.exit(1)

def create_user_via_vault(account):
    """Create user via vault-api."""
    print(f"🔧 Creating user: {account['email']} ({account['lms_role']})")
    
    headers = get_vault_headers()
    
    # 1. Create user
    user_payload = {
        'email': account['email'],
        'display_name': account['display_name'],
        'user_type': 'human',
        'grant_vault_access': True
    }
    
    response = requests.post(
        f"{VAULT_API_BASE}/iam/users",
        headers=headers,
        json=user_payload,
        timeout=30
    )
    
    if response.status_code == 409:
        print(f"  ⚠️  User {account['email']} already exists")
        # Get existing user ID by listing all users and filtering
        user_response = requests.get(
            f"{VAULT_API_BASE}/iam/users",
            headers=headers,
            timeout=30
        )
        if user_response.status_code == 200:
            users = user_response.json().get('users', [])
            for u in users:
                if u['email'] == account['email']:
                    print(f"  ✅ Found existing user: {u['id']}")
                    return u['id']
        print(f"  ❌ Could not find existing user")
        return None
    elif response.status_code != 201:
        print(f"  ❌ Failed to create user: {response.status_code} {response.text}")
        return None
    
    user_data = response.json()
    user_id = user_data['user']['id']
    
    print(f"  ✅ User created: {user_id}")
    
    # 2. Check CF Access result
    cf_access = user_data.get('cf_access', {})
    if cf_access.get('error'):
        print(f"  ⚠️  CF Access failed: {cf_access['error']}")
    else:
        print(f"  ✅ CF Access granted")
    
    return user_id

def get_vault_role_name(lms_role):
    """
    Map LMS role to vault-api role name.
    Uses tpblms namespace prefix (matches app namespace).
    """
    if lms_role == 'admin':
        return 'tpblms_admin'
    elif lms_role == 'instructor':
        return 'tpblms_instructor'
    else:
        return None  # Students don't need a vault role

def assign_role_to_user(user_id, lms_role):
    """
    Assign LMS role to user via vault-api groups.
    
    Role assignment in vault-api works via groups:
    1. User added to group (e.g., lms_admins)
    2. Group has role assigned (e.g., lms_admin)
    3. User inherits role through group membership
    """
    vault_role = get_vault_role_name(lms_role)
    
    if not vault_role:
        print(f"  ℹ️  No vault role needed for '{lms_role}' (default)")
        return True
    
    print(f"🎭 Assigning role '{vault_role}' to user {user_id}")
    
    headers = get_vault_headers()
    group_name = f"{vault_role}s"  # tpblms_admin -> tpblms_admins
    
    # Find the group
    groups_response = requests.get(
        f"{VAULT_API_BASE}/iam/groups",
        headers=headers,
        timeout=30
    )
    
    if groups_response.status_code != 200:
        print(f"  ❌ Failed to list groups: {groups_response.status_code}")
        return False
    
    groups = groups_response.json().get('groups', [])
    target_group = next((g for g in groups if g['name'] == group_name), None)
    
    if not target_group:
        print(f"  ⚠️  Group '{group_name}' not found. Run setup-vault-iam.js first.")
        return False
    
    # Add user to group
    add_member_response = requests.post(
        f"{VAULT_API_BASE}/iam/groups/{target_group['id']}/members",
        headers=headers,
        json={'user_id': user_id},
        timeout=30
    )
    
    if add_member_response.status_code == 409:
        print(f"  ⚠️  User already in group '{group_name}'")
        return True
    elif add_member_response.status_code not in [200, 201]:
        print(f"  ❌ Failed to add to group: {add_member_response.status_code} {add_member_response.text}")
        return False
    
    print(f"  ✅ User added to group '{group_name}'")
    return True

def create_lms_contact_data(account, user_id):
    """Create corresponding data in LMS database."""
    print(f"📊 Creating LMS data for {account['email']}")
    
    # This creates the crm_contact and hris_employee records
    # that LMS uses for role resolution
    
    import subprocess
    
    # Create crm_contact
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
    
    # Create hris_employee if instructor/admin
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
    
    # Execute via wrangler
    cmd = [
        'npx', 'wrangler', 'd1', 'execute', 'lms-db', 
        '--remote', '--command', contact_sql
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True, cwd='../..')
    if result.returncode != 0:
        print(f"  ❌ Failed to create LMS data: {result.stderr}")
        return False
    
    print(f"  ✅ LMS data created: {contact_id}")
    return contact_id

def main():
    """Main provisioning function."""
    print("🚀 Provisioning test accounts via vault-api...")
    print(f"   Target: {VAULT_API_BASE}")
    print(f"   Accounts: {len(TEST_ACCOUNTS)}")
    print()
    
    results = []
    
    for account in TEST_ACCOUNTS:
        print(f"📝 Processing: {account['email']}")
        
        # 1. Create user in vault-api
        user_id = create_user_via_vault(account)
        if not user_id:
            print(f"  ❌ Skipping {account['email']} - user creation failed")
            continue
        
        # 2. Assign role in vault-api (via group membership)
        role_success = assign_role_to_user(user_id, account['lms_role'])
        if not role_success:
            print(f"  ⚠️  Role assignment failed for {account['email']}")
        
        # 3. Create LMS data (fallback for local role resolution)
        contact_id = create_lms_contact_data(account, user_id)
        
        results.append({
            'email': account['email'],
            'user_id': user_id,
            'contact_id': contact_id,
            'lms_role': account['lms_role'],
            'status': 'success' if contact_id else 'partial'
        })
        
        print()
    
    # Summary
    print("📊 Provisioning Summary:")
    print("=" * 50)
    
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
