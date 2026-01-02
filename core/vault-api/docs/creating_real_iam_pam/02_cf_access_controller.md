# Phase 2 - Cloudflare Access Controller

## Objectif

Créer un module `backend/services/cfAccess.js` qui contrôle CF Access directement depuis vault-api.

Basé sur la logique existante de `04.Execution/cloudflare/manage_access.py`.

## Module cfAccess.js

```javascript
// backend/services/cfAccess.js

/**
 * Cloudflare Access Controller
 * vault-api contrôle CF Access (SSOT)
 */

export class CloudflareAccessController {
  constructor(env) {
    this.accountId = env.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = env.CLOUDFLARE_API_TOKEN_IAM;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/access`;
  }

  async _request(method, endpoint, data = null) {
    const resp = await fetch(`${this.baseUrl}/${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : undefined
    });
    
    const result = await resp.json();
    if (!result.success) {
      const msg = result.errors?.[0]?.message || 'CF API error';
      throw new Error(msg);
    }
    return result.result;
  }

  // =========================================
  // Applications
  // =========================================
  
  async listApps() {
    return this._request('GET', 'apps');
  }

  async getAppByName(name) {
    const apps = await this.listApps();
    return apps.find(a => a.name === name);
  }

  async getAppById(appId) {
    return this._request('GET', `apps/${appId}`);
  }

  // =========================================
  // Policies
  // =========================================

  async listPolicies(appId) {
    return this._request('GET', `apps/${appId}/policies`);
  }

  async addEmailPolicy(appId, email, name = null) {
    const policies = await this.listPolicies(appId);
    const precedence = policies.length + 1;
    
    return this._request('POST', `apps/${appId}/policies`, {
      name: name || `Allow ${email}`,
      decision: 'allow',
      precedence,
      include: [{ email: { email } }]
    });
  }

  async addServiceTokenPolicy(appId, tokenId, tokenName) {
    const policies = await this.listPolicies(appId);
    const precedence = policies.length + 1;
    
    return this._request('POST', `apps/${appId}/policies`, {
      name: `Service Token: ${tokenName}`,
      decision: 'non_identity',
      precedence,
      include: [{ service_token: { token_id: tokenId } }]
    });
  }

  async removePolicy(appId, policyId) {
    return this._request('DELETE', `apps/${appId}/policies/${policyId}`);
  }

  // =========================================
  // Service Tokens
  // =========================================

  async listServiceTokens() {
    return this._request('GET', 'service_tokens');
  }

  async createServiceToken(name, duration = '8760h') {
    return this._request('POST', 'service_tokens', { name, duration });
  }

  async deleteServiceToken(tokenId) {
    return this._request('DELETE', `service_tokens/${tokenId}`);
  }

  // =========================================
  // Convenience: Create token + add to app
  // =========================================

  async createServiceTokenWithAccess(tokenName, appName) {
    // 1. Create token
    const token = await this.createServiceToken(tokenName);
    
    // 2. Find app
    const app = await this.getAppByName(appName);
    if (!app) {
      throw new Error(`App '${appName}' not found`);
    }
    
    // 3. Add policy
    await this.addServiceTokenPolicy(app.id, token.id, tokenName);
    
    return {
      tokenId: token.id,
      clientId: token.client_id,
      clientSecret: token.client_secret,
      expiresAt: token.expires_at
    };
  }

  // =========================================
  // Convenience: Add user email to app
  // =========================================

  async grantUserAccess(email, appName) {
    const app = await this.getAppByName(appName);
    if (!app) {
      throw new Error(`App '${appName}' not found`);
    }
    
    // Check if already has access
    const policies = await this.listPolicies(app.id);
    for (const p of policies) {
      const hasEmail = p.include?.some(inc => inc.email?.email === email);
      if (hasEmail) {
        return { alreadyExists: true, policyId: p.id };
      }
    }
    
    const policy = await this.addEmailPolicy(app.id, email);
    return { alreadyExists: false, policyId: policy.id };
  }

  async revokeUserAccess(email, appName) {
    const app = await this.getAppByName(appName);
    if (!app) return { found: false };
    
    const policies = await this.listPolicies(app.id);
    for (const p of policies) {
      const hasEmail = p.include?.some(inc => inc.email?.email === email);
      if (hasEmail) {
        await this.removePolicy(app.id, p.id);
        return { found: true, policyId: p.id };
      }
    }
    return { found: false };
  }
}

export function getCfAccessController(env) {
  return new CloudflareAccessController(env);
}
```

## Secrets requis (wrangler.toml)

```toml
# Déjà existant mais vérifier
[vars]
ACCESS_TEAM_DOMAIN = "theplaybutton"

# Secrets à configurer
# CLOUDFLARE_ACCOUNT_ID - déjà dans conn_infra
# CLOUDFLARE_API_TOKEN_IAM - token avec droits Access:Edit
```

Le token `CLOUDFLARE_API_TOKEN_IAM` doit avoir les permissions:
- Account > Access: Apps and Policies > Edit
- Account > Access: Service Tokens > Edit

## Fichiers à créer

- `backend/services/cfAccess.js`

