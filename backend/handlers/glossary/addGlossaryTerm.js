// entropy-handler-service-pattern-ok: simple handler, business logic is minimal
/**
 * Add a term to the glossary
 * POST /glossary/:orgId
 * Body: { source_lang, target_lang, source_term, target_term, context? }
 */

import { jsonResponse, errorResponse } from '../../cors.js';

export const addGlossaryTerm = async (request, env, ctx) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
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
        console.error('Error adding glossary term:', error);
        return errorResponse('Failed to add glossary term', 500);
    }
};
