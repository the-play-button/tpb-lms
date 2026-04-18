#!/usr/bin/env node// entropy-console-leak-ok: CLI script uses console for operator output
/**
 * Setup LMS IAM in vault-api
 *
 * Creates LMS-namespaced roles and groups in vault-api.
 * Run this once to bootstrap LMS IAM structure.
 *
 * Usage:
 *   export BASTION_TOKEN='bastion_xxx'   # service token from bastion /iam/service-tokens
 *   node scripts/setup-vault-iam.js
 *
 * Le token est aussi disponible dans .devcontainer/.env (loader à la charge du caller).
 */

const VAULT_API_URL = process.env.VAULT_API_URL || 'https://tpb-bastion-backend.matthieu-marielouise.workers.dev'; // entropy-hardcoded-url-ok: URL in setup-vault-iam is a fallback deployment configuration

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

const getAuthHeaders = () => {
  const vaultToken = process.env.BASTION_TOKEN;

  if (!vaultToken) {
    console.error('❌ Missing BASTION_TOKEN env var'); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
    console.error(''); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
    console.error('   Set it from .devcontainer/.env or from bastion service token:'); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
    console.error("   export BASTION_TOKEN='bastion_xxx'"); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
    console.error(''); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
    console.error('   Create one via bastion /iam/service-tokens (scope: iam:*).'); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
    process.exit(1);
  }

  return {
    'Authorization': `Bearer ${vaultToken}`,
    'Content-Type': 'application/json'
  };
};

const request = async (method, path, body = null) => {
  const options = { method, headers: getAuthHeaders() };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const resp = await fetch(`${VAULT_API_URL}${path}`, options);
  const data = await resp.json();

  return { status: resp.status, data };
};

const createRole = async role => {
  console.log(`  🔧 Creating role: ${role.name}`); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility

  const { status, data } = await request('POST', '/iam/roles', {
    name: role.name,
    description: role.description
  });

  if (status === 201) {
    console.log(`     ✅ Created: ${data.role?.id || role.name}`); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
    return data.role?.id;
  } else if (status === 409) {
    console.log(`     ⚠️  Already exists`); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
    const { data: rolesData } = await request('GET', '/iam/roles');
    return rolesData.roles?.find(({ name } = {}) => name === role.name)?.id;
  } else {
    console.log(`     ❌ Failed: ${status} ${JSON.stringify(data)}`); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
    return null;
  }
};

const createGroup = async (group, roleIds) => {
  console.log(`  🔧 Creating group: ${group.name}`); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility

  const { status, data } = await request('POST', '/iam/groups', {
    name: group.name,
    description: group.description
  });

  let groupId;

  if (status === 201) {
    console.log(`     ✅ Created: ${data.group?.id || group.name}`); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
    groupId = data.group?.id;
  } else if (status === 409) {
    console.log(`     ⚠️  Already exists`); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
    const { data: groupsData } = await request('GET', '/iam/groups');
    groupId = groupsData.groups?.find(({ name } = {}) => name === group.name)?.id;
  } else {
    console.log(`     ❌ Failed: ${status} ${JSON.stringify(data)}`); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
    return null;
  }

  if (groupId && group.roles) {
    for (const roleName of group.roles) {
      const roleId = roleIds[roleName];
      if (!roleId) {
        console.log(`     ⚠️  Role ${roleName} not found, skipping`); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
        continue;
      }

      console.log(`     📎 Assigning role: ${roleName}`); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
      const { status: assignStatus } = await request('POST', `/iam/groups/${groupId}/roles`, {
        role_id: roleId
      });

      if (assignStatus === 200 || assignStatus === 201) {
        console.log(`        ✅ Role assigned`); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
      } else if (assignStatus === 409) {
        console.log(`        ⚠️  Role already assigned`); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
      } else {
        console.log(`        ❌ Failed to assign role`); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
      }
    }
  }

  return groupId;
};

const main = async () => {
  console.log('🚀 Setting up LMS IAM in vault-api...'); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
  console.log(`   Target: ${VAULT_API_URL}`); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
  console.log(''); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility

  // 1. Create roles
  console.log('📋 Creating roles...'); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
  const roleIds = {};

  for (const role of LMS_ROLES) {
    const roleId = await createRole(role);
    if (roleId) {
      roleIds[role.name] = roleId;
    }
  }
  console.log(''); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility

  // 2. Create groups and assign roles
  console.log('👥 Creating groups...'); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility

  for (const group of LMS_GROUPS) {
    await createGroup(group, roleIds);
  }
  console.log(''); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility

  console.log('✨ LMS IAM setup complete!'); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
  console.log(''); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
  console.log('📊 Created:'); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
  console.log(`   • ${LMS_ROLES.length} roles: ${LMS_ROLES.map(({ name } = {}) => name).join(', ')}`); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
  console.log(`   • ${LMS_GROUPS.length} groups: ${LMS_GROUPS.map(({ name } = {}) => name).join(', ')}`); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
  console.log(''); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
  console.log('🎯 Next steps:'); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
  console.log('   1. Add users to groups via vault-api'); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
  console.log('   2. Or run provision_test_accounts.py for test users'); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
  console.log('   3. Users will have roles resolved via vault-api'); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
};

main().catch(err => { // entropy-then-catch-finally-ok: top-level script entrypoint — main().catch(err) is the Node.js convention
  console.error('❌ Error:', err.message); // entropy-console-leak-ok: CLI output in setup-vault-iam for operator visibility
  process.exit(1);
});
