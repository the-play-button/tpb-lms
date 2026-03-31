// entropy-positional-args-excess-ok: CF Worker handler utility — (request, env, ctx, param) calling convention
// entropy-handler-service-pattern-ok: simple handler, business logic is minimal
// entropy-duplicate-code-handlers-ok: intentional duplication
/**
 * Batch import glossary terms
 * POST /glossary/:orgId/import
 * Body: { terms: [{ source_lang, target_lang, source_term, target_term, context? }] }
 */

import { jsonResponse, errorResponse } from '../../cors.js';

export const importGlossaryTerms = async (request, env, ctx) => {
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

    const { terms } = body;
    if (!Array.isArray(terms) || terms.length === 0) {
        return errorResponse('terms must be a non-empty array', 400);
    }

    let successCount = 0;
    let errorCount = 0;

    for (const term of terms) {
        const { source_lang, target_lang, source_term, target_term, context } = term;
        if (!source_lang || !target_lang || !source_term || !target_term) {
            errorCount++;
            continue;
        }

        const id = `${orgId}-${source_lang}-${target_lang}-${source_term.toLowerCase().replace(/\s+/g, '_')}`;

        try {
            await env.DB.prepare(`
                INSERT INTO glossary (id, org_id, source_lang, target_lang, source_term, target_term, context, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(org_id, source_lang, target_lang, source_term)
                DO UPDATE SET target_term = ?, context = ?, updated_at = datetime('now')
            `).bind(id, orgId, source_lang, target_lang, source_term, target_term, context || null, target_term, context || null).run();
            successCount++;
        } catch (error) {
            console.error(`Error importing term ${source_term}:`, error);
            errorCount++;
        }
    }

    return jsonResponse({
        success: true,
        imported: successCount,
        errors: errorCount
    });
};
