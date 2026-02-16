/**
 * Revoke an API key
 * DELETE /api/auth/api-keys/:id
 */

import { jsonResponse } from '../../cors.js';

export async function revokeAPIKeyHandler(request, env, auth, keyId) {
    try {
        const userId = auth.contact?.id;

        if (!userId) {
            return jsonResponse({ error: 'User not found' }, 400, request);
        }

        const key = await env.DB.prepare(`
            SELECT id FROM api_key WHERE id = ? AND user_id = ?
        `).bind(keyId, userId).first();

        if (!key) {
            return jsonResponse({ error: 'API key not found' }, 404, request);
        }

        await env.DB.prepare(`
            UPDATE api_key SET is_active = 0 WHERE id = ?
        `).bind(keyId).run();

        return jsonResponse({ success: true, message: 'API key revoked' }, 200, request);

    } catch (error) {
        console.error('Revoke API key error:', error);
        return jsonResponse({ error: 'Failed to revoke API key' }, 500, request);
    }
}
