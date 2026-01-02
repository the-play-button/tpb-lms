/**
 * Cloudflare Access Controller
 * 
 * vault-api is SSOT - this module CONTROLS Cloudflare Access directly.
 * Based on logic from 04.Execution/cloudflare/manage_access.py
 */

export class CloudflareAccessController {
  constructor(env) {
    this.accountId = env.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = env.CLOUDFLARE_API_TOKEN;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/access`;
  }

  async _request(method, endpoint, data = null) {
    const url = `${this.baseUrl}/${endpoint}`;
    
    const resp = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : undefined
    });
    
    const result = await resp.json();
    
    if (!result.success) {
      const msg = result.errors?.[0]?.message || 'Cloudflare API error';
      console.error('CF API error:', endpoint, result.errors);
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

  async findEmailPolicy(appId, email) {
    const policies = await this.listPolicies(appId);
    for (const p of policies) {
      const hasEmail = p.include?.some(inc => inc.email?.email === email);
      if (hasEmail) return p;
    }
    return null;
  }

  // =========================================
  // Access Groups (Zero Trust)
  // Used for audience-based access control
  // =========================================

  async listAccessGroups() {
    return this._request('GET', 'groups');
  }

  async getAccessGroup(groupId) {
    return this._request('GET', `groups/${groupId}`);
  }

  async createAccessGroup(name, include = []) {
    return this._request('POST', 'groups', {
      name,
      include  // Array of selectors: [{email: {email: "x@y.com"}}, ...]
    });
  }

  async updateAccessGroup(groupId, include) {
    // Get current group to preserve name
    const group = await this.getAccessGroup(groupId);
    return this._request('PUT', `groups/${groupId}`, {
      name: group.name,
      include
    });
  }

  async deleteAccessGroup(groupId) {
    return this._request('DELETE', `groups/${groupId}`);
  }

  async addEmailToGroup(groupId, email) {
    const group = await this.getAccessGroup(groupId);
    const currentInclude = group.include || [];
    
    // Check if already included
    const alreadyExists = currentInclude.some(inc => inc.email?.email === email);
    if (alreadyExists) {
      return { alreadyExists: true };
    }
    
    // Add email
    const newInclude = [...currentInclude, { email: { email } }];
    await this.updateAccessGroup(groupId, newInclude);
    return { alreadyExists: false, added: true };
  }

  async removeEmailFromGroup(groupId, email) {
    const group = await this.getAccessGroup(groupId);
    const currentInclude = group.include || [];
    
    // Filter out the email
    const newInclude = currentInclude.filter(inc => inc.email?.email !== email);
    
    if (newInclude.length === currentInclude.length) {
      return { found: false };
    }
    
    await this.updateAccessGroup(groupId, newInclude);
    return { found: true, removed: true };
  }

  // =========================================
  // Policies with Access Groups
  // =========================================

  async addGroupPolicy(appId, groupId, policyName) {
    const policies = await this.listPolicies(appId);
    const precedence = policies.length + 1;
    
    return this._request('POST', `apps/${appId}/policies`, {
      name: policyName,
      decision: 'allow',
      precedence,
      include: [{ group: { id: groupId } }]
    });
  }

  async findGroupPolicy(appId, groupId) {
    const policies = await this.listPolicies(appId);
    for (const p of policies) {
      const hasGroup = p.include?.some(inc => inc.group?.id === groupId);
      if (hasGroup) return p;
    }
    return null;
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
  // Convenience: Create token + add to app (atomic)
  // =========================================

  async createServiceTokenWithAccess(tokenName, appName) {
    // 1. Create token
    const token = await this.createServiceToken(tokenName);
    
    // 2. Find app
    const app = await this.getAppByName(appName);
    if (!app) {
      // Cleanup: delete the token we just created
      try { await this.deleteServiceToken(token.id); } catch {}
      throw new Error(`App '${appName}' not found in Cloudflare Access`);
    }
    
    // 3. Add policy to allow this token
    try {
      await this.addServiceTokenPolicy(app.id, token.id, tokenName);
    } catch (err) {
      // Cleanup on policy failure
      try { await this.deleteServiceToken(token.id); } catch {}
      throw new Error(`Failed to add token policy: ${err.message}`);
    }
    
    return {
      tokenId: token.id,
      clientId: token.client_id,
      clientSecret: token.client_secret,
      expiresAt: token.expires_at
    };
  }

  // =========================================
  // Convenience: Grant user email access to app
  // =========================================

  async grantUserAccess(email, appName) {
    const app = await this.getAppByName(appName);
    if (!app) {
      throw new Error(`App '${appName}' not found`);
    }
    
    // Check if already has access
    const existingPolicy = await this.findEmailPolicy(app.id, email);
    if (existingPolicy) {
      return { alreadyExists: true, policyId: existingPolicy.id };
    }
    
    const policy = await this.addEmailPolicy(app.id, email);
    return { alreadyExists: false, policyId: policy.id };
  }

  // =========================================
  // Convenience: Revoke user email access
  // =========================================

  async revokeUserAccess(email, appName) {
    const app = await this.getAppByName(appName);
    if (!app) {
      return { found: false };
    }
    
    const policy = await this.findEmailPolicy(app.id, email);
    if (policy) {
      await this.removePolicy(app.id, policy.id);
      return { found: true, policyId: policy.id };
    }
    
    return { found: false };
  }

  // =========================================
  // Convenience: Revoke service token + policy
  // =========================================

  async revokeServiceTokenWithAccess(cfTokenId, appName) {
    // 1. Delete the token itself
    try {
      await this.deleteServiceToken(cfTokenId);
    } catch (err) {
      console.error('Failed to delete CF token:', err);
      // Continue to try removing policy
    }
    
    // 2. Find and remove any policies for this token
    if (appName) {
      const app = await this.getAppByName(appName);
      if (app) {
        const policies = await this.listPolicies(app.id);
        for (const p of policies) {
          const hasToken = p.include?.some(inc => inc.service_token?.token_id === cfTokenId);
          if (hasToken) {
            await this.removePolicy(app.id, p.id);
          }
        }
      }
    }
    
    return { success: true };
  }
}

/**
 * Factory function to get controller instance
 */
export function getCfAccessController(env) {
  if (!env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID not configured');
  }
  if (!env.CLOUDFLARE_API_TOKEN) {
    throw new Error('CLOUDFLARE_API_TOKEN not configured');
  }
  return new CloudflareAccessController(env);
}

