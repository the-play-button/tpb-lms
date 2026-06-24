/**
 * Batch import glossary terms
 * POST /glossary/:orgId/import
 * Body: { terms: [{ source_lang, target_lang, source_term, target_term, context? }] }
 */

import { jsonResponse, errorResponse } from '../../cors.js';
import { log } from '@the-play-button/tpb-sdk-js';
import { upsertTerm } from '../../services/glossary/GlossaryService.js';
import { extractOrgIdFromUrl, isValidTermPayload } from './_glossaryShared.js';
import { bulkImportTerms } from '../../services/glossary/GlossaryImportService.js';

export const importGlossaryTerms = async (request, env, ctx) => {
    const orgId = extractOrgIdFromUrl(request);
    if (!orgId) return errorResponse('Missing org_id', 400);

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

    const { successCount, errorCount } = await bulkImportTerms(env, orgId, terms);
    return jsonResponse({
        success: true,
        imported: successCount,
        errors: errorCount,
    });
};
