/**
 * Vault API Client with abstracted auth
 * 
 * OAuth-Ready Design:
 * - Current: Uses CF Access headers (service token)
 * - Future: Can be switched to OAuth Bearer tokens by changing getAuthHeaders()
 * 
 * Usage:
 *   const vault = new VaultClient(env.VAULT_API_URL, env);
 *   const roles = await vault.getUserRoles('user@example.com');
 */

export class VaultClient {
  /**
   * @param {string} baseUrl - vault-api base URL
   * @param {object} env - Worker env with VAULT_CLIENT_ID and VAULT_CLIENT_SECRET
   */
  constructor(baseUrl, env) {
    this.baseUrl = baseUrl;
    this.env = env;
    
    // OAuth token cache (for future use)
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  /**
   * Auth abstraction - change this for OAuth migration
   * 
   * Current: CF Access service token headers
   * Future: OAuth Bearer token (just modify this method)
   * 
   * @returns {Promise<object>} - Headers object for authentication
   */
  async getAuthHeaders() {
    // Current implementation: CF Access service token
    return {
      'CF-Access-Client-Id': this.env.VAULT_CLIENT_ID,
      'CF-Access-Client-Secret': this.env.VAULT_CLIENT_SECRET
    };
    
    // ===============================================
    // FUTURE OAuth implementation (uncomment when ready):
    // ===============================================
    // 
    // // Check if we have a cached valid token
    // if (this.accessToken && this.tokenExpiry > Date.now()) {
    //   return { 'Authorization': `Bearer ${this.accessToken}` };
    // }
    // 
    // // Get new token via Client Credentials Grant
    // const resp = await fetch(`${this.baseUrl}/oauth/token`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    //   body: new URLSearchParams({
    //     grant_type: 'client_credentials',
    //     client_id: this.env.VAULT_CLIENT_ID,
    //     client_secret: this.env.VAULT_CLIENT_SECRET,
    //     scope: 'iam:read'
    //   })
    // });
    // 
    // if (!resp.ok) {
    //   throw new Error(`OAuth token request failed: ${resp.status}`);
    // }
    // 
    // const { access_token, expires_in } = await resp.json();
    // this.accessToken = access_token;
    // this.tokenExpiry = Date.now() + (expires_in * 1000) - 60000; // 1 min buffer
    // 
    // return { 'Authorization': `Bearer ${access_token}` };
  }

  /**
   * Make authenticated request to vault-api
   * 
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {object} body - Request body (optional)
   * @returns {Promise<object>} - Parsed JSON response
   */
  async request(method, path, body = null) {
    const headers = await this.getAuthHeaders();
    headers['Content-Type'] = 'application/json';
    
    const options = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const resp = await fetch(`${this.baseUrl}${path}`, options);
    
    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`vault-api error ${resp.status}: ${errorText}`);
    }
    
