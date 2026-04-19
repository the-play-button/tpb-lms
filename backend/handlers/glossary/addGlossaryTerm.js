// entropy-positional-args-excess-ok: handler exports (addGlossaryTerm) use CF Worker positional convention (request, env, ctx)
// entropy-handler-service-pattern-ok: addGlossaryTerm handler delegates to backend, minimal orchestration logic
/**
 * Add a term to the glossary
 * POST /glossary/:orgId
 * Body: { source_lang, target_lang, source_term, target_term, context? }
 */

import { jsonResponse, errorResponse } from '../../cors.js';
import { log } from '@the-play-button/tpb-sdk-js';

export const addGlossaryTerm = async (request, env, ctx) => {
    const pathParts = new URL(request.url).pathname.split('/');
    const orgId = pathParts[2];

    if (!orgId) {
        return errorResponse('Missing org_id', 400);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse('Invalid JSON body', 400);
    }

    const { source_lang, target_lang, source_term, target_term, context } = body;

    if (!source_lang || !target_lang || !source_term || !target_term) {
        return errorResponse('Missing required fields: source_lang, target_lang, source_term, target_term', 400);
    }

    const id = `${orgId}-${source_lang}-${target_lang}-${source_term.toLowerCase().replace(/\s+/g, '_')}`;

    try {
        await env.DB.prepare(`
            INSERT INTO glossary (id, org_id, source_lang, target_lang, source_term, target_term, context, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(org_id, source_lang, target_lang, source_term)
            DO UPDATE SET target_term = ?, context = ?, updated_at = datetime('now')
        `).bind(id, orgId, source_lang, target_lang, source_term, target_term, context || null, target_term, context || null).run();

        return jsonResponse({
            success: true,
            id,
            org_id: orgId,
            source_lang,
            target_lang,
            source_term,
            target_term,
            context
        });
    } catch (error) {
        log.error('glossary term add failed', error, { file: 'handlers/glossary/addGlossaryTerm.js' });
        return errorResponse('Failed to add glossary term', 500);
    }
};
