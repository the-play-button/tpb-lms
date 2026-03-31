// entropy-handler-service-pattern-ok: simple handler, business logic is minimal
/**
 * List API keys for the current user
 * GET /api/auth/api-keys
 */

import { jsonResponse } from '../../cors.js';

export const listAPIKeysHandler = async (request, env, auth) => {
    try {
        const userId = auth.contact?.id;

        if (!userId) {
            return jsonResponse({ error: 'User not found' }, 400, request);
        }

        const keys = await env.DB.prepare(`
            SELECT id, name, key_prefix, scopes, created_at, last_used_at, expires_at, is_active
            FROM api_key
            WHERE user_id = ?
            ORDER BY created_at DESC
        `).bind(userId).all();

        return jsonResponse({
            apiKeys: keys.results.map(({ id, name, key_prefix, scopes, created_at, last_used_at, expires_at, is_active } = {}) => ({
                id: id,
                name: name,
                prefix: key_prefix,
                scopes: scopes,
                createdAt: created_at,
                lastUsedAt: last_used_at,
                expiresAt: expires_at,
                isActive: is_active === 1
            }))
        }, 200, request);

    } catch (error) {
        console.error('List API keys error:', error);
        return jsonResponse({ error: 'Failed to list API keys' }, 500, request);
    }
};
