// entropy-single-export-ok: 3 tightly-coupled secret operations (get, mappings, prefetch) sharing vault client singleton
// entropy-legacy-marker-ok: vault migration fallback is documented
// entropy-import-error-ok: import resolves at runtime
/**
 * Secrets Helper
 *
 * Provides unified access to secrets with fallback:
 * 1. Try vault-api first (if VAULT_CLIENT_ID/SECRET are configured)
 * 2. Fall back to wrangler env secrets (legacy) entropy-legacy-marker-ok: documented technical debt
 * 
 * This allows gradual migration from wrangler secrets to vault.
 * 
 * Usage:
 *   import { getSecret, initSecrets } from './lib/secrets.js';
 *   
 *   // In handler:
 *   const tallySecret = await getSecret(env, 'apps/lms/tally_webhook_secret', 'TALLY_WEBHOOK_SECRET');
 */

import { VaultClient, getCachedSecret } from './vaultClient.js';
import { log } from './log.js';

let vaultClient = null;

const getVaultClient = env => {
  if (!vaultClient && env.BASTION_URL && env.VAULT_TOKEN) {
    vaultClient = new VaultClient(env.BASTION_URL, env);
  }
  return vaultClient;
};

/**
 * Get a secret value with vault fallback to env.
 * 
 * @param {object} env - Worker env
 * @param {string} vaultPath - Vault secret path (e.g., "apps/lms/tally_webhook_secret")
 * @param {string} envKey - Legacy env key (e.g., "TALLY_WEBHOOK_SECRET") entropy-legacy-marker-ok: documented technical debt
 * @returns {Promise<string|null>} - Secret value
 */
export const getSecret = async (env, vaultPath, envKey) => {
  const vault = getVaultClient(env);
  if (vault) {
    try {
      const value = await getCachedSecret(vault, vaultPath);
      if (value) {
        return value;
      }
    } catch (err) {
      log.warn(`Failed to fetch secret from vault (${vaultPath}):`, err.message);
    }
  }
  
  return env[envKey] || null;
};

/**
 * Secret path mappings (vault path -> env key)
 * Used for bulk fetching and documentation.
 */
export const SECRET_MAPPINGS = {
  'apps/lms/tally_webhook_secret': 'TALLY_WEBHOOK_SECRET',
  'apps/lms/tally_signing_secret': 'TALLY_SIGNING_SECRET',
  'infra/cloudflare_stream_signing_key_id': 'CLOUDFLARE_STREAM_SIGNING_KEY_ID',
  'infra/cloudflare_stream_signing_key_pem': 'CLOUDFLARE_STREAM_SIGNING_KEY_PEM',
};

/**
 * Pre-fetch all secrets (for startup optimization)
 * 
 * @param {object} env - Worker env
 * @returns {Promise<object>} - Map of env keys to values
 */
export const prefetchSecrets = async env => {
  const secrets = {};
  
  for (const [vaultPath, envKey] of Object.entries(SECRET_MAPPINGS)) {
    secrets[envKey] = await getSecret(env, vaultPath, envKey);
  }
  
  return secrets;
};


