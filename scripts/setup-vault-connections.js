#!/usr/bin/env node
/**
 * Setup Vault Connections for LMS Credentials
 *
 * Creates vault connections to store:
 * - LMS service credentials (for LMS -> vault-api auth)
 * - Test provisioning credentials (for scripts -> vault-api auth)
 *
 * IMPORTANT: After creating connections, you must add secrets manually
 * via the vault-api dashboard or API (requires admin access).
 *
 * Usage:
 *   export BASTION_CLIENT_ID='admin-client-id.access'
 *   export BASTION_CLIENT_SECRET='admin-client-secret'
 *   node scripts/setup-vault-connections.js
 */

const VAULT_API_URL = process.env.VAULT_API_URL || 'https://tpb-bastion-backend.matthieu-marielouise.workers.dev'; // entropy-hardcoded-url-ok: URL in setup-vault-connections is a fallback deployment configuration

const CONNECTIONS = [
  {
    id: 'conn_lms_service',
    integration_type: 'service_account',
    status: 'active',
    name: 'LMS Service Account',
    description: 'Credentials for LMS Worker to authenticate with vault-api',
    secrets_required: ['CLIENT_ID', 'CLIENT_SECRET']
  },
  {
    id: 'conn_test_provisioning',
    integration_type: 'service_account',
    status: 'active',
    name: 'Test Provisioning Token',
    description: 'Credentials for test scripts to create users via vault-api',
    secrets_required: ['TOKEN_ID', 'TOKEN_SECRET']
  }
];

const getAuthHeaders = async () => {
  const clientId = process.env.BASTION_CLIENT_ID;
  const clientSecret = process.env.BASTION_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('❌ Missing credentials!');    console.error('   Set BASTION_CLIENT_ID and BASTION_CLIENT_SECRET');    console.error('   (Requires admin access to create connections)');    process.exit(1);
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

  let data;
  try {
    data = await resp.json();
  } catch {
    data = { error: await resp.text() };
  }

  return { status: resp.status, data };
};

const createConnection = async conn => {
  console.log(`  🔧 Creating connection: ${conn.id}`);
  const { status, data } = await request('POST', '/vault/connections', {
    id: conn.id,
    integration_type: conn.integration_type,
    status: conn.status
  });

  if (status === 201) {
    console.log(`     ✅ Created`);    return true;
  } else if (status === 409) {
    console.log(`     ⚠️  Already exists`);    return true;
  } else {
    console.log(`     ❌ Failed: ${status} ${JSON.stringify(data)}`);    return false;
  }
};

const main = async () => {
  console.log('🚀 Setting up vault connections for LMS credentials...');  console.log(`   Target: ${VAULT_API_URL}`);  console.log('');
  console.log('📦 Creating connections...');
  for (const conn of CONNECTIONS) {
    const success = await createConnection(conn);
    if (success) {
      console.log(`     📋 Secrets needed: ${conn.secrets_required.join(', ')}`);    }
  }

  console.log('');  console.log('✨ Connections created!');  console.log('');  console.log('⚠️  IMPORTANT: Add secrets manually via vault-api dashboard:');  console.log(`   ${VAULT_API_URL}/dashboard`);  console.log('');  console.log('   For each connection, add the required secrets:');
  for (const conn of CONNECTIONS) {
    console.log(`   • ${conn.id}: ${conn.secrets_required.join(', ')}`);  }

  console.log('');  console.log('🔐 Alternative: Add secrets via API:');  console.log('   curl -X POST \\');  console.log('     -H "CF-Access-Client-Id: $BASTION_CLIENT_ID" \\');  console.log('     -H "CF-Access-Client-Secret: $BASTION_CLIENT_SECRET" \\');  console.log('     -H "Content-Type: application/json" \\');  console.log('     -d \'{"name": "CLIENT_ID", "value": "your-value"}\' \\');  console.log('     https://tpb-bastion-backend.../vault/connections/conn_lms_service/secrets');};

main().catch(err => { // entropy-then-catch-finally-ok entropy-promise-catch-log-only-ok: top-level script entrypoint — main().catch(err) is the Node.js convention, process.exit(1) ensures hard failure
  console.error('❌ Error:', err.message);
  process.exit(1);
});
