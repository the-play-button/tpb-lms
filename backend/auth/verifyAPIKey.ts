/**
 * Verify API Key against database
 */

import { sha256 } from './_shared.js';
import { log } from '@the-play-button/tpb-sdk-js';
import type { Env } from "../types/Env.js";
import { toError } from "../utils/toError.js";

interface ApiKeyRow {
    id: string;
    name?: string;
    user_id?: string;
    scopes?: string;
    expires_at?: string | null;
    is_active?: number;
}

export const verifyAPIKey = async (apiKey: string | null | undefined, env: Env): Promise<{
    valid: boolean;
    error: string;
    keyId?: undefined;
    keyName?: undefined;
    userId?: undefined;
    scopes?: undefined;
    authMethod?: undefined;
} | {
    valid: boolean;
    keyId: string;
    keyName: string | undefined;
    userId: string | undefined;
    scopes: string | undefined;
    authMethod: string;
    error?: undefined;
}>  => {
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
        `).bind(keyHash).first<ApiKeyRow>();

        if (!record) {
            return { valid: false, error: 'Invalid API key' };
        }

        if (record.expires_at && new Date(record.expires_at) < new Date()) {
            return { valid: false, error: 'API key expired' };
        }

        void env.DB.prepare(`
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
        log.error('API key verification error', toError(error), { file: 'auth/verifyAPIKey.js' });
        return { valid: false, error: 'API key verification failed' };
    }
};
