/**
 * Delete a glossary term
 * DELETE /glossary/:orgId/:termId
 */

import { jsonResponse, errorResponse } from '../../cors.js';
import { log } from '@the-play-button/tpb-sdk-js';
import { deleteTerm } from '../../services/glossary/GlossaryService.js';
import type { Env } from "../../types/Env.js";
import { toError } from "../../utils/toError.js";

export const deleteGlossaryTerm = async (request: Request, env: Env, _ctx?: unknown) => {
    const pathParts = new URL(request.url).pathname.split('/');
    const orgId = pathParts[2];
    const termId = pathParts[3];

    if (!orgId || !termId) {
        return errorResponse('Missing org_id or term_id', 400);
    }

    try {
        const result = await deleteTerm(env, orgId, termId);
        if (result.meta.changes === 0) return errorResponse('Term not found', 404);
        return jsonResponse({ success: true, deleted: termId });
    } catch (error) {
        log.error('glossary term delete failed', toError(error), { file: 'handlers/glossary/deleteGlossaryTerm.js' });
        return errorResponse('Failed to delete glossary term', 500);
    }
};
