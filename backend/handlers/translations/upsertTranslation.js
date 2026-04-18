// entropy-positional-args-excess-ok: handler exports (upsertTranslation) use CF Worker positional convention (request, env, ctx)
// entropy-handler-service-pattern-ok: upsertTranslation handler delegates to backend, minimal orchestration logic
/**
 * Create or update a translation
 * PUT /translations/:type/:id/:lang
 * Body: { field: "name", value: "Translated text", source: "manual" }
 */

import { jsonResponse, errorResponse } from '../../cors.js';

export const upsertTranslation = async (request, env, ctx) => {
    const pathParts = new URL(request.url).pathname.split('/');
    const contentType = pathParts[2];
    const contentId = pathParts[3];
    const lang = pathParts[4];

    if (!contentType || !contentId || !lang) {
        return errorResponse('Missing content_type, content_id, or lang', 400);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse('Invalid JSON body', 400);
    }

    const { field, value, source = 'manual' } = body;

    if (!field || value === undefined) {
        return errorResponse('Missing field or value', 400);
    }

    const userId = ctx.user?.id || 'system';
    const id = `${contentType}:${contentId}:${field}:${lang}`;

    try {
        await env.DB.prepare(`
            INSERT INTO translations (id, content_type, content_id, field, lang, value, source, reviewed_at, reviewed_by, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))
            ON CONFLICT(content_type, content_id, field, lang)
            DO UPDATE SET value = ?, source = ?, reviewed_at = datetime('now'), reviewed_by = ?, updated_at = datetime('now')
        `).bind(id, contentType, contentId, field, lang, value, source, userId, value, source, userId).run();

        return jsonResponse({
            success: true,
            id,
            content_type: contentType,
            content_id: contentId,
            field,
            lang,
            value,
            source
        });
    } catch (error) {
        console.error('Error upserting translation:', error);
        return errorResponse('Failed to save translation', 500);
    }
};
