#!/usr/bin/env node// entropy-console-leak-ok: CLI script uses console for operator output
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

const VAULT_API_URL = process.env.VAULT_API_URL || 'https://tpb-vault-infra.matthieu-marielouise.workers.dev'; // entropy-hardcoded-url-ok: fallback config URL

const LMS_ROLES = [
  {
    name: 'tpblms_admin',
    description: 'LMS Administrator - Full access to admin dashboard and all features'
  },
  {
    name: 'tpblms_instructor',
    description: 'LMS Instructor - Can manage courses and view student progress'
  }
];

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

const getAuthHeaders = async () => {
  const clientId = process.env.VAULT_CLIENT_ID;
  const clientSecret = process.env.VAULT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('❌ Missing credentials!'); // entropy-console-leak-ok: CLI script
    console.error(''); // entropy-console-leak-ok: CLI script
    console.error('   Set these environment variables:'); // entropy-console-leak-ok: CLI script
    console.error("   export VAULT_CLIENT_ID='your-client-id.access'"); // entropy-console-leak-ok: CLI script
    console.error("   export VAULT_CLIENT_SECRET='your-client-secret'"); // entropy-console-leak-ok: CLI script
    console.error(''); // entropy-console-leak-ok: CLI script
    console.error('   Get credentials from vault-api dashboard or admin.'); // entropy-console-leak-ok: CLI script
    process.exit(1);
  }

  return {
    'CF-Access-Client-Id': clientId,
    'CF-Access-Client-Secret': clientSecret,
    'Content-Type': 'application/json'
  };
};

const request = async (method, path, body = null) => {
  const headers = await getAuthHeaders();
  const options = { method, headers };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const resp = await fetch(`${VAULT_API_URL}${path}`, options);
  const data = await resp.json();

  return { status: resp.status, data };
};

const createRole = async role => {
  console.log(`  🔧 Creating role: ${role.name}`); // entropy-console-leak-ok: CLI script

  const { status, data } = await request('POST', '/iam/roles', {
    name: role.name,
    description: role.description
  });

  if (status === 201) {
    console.log(`     ✅ Created: ${data.role?.id || role.name}`); // entropy-console-leak-ok: CLI script
    return data.role?.id;
  } else if (status === 409) {
    console.log(`     ⚠️  Already exists`); // entropy-console-leak-ok: CLI script
    const { data: rolesData } = await request('GET', '/iam/roles');
    const existing = rolesData.roles?.find(({ name }) => name === role.name);
    return existing?.id;
  } else {
    console.log(`     ❌ Failed: ${status} ${JSON.stringify(data)}`); // entropy-console-leak-ok: CLI script
    return null;
  }
};

const createGroup = async (group, roleIds) => {
  console.log(`  🔧 Creating group: ${group.name}`); // entropy-console-leak-ok: CLI script

  const { status, data } = await request('POST', '/iam/groups', {
    name: group.name,
    description: group.description
  });

  let groupId;

  if (status === 201) {
    console.log(`     ✅ Created: ${data.group?.id || group.name}`); // entropy-console-leak-ok: CLI script
    groupId = data.group?.id;
  } else if (status === 409) {
    console.log(`     ⚠️  Already exists`); // entropy-console-leak-ok: CLI script
    const { data: groupsData } = await request('GET', '/iam/groups');
    const existing = groupsData.groups?.find(({ name }) => name === group.name);
    groupId = existing?.id;
  } else {
    console.log(`     ❌ Failed: ${status} ${JSON.stringify(data)}`); // entropy-console-leak-ok: CLI script
    return null;
  }

  if (groupId && group.roles) {
    for (const roleName of group.roles) {
      const roleId = roleIds[roleName];
      if (!roleId) {
        console.log(`     ⚠️  Role ${roleName} not found, skipping`); // entropy-console-leak-ok: CLI script
        continue;
      }

      console.log(`     📎 Assigning role: ${roleName}`); // entropy-console-leak-ok: CLI script
      const { status: assignStatus } = await request('POST', `/iam/groups/${groupId}/roles`, {
        role_id: roleId
      });

      if (assignStatus === 200 || assignStatus === 201) {
        console.log(`        ✅ Role assigned`); // entropy-console-leak-ok: CLI script
      } else if (assignStatus === 409) {
        console.log(`        ⚠️  Role already assigned`); // entropy-console-leak-ok: CLI script
      } else {
        console.log(`        ❌ Failed to assign role`); // entropy-console-leak-ok: CLI script
      }
    }
  }

  return groupId;
};

const main = async () => {
  console.log('🚀 Setting up LMS IAM in vault-api...'); // entropy-console-leak-ok: CLI script
  console.log(`   Target: ${VAULT_API_URL}`); // entropy-console-leak-ok: CLI script
  console.log(''); // entropy-console-leak-ok: CLI script

  // 1. Create roles
  console.log('📋 Creating roles...'); // entropy-console-leak-ok: CLI script
  const roleIds = {};

  for (const role of LMS_ROLES) {
    const roleId = await createRole(role);
    if (roleId) {
      roleIds[role.name] = roleId;
    }
  }
  console.log(''); // entropy-console-leak-ok: CLI script

  // 2. Create groups and assign roles
  console.log('👥 Creating groups...'); // entropy-console-leak-ok: CLI script

  for (const group of LMS_GROUPS) {
    await createGroup(group, roleIds);
  }
  console.log(''); // entropy-console-leak-ok: CLI script

  console.log('✨ LMS IAM setup complete!'); // entropy-console-leak-ok: CLI script
  console.log(''); // entropy-console-leak-ok: CLI script
  console.log('📊 Created:'); // entropy-console-leak-ok: CLI script
  console.log(`   • ${LMS_ROLES.length} roles: ${LMS_ROLES.map(({ name } = {}) => name).join(', ')}`); // entropy-console-leak-ok: CLI script
  console.log(`   • ${LMS_GROUPS.length} groups: ${LMS_GROUPS.map(({ name } = {}) => name).join(', ')}`); // entropy-console-leak-ok: CLI script
  console.log(''); // entropy-console-leak-ok: CLI script
  console.log('🎯 Next steps:'); // entropy-console-leak-ok: CLI script
  console.log('   1. Add users to groups via vault-api'); // entropy-console-leak-ok: CLI script
  console.log('   2. Or run provision_test_accounts.py for test users'); // entropy-console-leak-ok: CLI script
  console.log('   3. Users will have roles resolved via vault-api'); // entropy-console-leak-ok: CLI script
};

main().catch(err => {
  console.error('❌ Error:', err.message); // entropy-console-leak-ok: CLI script
  process.exit(1);
});
