/**
 * Get glossary for an organization
 * GET /glossary/:orgId?source_lang=fr&target_lang=en
 */

import { jsonResponse, errorResponse } from '../../cors.js';
import { log } from '@the-play-button/tpb-sdk-js';
import { listTerms } from '../../services/glossary/GlossaryService.js';
import { extractOrgIdFromUrl } from './_glossaryShared.js';
import type { Env } from "../../types/Env.js";
import { toError } from "../../utils/toError.js";

export const getGlossary = async (request: Request, env: Env, _ctx?: unknown) => {
    const orgId = extractOrgIdFromUrl(request);
    if (!orgId) return errorResponse('Missing org_id', 400);

    const url = new URL(request.url);
    const filters = {
        sourceLang: url.searchParams.get('source_lang'),
        targetLang: url.searchParams.get('target_lang'),
    };

    try {
        const result = await listTerms(env, orgId, filters);
        return jsonResponse({
            org_id: orgId,
            terms: result.results,
            total: result.results.length,
        });
    } catch (error) {
        log.error('glossary fetch failed', toError(error), { file: 'handlers/glossary/getGlossary.js' });
        return errorResponse('Failed to fetch glossary', 500);
    }
};
