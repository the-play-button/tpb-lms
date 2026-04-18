// entropy-positional-args-excess-ok: handler exports (generateAPIKey) use CF Worker positional convention (request, env, ctx)
/**
 * Generate a new API Key
 * Returns the key only once - must be shown to user immediately
 */

import { sha256 } from './_shared.js';

export const generateAPIKey = async (name, userId, env, options = {}) => {
    const key = 'tpb_' + crypto.randomUUID().replace(/-/g, '');
    const keyHash = await sha256(key);
    const keyPrefix = key.substring(0, 12); // tpb_ + 8 chars

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const scopes = options.scopes || '*';
    const expiresAt = options.expiresAt || null;

    await env.DB.prepare(`
        INSERT INTO api_key (id, name, key_hash, key_prefix, user_id, scopes, expires_at, created_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(id, name, keyHash, keyPrefix, userId, scopes, expiresAt, now).run();

    return {
        id,
        key, // Only returned at creation time!
        prefix: keyPrefix,
        name,
        scopes,
        expiresAt,
        createdAt: now
    };
};
