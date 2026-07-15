/**
 * Get all translations for a content item
 * GET /translations/:type/:id
 */

import { jsonResponse, errorResponse } from '../../cors.js';
import { log } from '@the-play-button/tpb-sdk-js';
import { listByContent } from '../../services/translations/TranslationsService.js';
import type { Env } from "../../types/Env.js";
import { toError } from "../../utils/toError.js";

export const getTranslations = async (request: Request, env: Env, _ctx?: unknown): Promise<Response>  => {
    const pathParts = new URL(request.url).pathname.split('/');
    const contentType = pathParts[2];
    const contentId = pathParts[3];

    if (!contentType || !contentId) {
        return errorResponse('Missing content_type or content_id', 400);
    }

    try {
        const translations = await listByContent(env, contentType, contentId);
        return jsonResponse({
            content_type: contentType,
            content_id: contentId,
            translations,
        });
    } catch (error) {
        log.error('translations fetch failed', toError(error), { file: 'handlers/translations/getTranslations.js' });
        return errorResponse('Failed to fetch translations', 500);
    }
};
