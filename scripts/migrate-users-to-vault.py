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
    export VAULT_CLIENT_SECRET='your-client-secret'
    python scripts/migrate-users-to-vault.py

This is a one-time migration script. After migration, vault-api 
becomes the SSOT for IAM and hris_employee is deprecated for roles.
"""

import subprocess
import json
import os
import sys
import requests

VAULT_API_URL = os.environ.get(
    'VAULT_API_URL', 
    'https://tpb-vault-infra.matthieu-marielouise.workers.dev'
)

def get_vault_headers():
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

def fetch_lms_employees():
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
        return []
    
    return []

def get_vault_groups():
    """Fetch existing groups from vault-api."""
    headers = get_vault_headers()
    
    resp = requests.get(
        f"{VAULT_API_URL}/iam/groups",
        headers=headers,
        timeout=30
    )
    
    if resp.status_code != 200:
        print(f"❌ Failed to fetch groups: {resp.status_code}")
        return {}
    
    groups = resp.json().get('groups', [])
    return {g['name']: g['id'] for g in groups}

def create_vault_user(email, display_name):
    """Create user in vault-api."""
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
        timeout=30
    )
    
    if resp.status_code == 201:
        return resp.json()['user']['id']
    elif resp.status_code == 409:
        # User exists, try to find ID
        list_resp = requests.get(
            f"{VAULT_API_URL}/iam/users",
            headers=headers,
            timeout=30
        )
        if list_resp.status_code == 200:
            users = list_resp.json().get('users', [])
            for u in users:
                if u['email'] == email:
                    return u['id']
    
    return None

def add_user_to_group(user_id, group_id, group_name):
    """Add user to vault-api group."""
    headers = get_vault_headers()
    
    resp = requests.post(
        f"{VAULT_API_URL}/iam/groups/{group_id}/members",
        headers=headers,
        json={'user_id': user_id},
        timeout=30
    )
    
    if resp.status_code in [200, 201]:
        return True
    elif resp.status_code == 409:
        return True  # Already member
    
    print(f"      ❌ Failed to add to {group_name}: {resp.status_code}")
    return False

def migrate_employee(employee, groups):
    """Migrate a single employee to vault-api."""
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

def main():
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
    print("=" * 50)
    print("📊 Migration Summary")
    print("=" * 50)
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

