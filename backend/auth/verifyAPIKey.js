/**
 * Verify API Key against database
 */

import { sha256 } from './_shared.js';

export const verifyAPIKey = async (apiKey, env) => {
    if (!apiKey) {
        return { valid: false, error: 'No API key provided' };
    }

    if (!apiKey.startsWith('tpb_')) {
        return { valid: false, error: 'Invalid API key format' };
    }

    try {
        const keyHash = await sha256(apiKey);

        const record = await env.DB.prepare(`
            SELECT id, name, user_id, scopes, expires_at, is_active
            FROM api_key
            WHERE key_hash = ? AND is_active = 1
        `).bind(keyHash).first();

        if (!record) {
            return { valid: false, error: 'Invalid API key' };
        }

        if (record.expires_at && new Date(record.expires_at) < new Date()) {
            return { valid: false, error: 'API key expired' };
        }

        env.DB.prepare(`
            UPDATE api_key SET last_used_at = ? WHERE id = ?
        `).bind(new Date().toISOString(), record.id).run();

        return {
            valid: true,
            keyId: record.id,
            keyName: record.name,
            userId: record.user_id,
            scopes: record.scopes,
            authMethod: 'api_key'
        };

    } catch (error) {
        console.error('API Key verification error:', error); // ACK:console_leak — auth error logging, not user-facing
        return { valid: false, error: 'API key verification failed' }; // entropy-error-verbosity-ok: generic message, no internal details
    }
};
