#!/usr/bin/env node// entropy-console-leak-ok: CLI script uses console for operator output
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
 *   export VAULT_CLIENT_ID='admin-client-id.access'
 *   export VAULT_CLIENT_SECRET='admin-client-secret'
 *   node scripts/setup-vault-connections.js
 */

const VAULT_API_URL = process.env.VAULT_API_URL || 'https://tpb-vault-infra.matthieu-marielouise.workers.dev'; // entropy-hardcoded-url-ok: URL in setup-vault-connections is a fallback deployment configuration

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
  const clientId = process.env.VAULT_CLIENT_ID;
  const clientSecret = process.env.VAULT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('❌ Missing credentials!'); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
    console.error('   Set VAULT_CLIENT_ID and VAULT_CLIENT_SECRET'); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
    console.error('   (Requires admin access to create connections)'); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
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

  let data;
  try {
    data = await resp.json();
  } catch {
    data = { error: await resp.text() };
  }

  return { status: resp.status, data };
};

const createConnection = async conn => {
  console.log(`  🔧 Creating connection: ${conn.id}`); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility

  const { status, data } = await request('POST', '/vault/connections', {
    id: conn.id,
    integration_type: conn.integration_type,
    status: conn.status
  });

  if (status === 201) {
    console.log(`     ✅ Created`); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
    return true;
  } else if (status === 409) {
    console.log(`     ⚠️  Already exists`); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
    return true;
  } else {
    console.log(`     ❌ Failed: ${status} ${JSON.stringify(data)}`); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
    return false;
  }
};

const main = async () => {
  console.log('🚀 Setting up vault connections for LMS credentials...'); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
  console.log(`   Target: ${VAULT_API_URL}`); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
  console.log(''); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility

  console.log('📦 Creating connections...'); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility

  for (const conn of CONNECTIONS) {
    const success = await createConnection(conn);
    if (success) {
      console.log(`     📋 Secrets needed: ${conn.secrets_required.join(', ')}`); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
    }
  }

  console.log(''); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
  console.log('✨ Connections created!'); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
  console.log(''); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
  console.log('⚠️  IMPORTANT: Add secrets manually via vault-api dashboard:'); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
  console.log(`   ${VAULT_API_URL}/dashboard`); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
  console.log(''); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
  console.log('   For each connection, add the required secrets:'); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility

  for (const conn of CONNECTIONS) {
    console.log(`   • ${conn.id}: ${conn.secrets_required.join(', ')}`); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
  }

  console.log(''); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
  console.log('🔐 Alternative: Add secrets via API:'); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
  console.log('   curl -X POST \\'); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
  console.log('     -H "CF-Access-Client-Id: $VAULT_CLIENT_ID" \\'); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
  console.log('     -H "CF-Access-Client-Secret: $VAULT_CLIENT_SECRET" \\'); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
  console.log('     -H "Content-Type: application/json" \\'); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
  console.log('     -d \'{"name": "CLIENT_ID", "value": "your-value"}\' \\'); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
  console.log('     https://tpb-vault-infra.../vault/connections/conn_lms_service/secrets'); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
};

main().catch(err => { // entropy-then-catch-finally-ok: top-level script entrypoint — main().catch(err) is the Node.js convention
  console.error('❌ Error:', err.message); // entropy-console-leak-ok: CLI output in setup-vault-connections for operator visibility
  process.exit(1);
});
