// entropy-positional-args-excess-ok: CF Worker handler utility — (request, env, ctx, param) calling convention
// entropy-handler-service-pattern-ok: simple handler, business logic is minimal
/**
 * Get all translations for a content item
 * GET /translations/:type/:id
 */

import { jsonResponse, errorResponse } from '../../cors.js';

export const getTranslations = async (request, env, ctx) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const contentType = pathParts[2];
    const contentId = pathParts[3];

    if (!contentType || !contentId) {
        return errorResponse('Missing content_type or content_id', 400);
    }

    try {
        const result = await env.DB.prepare(`
            SELECT field, lang, value, source, reviewed_at, reviewed_by, updated_at
            FROM translations
            WHERE content_type = ? AND content_id = ?
            ORDER BY lang, field
        `).bind(contentType, contentId).all();

        const byLang = {};
        for (const row of result.results) {
            if (!byLang[row.lang]) byLang[row.lang] = {};
            byLang[row.lang][row.field] = {
                value: row.value,
                source: row.source,
                reviewed_at: row.reviewed_at,
                reviewed_by: row.reviewed_by,
                updated_at: row.updated_at
            };
        }

        return jsonResponse({
            content_type: contentType,
            content_id: contentId,
            translations: byLang
        });
    } catch (error) {
        console.error('Error fetching translations:', error);
        return errorResponse('Failed to fetch translations', 500);
    }
};
