/**
 * Cloudflare Secrets Controller
 * 
 * Manages Worker secrets via Cloudflare API.
 * Enables storing secret values programmatically without wrangler CLI.
 * 
 * API Reference:
 * https://developers.cloudflare.com/api/operations/worker-secrets-put-secret
 */

export class CloudflareSecretsController {
  constructor(env) {
    this.accountId = env.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = env.CLOUDFLARE_API_TOKEN;
    this.scriptName = 'tpb-vault-infra'; // The vault worker itself
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/workers/scripts/${this.scriptName}`;
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
      console.error('CF Secrets API error:', endpoint, result.errors);
      throw new Error(msg);
    }
    
    return result.result;
  }

  /**
   * Set a secret value on the worker
   * 
   * @param {string} name - Secret name (e.g., SECRET_infra_openai_api_key)
   * @param {string} value - Secret value
   * @param {string} type - Secret type: 'secret_text' (default) or 'plain_text'
   * 
   * API: PUT /accounts/{account_id}/workers/scripts/{script_name}/secrets
   */
  async setSecret(name, value, type = 'secret_text') {
    // Cloudflare API expects PUT to /secrets with the secret in the body
    return this._request('PUT', 'secrets', {
      name,
      text: value,
      type
    });
  }

  /**
   * Delete a secret from the worker
   * 
   * @param {string} name - Secret name to delete
   */
  async deleteSecret(name) {
    return this._request('DELETE', `secrets/${name}`);
  }

  /**
   * List all secrets (names only, values are not returned)
   */
  async listSecrets() {
    return this._request('GET', 'secrets');
  }
}

/**
 * Factory function to get controller instance
 */
export function getCfSecretsController(env) {
  if (!env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID not configured');
  }
  if (!env.CLOUDFLARE_API_TOKEN) {
    throw new Error('CLOUDFLARE_API_TOKEN not configured');
  }
  return new CloudflareSecretsController(env);
}

