/**
 * Test Fixtures Handler
 *
 * Provides an endpoint for seeding test data.
 * Protected by HMAC-validated `X-Test-Secret` header (constant-time compare).
 */

import { jsonResponse } from '../cors.js';
import { log } from '@the-play-button/tpb-sdk-js';
import { applyFixture, VALID_FIXTURES } from '../services/fixtures/TestFixturesService.js';
import type { Env } from "../types/Env.js";

const constantTimeSecretEquals = async (a, b) => {
    if (!a || !b) return false;
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode('timing-safe-compare'),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const [hmacA, hmacB] = await Promise.all([
        crypto.subtle.sign('HMAC', key, new TextEncoder().encode(a)),
        crypto.subtle.sign('HMAC', key, new TextEncoder().encode(b)),
    ]);
    if (hmacA.byteLength !== hmacB.byteLength) return false;
    const viewA = new Uint8Array(hmacA);
    const viewB = new Uint8Array(hmacB);
    let diff = 0;
    for (let i = 0; i < viewA.length; i += 1) diff |= viewA[i] ^ viewB[i];
    return diff === 0;
};

/**
 * POST /api/test/seed
 *
 * Headers:
 *   X-Test-Secret: <env.TEST_SECRET>
 *
 * Body:
 *   { "fixture": "step3", "user_id": "uuid-xxx", "email": "user@example.com" }
 *
 * Note: email is optional but HIGHLY RECOMMENDED for clean_slate to work properly.
 * The system uses both CF Access user_id AND contact_id (resolved from email).
 */
export const handleTestSeed = async (request: Request, env: Env) => {
    const secret = request.headers.get('X-Test-Secret');
    if (!await constantTimeSecretEquals(secret, env.TEST_SECRET)) {
        return jsonResponse({ error: 'Forbidden' }, 403, request);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, 400, request);
    }

    const { fixture, user_id, email } = body;
    if (!fixture) return jsonResponse({ error: 'fixture is required' }, 400, request);
    if (!user_id) return jsonResponse({ error: 'user_id is required' }, 400, request);
    if (!VALID_FIXTURES.includes(fixture)) {
        return jsonResponse({ error: `Invalid fixture. Valid: ${VALID_FIXTURES.join(', ')}` }, 400, request);
    }

    try {
        await applyFixture(env, user_id, fixture, email);
        return jsonResponse({
            success: true,
            fixture,
            user_id,
            email: email || null,
            message: `Fixture '${fixture}' applied successfully`,
        }, 200, request);
    } catch (e) {
        log.error('fixture error', e, { file: 'handlers/test.js' });
        return jsonResponse({ error: 'Failed to apply fixture', detail: e.message }, 500, request);
    }
};
