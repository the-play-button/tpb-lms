// entropy-positional-args-excess-ok: handler exports (getGlossary) use CF Worker positional convention (request, env, ctx)
// entropy-handler-service-pattern-ok: getGlossary handler delegates to backend, minimal orchestration logic
/**
 * Get glossary for an organization
 * GET /glossary/:orgId?source_lang=fr&target_lang=en
 */

import { jsonResponse, errorResponse } from '../../cors.js';
import { log } from '@the-play-button/tpb-sdk-js';

export const getGlossary = async (request, env, ctx) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const orgId = pathParts[2];

    if (!orgId) {
        return errorResponse('Missing org_id', 400);
    }

    const sourceLang = url.searchParams.get('source_lang');
    const targetLang = url.searchParams.get('target_lang');

    let query = `
        SELECT id, source_lang, target_lang, source_term, target_term, context, created_at
        FROM glossary
        WHERE org_id = ?
    `;
    const params = [orgId];

    if (sourceLang) {
        query += ' AND source_lang = ?';
        params.push(sourceLang);
    }
    if (targetLang) {
        query += ' AND target_lang = ?';
        params.push(targetLang);
    }

    query += ' ORDER BY source_term';

    try {
        const result = await env.DB.prepare(query).bind(...params).all();

        return jsonResponse({
            org_id: orgId,
            terms: result.results,
            total: result.results.length
        });
    } catch (error) {
        log.error('glossary fetch failed', error, { file: 'handlers/glossary/getGlossary.js' });
        return errorResponse('Failed to fetch glossary', 500);
    }
};
