/**
 * Batch upsert translations (for AI translation engine)
 * POST /translations/batch
 * Body: { translations: [{ content_type, content_id, field, lang, value, source }] }
 */

import { jsonResponse, errorResponse } from '../../cors.js';
import { bulkUpsert } from '../../services/translations/TranslationsService.js';

export const batchUpsertTranslations = async (request, env, ctx) => {
    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse('Invalid JSON body', 400);
    }

    const { translations } = body;
    if (!Array.isArray(translations) || translations.length === 0) {
        return errorResponse('translations must be a non-empty array', 400);
    }

    const userId = ctx.user?.id || 'system';
    const { successCount, errorCount } = await bulkUpsert(env, translations, userId);
    return jsonResponse({
        success: true,
        inserted: successCount,
        errors: errorCount,
    });
};
