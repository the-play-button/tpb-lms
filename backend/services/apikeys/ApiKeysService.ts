/**
 * ApiKeysService — list/revoke API keys per user.
 */

export const listKeysForUser = async (env, userId) => {
    const result = await env.DB.prepare(`
        SELECT id, name, key_prefix, scopes, created_at, last_used_at, expires_at, is_active
        FROM api_key
        WHERE user_id = ?
        ORDER BY created_at DESC
    `).bind(userId).all();

    return (result.results || []).map((row) => ({
        id: row.id,
        name: row.name,
        prefix: row.key_prefix,
        scopes: row.scopes,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
        expiresAt: row.expires_at,
        isActive: row.is_active === 1,
    }));
};

export const findKeyByIdAndUser = (env, keyId, userId) =>
    env.DB.prepare('SELECT id FROM api_key WHERE id = ? AND user_id = ?')
        .bind(keyId, userId).first();

export const revokeKey = (env, keyId) =>
    env.DB.prepare('UPDATE api_key SET is_active = 0 WHERE id = ?')
        .bind(keyId).run();
