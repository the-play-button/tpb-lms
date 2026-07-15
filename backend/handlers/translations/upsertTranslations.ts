/**
 * Batch upsert translations (for AI translation engine)
 * POST /translations/batch
 * Body: { translations: [{ content_type, content_id, field, lang, value, source }] }
 */

import { jsonResponse, errorResponse } from '../../cors.js';
import { bulkUpsert } from '../../services/translations/TranslationsService.js';
import type { Env } from "../../types/Env.js";
import type { HandlerUserContext } from "../../types/HandlerContext.js";

interface UpsertTranslationsBody { translations?: unknown[]; }

export const upsertTranslations = async (request: Request, env: Env, ctx: HandlerUserContext): Promise<Response>  => {
    let body: UpsertTranslationsBody;
    try {
        body = await request.json() as UpsertTranslationsBody;
    } catch {
        return errorResponse('Invalid JSON body', 400);
    }

    const { translations } = body;
    if (!Array.isArray(translations) || translations.length === 0) {
        return errorResponse('translations must be a non-empty array', 400);
    }

    const userId = ctx.user?.id || 'system';
    const { successCount, errorCount } = await bulkUpsert(env, translations as never, userId);
    return jsonResponse({
        success: true,
        inserted: successCount,
        errors: errorCount,
    });
};
