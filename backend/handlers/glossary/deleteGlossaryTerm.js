// entropy-positional-args-excess-ok: handler exports (deleteGlossaryTerm) use CF Worker positional convention (request, env, ctx)
// entropy-handler-service-pattern-ok: deleteGlossaryTerm handler delegates to backend, minimal orchestration logic
/**
 * Delete a glossary term
 * DELETE /glossary/:orgId/:termId
 */

import { jsonResponse, errorResponse } from '../../cors.js';
import { log } from '@the-play-button/tpb-sdk-js';

export const deleteGlossaryTerm = async (request, env, ctx) => {
    const pathParts = new URL(request.url).pathname.split('/');
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
        log.error('glossary term delete failed', error, { file: 'handlers/glossary/deleteGlossaryTerm.js' });
        return errorResponse('Failed to delete glossary term', 500);
    }
};
