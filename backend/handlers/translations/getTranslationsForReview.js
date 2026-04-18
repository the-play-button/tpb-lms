// entropy-positional-args-excess-ok: handler exports (getTranslationsForReview) use CF Worker positional convention (request, env, ctx)
// entropy-handler-service-pattern-ok: getTranslationsForReview handler delegates to backend, minimal orchestration logic
/**
 * Get translations needing review
 * GET /translations/review?source=ai&limit=50
 */

import { jsonResponse, errorResponse } from '../../cors.js';

export const getTranslationsForReview = async (request, env, ctx) => {
    const url = new URL(request.url);
    const source = url.searchParams.get('source') || 'ai';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    try {
        const result = await env.DB.prepare(`
            SELECT id, content_type, content_id, field, lang, value, source, created_at
            FROM translations
            WHERE source = ? AND reviewed_at IS NULL
            ORDER BY created_at DESC
            LIMIT ?
        `).bind(source, limit).all();

        return jsonResponse({
            translations: result.results,
            total: result.results.length
        });
    } catch (error) {
        console.error('Error fetching translations for review:', error);
        return errorResponse('Failed to fetch translations', 500);
    }
};
