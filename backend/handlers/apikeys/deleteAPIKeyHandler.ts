/**
 * Revoke an API key
 * DELETE /api/auth/api-keys/:id
 */

import { jsonResponse } from '../../cors.js';
import { log } from '@the-play-button/tpb-sdk-js';
import { findKeyByIdAndUser, revokeKey } from '../../services/apikeys/ApiKeysService.js';
import type { Env } from "../../types/Env.js";

export const deleteAPIKeyHandler = async (request: Request, env: Env, auth, keyId: string) => {
    try {
        const userId = auth.contact?.id;
        if (!userId) return jsonResponse({ error: 'User not found' }, 400, request);

        const key = await findKeyByIdAndUser(env, keyId, userId);
        if (!key) return jsonResponse({ error: 'API key not found' }, 404, request);

        await revokeKey(env, keyId);
        return jsonResponse({ success: true, message: 'API key revoked' }, 200, request);
    } catch (error) {
        log.error('API key revoke failed', error, { file: 'handlers/apikeys/deleteAPIKeyHandler.js' });
        return jsonResponse({ error: 'Failed to revoke API key' }, 500, request);
    }
};
