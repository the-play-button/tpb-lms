# Integration Guide for TPB Applications

Guide for LMS, CRM, and other TPB apps to use vault-api.

## Principle

```
┌─────────────────────────────────────────────────────────┐
│                  vault-api (Platform)                   │
│                                                         │
│  • GENERIC - No application-specific logic              │
│  • Returns RAW data (roles[], secrets, etc.)            │
│  • No "student", "admin" - just role names              │
└─────────────────────────────────────────────────────────┘
                              ↑
                              │ VaultClient
                              │
┌─────────────────────────────────────────────────────────┐
│                   Application (e.g. LMS)                │
│                                                         │
│  • INTERPRETS data according to its own logic           │
│  • Mapping: tpblms_admin → "admin"                      │
│  • Defaults: no role = "student"                        │
└─────────────────────────────────────────────────────────┘
```

## Step 1: Register Application

Admin creates application in vault-api dashboard:

1. Go to `/applications/dashboard`
2. Click "New Application"
3. Fill form:
   - **Name**: `tpblms` (lowercase, 3-20 chars)
   - **Scopes**: `tpblms:role:*`, `tpblms:group:*`, `tpblms:user:*`
4. **Save credentials** (shown once!)

## Step 2: Configure Worker

### wrangler.toml

```toml
[vars]
VAULT_API_URL = "https://tpb-vault-infra.matthieu-marielouise.workers.dev"
```

### Add secrets

```bash
wrangler secret put VAULT_CLIENT_ID
wrangler secret put VAULT_CLIENT_SECRET
```

## Step 3: Create VaultClient

```javascript
// backend/lib/vaultClient.js

export class VaultClient {
  constructor(baseUrl, env) {
    this.baseUrl = baseUrl;
    this.env = env;
  }

  async getAuthHeaders() {
    return {
      'CF-Access-Client-Id': this.env.VAULT_CLIENT_ID,
      'CF-Access-Client-Secret': this.env.VAULT_CLIENT_SECRET
    };
  }

  async request(method, path, body = null) {
    const headers = await this.getAuthHeaders();
    headers['Content-Type'] = 'application/json';
    
    const resp = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });
    
    return resp.json();
  }

  async getUserRoles(email) {
    return this.request('GET', `/iam/users/${encodeURIComponent(email)}/roles`);
  }

  async getSecret(path) {
    return this.request('GET', `/v1/secret/data/${path}`);
  }
}
```

## Step 4: Setup IAM Resources

Create roles and groups for your app:

```javascript
// scripts/setup-vault-iam.js

const ROLES = [
  { name: 'tpblms_admin', description: 'LMS Administrator' },
  { name: 'tpblms_instructor', description: 'Course Instructor' }
];

const GROUPS = [
  { name: 'tpblms_admins', roles: ['tpblms_admin'] },
  { name: 'tpblms_instructors', roles: ['tpblms_instructor'] }
];

// Create via vault-api...
```

## Step 5: Resolve Roles

```javascript
// backend/auth.js

export async function resolveRole(email, env) {
  if (!env.VAULT_API_URL || !env.VAULT_CLIENT_ID) {
    return 'student'; // Fallback
  }

  try {
    const vault = new VaultClient(env.VAULT_API_URL, env);
    const data = await vault.getUserRoles(email);
    const roleNames = (data.roles || []).map(r => r.name);
    
    // APP-SPECIFIC MAPPING
    if (roleNames.includes('tpblms_admin')) return 'admin';
    if (roleNames.includes('tpblms_instructor')) return 'instructor';
    
    return 'student'; // Default
    
  } catch (err) {
    console.error('vault-api error:', err.message);
    return 'student';
  }
}
```

## Step 6: Use Secrets

```javascript
// Get a secret from vault
const vault = new VaultClient(env.VAULT_API_URL, env);
const result = await vault.getSecret('infra/openai_api_key');
const apiKey = result.data?.value;
```

## Namespace Convention

| Type | Format | Example |
|------|--------|---------|
| Role | `{namespace}_{role}` | `tpblms_admin` |
| Group | `{namespace}_{group}` | `tpblms_admins` |

## Authentication Flow

```
1. User logs in via CF Access
2. App receives JWT with email
3. App calls vault.getUserRoles(email)
4. vault-api returns: [{name: "tpblms_admin"}, ...]
5. App interprets: "tpblms_admin" → role="admin"
6. App uses role for local RBAC
```

## FAQ

### Why no "student" role in vault-api?

"student" is an application default. vault-api only stores explicit roles. No role = default = student.

### How to add user to a group?

```javascript
// 1. Create user
const user = await vault.request('POST', '/iam/users', {
  email: 'new@example.com'
});

// 2. Add to group
await vault.request('POST', '/iam/groups/grp_tpblms_admins/members', {
  user_id: user.user.id
});
```


