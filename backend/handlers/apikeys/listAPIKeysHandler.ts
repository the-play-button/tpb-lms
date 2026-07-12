/**
 * List API keys for the current user
 * GET /api/auth/api-keys
 */

import { jsonResponse } from '../../cors.js';
import { log } from '@the-play-button/tpb-sdk-js';
import { listKeysForUser } from '../../services/apikeys/ApiKeysService.js';
import type { Env } from "../../types/Env.js";

export const listAPIKeysHandler = async (request: Request, env: Env, auth) => {
    try {
        const userId = auth.contact?.id;
        if (!userId) return jsonResponse({ error: 'User not found' }, 400, request);

        const apiKeys = await listKeysForUser(env, userId);
        return jsonResponse({ apiKeys }, 200, request);
    } catch (error) {
        log.error('API keys list failed', error, { file: 'handlers/apikeys/listAPIKeysHandler.js' });
        return jsonResponse({ error: 'Failed to list API keys' }, 500, request);
    }
};
