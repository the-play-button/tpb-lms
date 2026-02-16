// entropy-handler-service-pattern-ok: simple handler, business logic is minimal
/**
 * Delete a glossary term
 * DELETE /glossary/:orgId/:termId
 */

import { jsonResponse, errorResponse } from '../../cors.js';

export async function deleteGlossaryTerm(request, env, ctx) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const orgId = pathParts[2];
    const termId = pathParts[3];

    if (!orgId || !termId) {
        return errorResponse('Missing org_id or term_id', 400);
    }

    try {
        const result = await env.DB.prepare(`
            DELETE FROM glossary WHERE id = ? AND org_id = ?
        `).bind(termId, orgId).run();

        if (result.meta.changes === 0) {
            return errorResponse('Term not found', 404);
        }

        return jsonResponse({ success: true, deleted: termId });
    } catch (error) {
        console.error('Error deleting glossary term:', error);
        return errorResponse('Failed to delete glossary term', 500);
    }
}
