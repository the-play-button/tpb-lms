#!/usr/bin/env node
/**
 * Setup LMS IAM in vault-api
 *
 * Creates LMS-namespaced roles and groups in vault-api via the BastionClient SDK.
 * Run this once to bootstrap LMS IAM structure.
 *
 * Usage:
 *   export BASTION_TOKEN='bastion_xxx'   # service token from bastion /iam/service-tokens
 *   node scripts/setup-vault-iam.js
 *
 * Le token est aussi disponible dans .devcontainer/.env (loader à la charge du caller).
 */

import { createBastionClient } from '@the-play-button/tpb-sdk-js';

const BASTION_URL = process.env.BASTION_URL || 'https://tpb-bastion-backend.matthieu-marielouise.workers.dev';

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

const getBastion = () => {
  const vaultToken = process.env.BASTION_TOKEN;
  if (!vaultToken) {
    console.error('❌ Missing BASTION_TOKEN env var');
    console.error('');
    console.error('   Set it from .devcontainer/.env or from bastion service token:');
    console.error("   export BASTION_TOKEN='bastion_xxx'");
    console.error('');
    console.error('   Create one via bastion /iam/service-tokens (scope: iam:*).');
    process.exit(1);
  }
  return createBastionClient({ bastionUrl: BASTION_URL, serviceToken: vaultToken });
};

const createRole = async (bastion, role) => {
  console.log(`  🔧 Creating role: ${role.name}`);
  const result = await bastion.createRole({ name: role.name, description: role.description });

  if (result.ok) {
    console.log(`     ✅ Created: ${result.value.id || role.name}`);
    return result.value.id;
  }

  // Conflict path — role already exists, locate by name.
  const errStr = String(result.error);
  if (errStr.includes('409') || errStr.toLowerCase().includes('conflict')) {
    console.log(`     ⚠️  Already exists`);
    const listResult = await bastion.listRoles();
    if (!listResult.ok) {
      console.log(`     ❌ Failed to list roles: ${listResult.error}`);
      return null;
    }
    const found = listResult.value.find(({ name } = {}) => name === role.name);
    return found ? found.id : null;
  }
  console.log(`     ❌ Failed: ${result.error}`);
  return null;
};

const createGroup = async (bastion, group, roleIds) => {
  console.log(`  🔧 Creating group: ${group.name}`);
  const result = await bastion.createGroup({ name: group.name, description: group.description });

  let groupId;
  if (result.ok) {
    console.log(`     ✅ Created: ${result.value.id || group.name}`);
    groupId = result.value.id;
  } else {
    const errStr = String(result.error);
    if (errStr.includes('409') || errStr.toLowerCase().includes('conflict')) {
      console.log(`     ⚠️  Already exists`);
      const listResult = await bastion.listGroups();
      if (!listResult.ok) {
        console.log(`     ❌ Failed to list groups: ${listResult.error}`);
        return null;
      }
      const found = listResult.value.find(({ name } = {}) => name === group.name);
      groupId = found ? found.id : null;
    } else {
      console.log(`     ❌ Failed: ${result.error}`);
      return null;
    }
  }

  if (groupId && group.roles) {
    for (const roleName of group.roles) {
      const roleId = roleIds[roleName];
      if (!roleId) {
        console.log(`     ⚠️  Role ${roleName} not found, skipping`);
        continue;
      }
      console.log(`     📎 Assigning role: ${roleName}`);
      const assignResult = await bastion.assignRoleToGroup(groupId, roleId);
      if (assignResult.ok) {
        console.log(`        ✅ Role assigned`);
      } else {
        const errStr = String(assignResult.error);
        if (errStr.includes('409') || errStr.toLowerCase().includes('conflict')) {
          console.log(`        ⚠️  Role already assigned`);
        } else {
          console.log(`        ❌ Failed to assign role: ${assignResult.error}`);
        }
      }
    }
  }

  return groupId;
};

const main = async () => {
  console.log('🚀 Setting up LMS IAM in vault-api...');
  console.log(`   Target: ${BASTION_URL}`);
  console.log('');

  const bastion = getBastion();

  // 1. Create roles
  console.log('📋 Creating roles...');
  const roleIds = {};

  for (const role of LMS_ROLES) {
    const roleId = await createRole(bastion, role);
    if (roleId) {
      roleIds[role.name] = roleId;
    }
  }
  console.log('');

  // 2. Create groups and assign roles
  console.log('👥 Creating groups...');
  for (const group of LMS_GROUPS) {
    await createGroup(bastion, group, roleIds);
  }
  console.log('');

  console.log('✨ LMS IAM setup complete!');
  console.log('');
  console.log('📊 Created:');
  console.log(`   • ${LMS_ROLES.length} roles: ${LMS_ROLES.map(({ name } = {}) => name).join(', ')}`);
  console.log(`   • ${LMS_GROUPS.length} groups: ${LMS_GROUPS.map(({ name } = {}) => name).join(', ')}`);
  console.log('');
  console.log('🎯 Next steps:');
  console.log('   1. Add users to groups via vault-api');
  console.log('   2. Or run provision_test_accounts.py for test users');
  console.log('   3. Users will have roles resolved via vault-api');
};

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
