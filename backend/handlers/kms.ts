/**
 * KMS Handlers — thin transport adapter over KmsReadService.
 */

import { jsonResponse } from '../cors.js';
import { log } from '@the-play-button/tpb-sdk-js';
import { listSpaces as svcListSpaces, getSpace as svcGetSpace, getPage as svcGetPage } from '../services/kms/KmsReadService.js';
import type { Env } from "../types/Env.js";
import type { HandlerUserContext } from "../types/HandlerContext.js";
import { toError } from "../utils/toError.js";

export const listSpaces = async (request: Request, env: Env, _userContext?: HandlerUserContext) => {
    try {
        const body = await svcListSpaces(env);
        return jsonResponse(body, 200, request);
    } catch (error) {
        log.error('Error listing spaces', toError(error));
        return jsonResponse({ error: 'Failed to list spaces' }, 500, request);
    }
};

export const getSpace = async (request: Request, env: Env, _userContext: HandlerUserContext | undefined, spaceId: string) => {
    try {
        const space = await svcGetSpace(env, spaceId);
        if (!space) return jsonResponse({ error: 'Space not found' }, 404, request);
        return jsonResponse({ space }, 200, request);
    } catch (error) {
        log.error('Error getting space', toError(error), { spaceId });
        return jsonResponse({ error: 'Failed to get space' }, 500, request);
    }
};

export const getPage = async (request: Request, env: Env, _userContext: HandlerUserContext | undefined, pageId: string) => {
    try {
        const page = await svcGetPage(env, pageId);
        if (!page) return jsonResponse({ error: 'Page not found' }, 404, request);
        return jsonResponse({ page }, 200, request);
    } catch (error) {
        log.error('Error getting page', toError(error), { pageId });
        return jsonResponse({ error: 'Failed to get page' }, 500, request);
    }
};
