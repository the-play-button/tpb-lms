#!/usr/bin/env node
/**
 * Setup LMS IAM in vault-api
 * 
 * Creates LMS-namespaced roles and groups in vault-api.
 * Run this once to bootstrap LMS IAM structure.
 * 
 * Usage:
 *   export VAULT_CLIENT_ID='your-client-id.access'
 *   export VAULT_CLIENT_SECRET='your-client-secret'
 *   node scripts/setup-vault-iam.js
 * 
 * Credentials: Get from vault-api dashboard or admin
 */

const VAULT_API_URL = process.env.VAULT_API_URL || 'https://tpb-vault-infra.matthieu-marielouise.workers.dev';

// LMS IAM Structure
// Roles use tpblms_ prefix (matches app namespace in vault-api)
const LMS_ROLES = [
  {
    name: 'tpblms_admin',
    description: 'LMS Administrator - Full access to admin dashboard and all features'
  },
  {
    name: 'tpblms_instructor',
    description: 'LMS Instructor - Can manage courses and view student progress'
  }
  // Note: No tpblms_student role - absence of role = student (default)
];

// Groups organize users and link to roles
const LMS_GROUPS = [
  {
    name: 'tpblms_admins',
    description: 'LMS Administrators group',
    roles: ['tpblms_admin']
  },
  {
    name: 'tpblms_instructors', 
    description: 'LMS Instructors group',
    roles: ['tpblms_instructor']
  }
];

async function getAuthHeaders() {
  const clientId = process.env.VAULT_CLIENT_ID;
  const clientSecret = process.env.VAULT_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.error('❌ Missing credentials!');
    console.error('');
    console.error('   Set these environment variables:');
    console.error("   export VAULT_CLIENT_ID='your-client-id.access'");
    console.error("   export VAULT_CLIENT_SECRET='your-client-secret'");
    console.error('');
    console.error('   Get credentials from vault-api dashboard or admin.');
    process.exit(1);
  }
  
  return {
    'CF-Access-Client-Id': clientId,
    'CF-Access-Client-Secret': clientSecret,
    'Content-Type': 'application/json'
  };
}

async function request(method, path, body = null) {
  const headers = await getAuthHeaders();
  const options = { method, headers };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const resp = await fetch(`${VAULT_API_URL}${path}`, options);
  const data = await resp.json();
  
  return { status: resp.status, data };
}

async function createRole(role) {
  console.log(`  🔧 Creating role: ${role.name}`);
  
  const { status, data } = await request('POST', '/iam/roles', {
    name: role.name,
    description: role.description
  });
  
  if (status === 201) {
    console.log(`     ✅ Created: ${data.role?.id || role.name}`);
    return data.role?.id;
  } else if (status === 409) {
    console.log(`     ⚠️  Already exists`);
    // Get existing role ID
    const { data: rolesData } = await request('GET', '/iam/roles');
    const existing = rolesData.roles?.find(r => r.name === role.name);
    return existing?.id;
  } else {
    console.log(`     ❌ Failed: ${status} ${JSON.stringify(data)}`);
    return null;
  }
}

async function createGroup(group, roleIds) {
  console.log(`  🔧 Creating group: ${group.name}`);
  
  const { status, data } = await request('POST', '/iam/groups', {
    name: group.name,
    description: group.description
  });
  
  let groupId;
  
  if (status === 201) {
    console.log(`     ✅ Created: ${data.group?.id || group.name}`);
    groupId = data.group?.id;
  } else if (status === 409) {
    console.log(`     ⚠️  Already exists`);
    // Get existing group ID
    const { data: groupsData } = await request('GET', '/iam/groups');
    const existing = groupsData.groups?.find(g => g.name === group.name);
    groupId = existing?.id;
  } else {
    console.log(`     ❌ Failed: ${status} ${JSON.stringify(data)}`);
    return null;
  }
  
  // Assign roles to group
  if (groupId && group.roles) {
    for (const roleName of group.roles) {
      const roleId = roleIds[roleName];
      if (!roleId) {
        console.log(`     ⚠️  Role ${roleName} not found, skipping`);
        continue;
      }
      
      console.log(`     📎 Assigning role: ${roleName}`);
      const { status: assignStatus } = await request('POST', `/iam/groups/${groupId}/roles`, {
        role_id: roleId
      });
      
      if (assignStatus === 200 || assignStatus === 201) {
        console.log(`        ✅ Role assigned`);
      } else if (assignStatus === 409) {
        console.log(`        ⚠️  Role already assigned`);
      } else {
        console.log(`        ❌ Failed to assign role`);
      }
    }
  }
  
  return groupId;
}

async function main() {
  console.log('🚀 Setting up LMS IAM in vault-api...');
  console.log(`   Target: ${VAULT_API_URL}`);
  console.log('');
  
  // 1. Create roles
  console.log('📋 Creating roles...');
  const roleIds = {};
  
  for (const role of LMS_ROLES) {
    const roleId = await createRole(role);
    if (roleId) {
      roleIds[role.name] = roleId;
    }
  }
  console.log('');
  
  // 2. Create groups and assign roles
  console.log('👥 Creating groups...');
  
  for (const group of LMS_GROUPS) {
    await createGroup(group, roleIds);
  }
  console.log('');
  
  // Summary
  console.log('✨ LMS IAM setup complete!');
  console.log('');
  console.log('📊 Created:');
  console.log(`   • ${LMS_ROLES.length} roles: ${LMS_ROLES.map(r => r.name).join(', ')}`);
  console.log(`   • ${LMS_GROUPS.length} groups: ${LMS_GROUPS.map(g => g.name).join(', ')}`);
  console.log('');
  console.log('🎯 Next steps:');
  console.log('   1. Add users to groups via vault-api');
  console.log('   2. Or run provision_test_accounts.py for test users');
  console.log('   3. Users will have roles resolved via vault-api');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

