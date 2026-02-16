// entropy-handler-service-pattern-ok: simple handler, business logic is minimal
/**
 * List API keys for the current user
 * GET /api/auth/api-keys
 */

import { jsonResponse } from '../../cors.js';

export async function listAPIKeysHandler(request, env, auth) {
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
            apiKeys: keys.results.map(k => ({
                id: k.id,
                name: k.name,
                prefix: k.key_prefix,
                scopes: k.scopes,
                createdAt: k.created_at,
                lastUsedAt: k.last_used_at,
                expiresAt: k.expires_at,
                isActive: k.is_active === 1
            }))
        }, 200, request);

    } catch (error) {
        console.error('List API keys error:', error);
        return jsonResponse({ error: 'Failed to list API keys' }, 500, request);
    }
}