    return resp.json();
  }

  // ============================================
  // IAM Methods (Generic - no app-specific logic)
  // ============================================

  /**
   * Get user's roles
   * 
   * @param {string} identifier - User email or ID
   * @returns {Promise<{identifier: string, roles: Array}>}
   */
  async getUserRoles(identifier) {
    return this.request('GET', `/iam/users/${encodeURIComponent(identifier)}/roles`);
  }

  /**
   * Check if user can perform action on resource
   * 
   * @param {string} action - Action (read, create, update, delete)
   * @param {string} resource - Resource name
   * @param {string} userId - User ID
   * @returns {Promise<{allowed: boolean, reason?: string}>}
   */
  async can(action, resource, userId) {
    return this.request('POST', '/iam/can', { action, resource, user_id: userId });
  }

  /**
   * Get user details
   * 
   * @param {string} userId - User ID
   * @returns {Promise<{user: object}>}
   */
  async getUser(userId) {
    return this.request('GET', `/iam/users/${encodeURIComponent(userId)}`);
  }

  /**
   * List all users
   * 
   * @returns {Promise<{users: Array}>}
   */
  async listUsers() {
    return this.request('GET', '/iam/users');
  }

  // ============================================
  // Role/Group/Permission Methods (for setup scripts)
  // ============================================

  /**
   * Create a role
   * 
   * @param {string} name - Role name (should be namespaced, e.g., 'lms_admin')
   * @param {string} description - Role description
   * @returns {Promise<{role: object}>}
   */
  async createRole(name, description) {
    return this.request('POST', '/iam/roles', { name, description });
  }

  /**
   * Create a group
   * 
   * @param {string} name - Group name (should be namespaced, e.g., 'lms_admins')
   * @param {string} description - Group description
   * @returns {Promise<{group: object}>}
   */
  async createGroup(name, description) {
    return this.request('POST', '/iam/groups', { name, description });
  }

  /**
   * Assign role to group
   * 
   * @param {string} groupId - Group ID
   * @param {string} roleId - Role ID
   * @returns {Promise<object>}
   */
  async assignRoleToGroup(groupId, roleId) {
    return this.request('POST', `/iam/groups/${encodeURIComponent(groupId)}/roles`, { role_id: roleId });
  }

  /**
   * Add user to group
   * 
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID
   * @returns {Promise<object>}
   */
  async addUserToGroup(groupId, userId) {
    return this.request('POST', `/iam/groups/${encodeURIComponent(groupId)}/members`, { user_id: userId });
  }

  // ============================================
  // Secrets Engine Methods (KV-style)
  // ============================================

  /**
   * Get a secret value by path
   * 
   * @param {string} path - Secret path (e.g., "apps/lms/tally_webhook_secret")
   * @returns {Promise<string|null>} - Secret value or null if not found
   */
  async getSecret(path) {
    try {
      const result = await this.request('GET', `/secret/data/${encodeURIComponent(path)}`);
      return result.data?.value || null;
    } catch (err) {
      if (err.message.includes('404')) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Get a secret with full metadata
   * 
   * @param {string} path - Secret path
   * @returns {Promise<{value: string, metadata: object}|null>}
   */
  async getSecretWithMetadata(path) {
    try {
      const result = await this.request('GET', `/secret/data/${encodeURIComponent(path)}`);
      return result.data || null;
    } catch (err) {
      if (err.message.includes('404')) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Set a secret value
   * 
   * @param {string} path - Secret path
   * @param {string} value - Secret value
   * @param {object} options - Optional: description, type, tags
   * @returns {Promise<object>}
   */
  async setSecret(path, value, options = {}) {
    return this.request('POST', `/secret/data/${encodeURIComponent(path)}`, {
      value,
      ...options
    });
  }

  /**
   * Delete a secret
   * 
   * @param {string} path - Secret path
   * @returns {Promise<object>}
   */
  async deleteSecret(path) {
    return this.request('DELETE', `/secret/data/${encodeURIComponent(path)}`);
  }

  /**
   * List secrets by prefix
   * 
   * @param {string} prefix - Path prefix (e.g., "apps/lms/")
   * @returns {Promise<Array<{path: string, type: string, description: string}>>}
   */
  async listSecrets(prefix = '') {
    const result = await this.request('GET', `/secret/list/${encodeURIComponent(prefix)}`);
    return result.keys || [];
  }
}

// ============================================
// Cached Secret Helper for Workers
// ============================================

/**
 * Cache for secrets to avoid fetching on every request.
 * Uses a simple in-memory cache with TTL.
 */
const secretCache = new Map();
const SECRET_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get a secret with caching
 * 
 * @param {VaultClient} vault - VaultClient instance
 * @param {string} path - Secret path
 * @returns {Promise<string|null>}
 */
export async function getCachedSecret(vault, path) {
  const cached = secretCache.get(path);
  if (cached && cached.expiry > Date.now()) {
    return cached.value;
  }
  
  const value = await vault.getSecret(path);
  secretCache.set(path, { value, expiry: Date.now() + SECRET_CACHE_TTL });
  return value;
}
