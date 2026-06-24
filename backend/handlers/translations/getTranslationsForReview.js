/**
 * Get translations needing review
 * GET /translations/review?source=ai&limit=50
 */

import { jsonResponse, errorResponse } from '../../cors.js';
import { log } from '@the-play-button/tpb-sdk-js';
import { listForReview } from '../../services/translations/TranslationsService.js';

export const getTranslationsForReview = async (request, env, ctx) => {
    const url = new URL(request.url);
    const source = url.searchParams.get('source') || 'ai';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    try {
        const translations = await listForReview(env, source, limit);
        return jsonResponse({ translations, total: translations.length });
    } catch (error) {
        log.error('translations for review fetch failed', error, { file: 'handlers/translations/getTranslationsForReview.js' });
        return errorResponse('Failed to fetch translations', 500);
    }
};
