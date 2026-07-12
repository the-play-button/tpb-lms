/**
 * Add a term to the glossary
 * POST /glossary/:orgId
 * Body: { source_lang, target_lang, source_term, target_term, context? }
 */

import { jsonResponse, errorResponse } from '../../cors.js';
import { log } from '@the-play-button/tpb-sdk-js';
import { upsertTerm } from '../../services/glossary/GlossaryService.js';
import { bulkImportTerms } from '../../services/glossary/GlossaryImportService.js';
import { extractOrgIdFromUrl, isValidTermPayload } from './_glossaryShared.js';
import type { Env } from "../../types/Env.js";

export const createGlossaryTerm = async (request: Request, env: Env, ctx) => {
    const orgId = extractOrgIdFromUrl(request);
    if (!orgId) return errorResponse('Missing org_id', 400);

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse('Invalid JSON body', 400);
    }

    // Bulk create: body { terms: [...] } (Tier 1 create accepting single-or-array;
    // no separate /import endpoint — cf. crud_list_only_endpoint_design § Q3).
    if (Array.isArray(body?.terms)) {
        if (body.terms.length === 0) return errorResponse('terms must be a non-empty array', 400);
        const { successCount, errorCount } = await bulkImportTerms(env, orgId, body.terms);
        return jsonResponse({ success: true, imported: successCount, errors: errorCount });
    }

    if (!isValidTermPayload(body)) {
        return errorResponse('Missing required fields: source_lang, target_lang, source_term, target_term', 400);
    }

    try {
        const id = await upsertTerm(env, orgId, body);
        const { source_lang, target_lang, source_term, target_term, context } = body;
        return jsonResponse({
            success: true,
            id,
            org_id: orgId,
            source_lang,
            target_lang,
            source_term,
            target_term,
            context,
        });
    } catch (error) {
        log.error('glossary term add failed', error, { file: 'handlers/glossary/createGlossaryTerm.js' });
        return errorResponse('Failed to add glossary term', 500);
    }
};
