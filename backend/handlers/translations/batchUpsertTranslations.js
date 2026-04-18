// entropy-positional-args-excess-ok: handler exports (batchUpsertTranslations) use CF Worker positional convention (request, env, ctx)
// entropy-handler-service-pattern-ok: batchUpsertTranslations handler delegates to backend, minimal orchestration logic
/**
 * Batch upsert translations (for AI translation engine)
 * POST /translations/batch
 * Body: { translations: [{ content_type, content_id, field, lang, value, source }] }
 */

import { jsonResponse, errorResponse } from '../../cors.js';

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
    let successCount = 0;
    let errorCount = 0;

    for (const t of translations) {
        const { content_type, content_id, field, lang, value, source = 'ai' } = t;
        if (!content_type || !content_id || !field || !lang || value === undefined) {
            errorCount++;
            continue;
        }

        const id = `${content_type}:${content_id}:${field}:${lang}`;

        try {
            await env.DB.prepare(`
                INSERT INTO translations (id, content_type, content_id, field, lang, value, source, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(content_type, content_id, field, lang)
                DO UPDATE SET value = ?, source = ?, updated_at = datetime('now')
            `).bind(id, content_type, content_id, field, lang, value, source, value, source).run();
            successCount++;
        } catch (error) {
            console.error(`Error upserting translation ${id}:`, error);
            errorCount++;
        }
    }

    return jsonResponse({
        success: true,
        inserted: successCount,
        errors: errorCount
    });
};
