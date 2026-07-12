/**
 * Create or update a translation
 * PUT /translations/:type/:id/:lang
 * Body: { field: "name", value: "Translated text", source: "manual" }
 */

import { jsonResponse, errorResponse } from '../../cors.js';
import { log } from '@the-play-button/tpb-sdk-js';
import { upsertOne } from '../../services/translations/TranslationsService.js';
import type { Env } from "../../types/Env.js";
import type { HandlerUserContext } from "../../types/HandlerContext.js";
import { toError } from "../../utils/toError.js";

interface UpsertTranslationBody { field?: string; value?: string; source?: string; }

export const upsertTranslation = async (request: Request, env: Env, ctx: HandlerUserContext) => {
    const pathParts = new URL(request.url).pathname.split('/');
    const contentType = pathParts[2];
    const contentId = pathParts[3];
    const lang = pathParts[4];

    if (!contentType || !contentId || !lang) {
        return errorResponse('Missing content_type, content_id, or lang', 400);
    }

    let body: UpsertTranslationBody;
    try {
        body = await request.json() as UpsertTranslationBody;
    } catch {
        return errorResponse('Invalid JSON body', 400);
    }

    const { field, value, source = 'manual' } = body;
    if (!field || value === undefined) {
        return errorResponse('Missing field or value', 400);
    }

    const userId = ctx.user?.id || 'system';

    try {
        const id = await upsertOne(env, { contentType, contentId, field, lang, value, source, userId });
        return jsonResponse({
            success: true,
            id,
            content_type: contentType,
            content_id: contentId,
            field,
            lang,
            value,
            source,
        });
    } catch (error) {
        log.error('translation upsert failed', toError(error), { file: 'handlers/translations/upsertTranslation.js' });
        return errorResponse('Failed to upsert translation', 500);
    }
};
