/**
 * KMS Handlers - Knowledge Management System API
 * 
 * Endpoints for serving reference documents (REFERENCES/, RULES/)
 * stored in kms_space and kms_page tables.
 * 
 * Routes:
 * - GET /api/kms/spaces - List all KMS spaces
 * - GET /api/kms/spaces/:id - Get space with its pages
 * - GET /api/kms/pages/:id - Get a single page content
 */

import { jsonResponse } from '../cors.js';
import logger from '../utils/log.js';

const log = logger('kms');

/**
 * List all KMS spaces
 * GET /api/kms/spaces
 */
export async function listSpaces(request, env, userContext) {
    try {
        const result = await env.DB.prepare(`
            SELECT id, name, description, parent_space_id, is_active, created_at, updated_at
            FROM kms_space
            WHERE is_active = 1
            ORDER BY name
        `).all();
        
        return jsonResponse({
            spaces: result.results || []
        }, 200, request);
        
    } catch (error) {
        log.error('Error listing spaces', { error });
        return jsonResponse({ error: 'Failed to list spaces' }, 500, request);
    }
}

/**
 * Get a single space with its pages
 * GET /api/kms/spaces/:id
 */
export async function getSpace(request, env, userContext, spaceId) {
    try {
        // Get space
        const space = await env.DB.prepare(`
            SELECT id, name, description, parent_space_id, is_active, created_at, updated_at
            FROM kms_space
            WHERE id = ? AND is_active = 1
        `).bind(spaceId).first();
        
        if (!space) {
            return jsonResponse({ error: 'Space not found' }, 404, request);
        }
        
        // Get pages in this space
        const pagesResult = await env.DB.prepare(`
            SELECT id, title, type, metadata_json, created_at, updated_at
            FROM kms_page
            WHERE space_id = ? AND is_active = 1
            ORDER BY title
        `).bind(spaceId).all();
        
        const pages = (pagesResult.results || []).map(page => ({
            id: page.id,
            title: page.title,
            type: page.type,
            metadata: page.metadata_json ? JSON.parse(page.metadata_json) : {},
            created_at: page.created_at,
            updated_at: page.updated_at
        }));
        
        return jsonResponse({
            space: {
                ...space,
                pages
            }
        }, 200, request);
        
    } catch (error) {
        log.error('Error getting space', { error, spaceId });
        return jsonResponse({ error: 'Failed to get space' }, 500, request);
    }
}

/**
 * Get a single page with full content
 * GET /api/kms/pages/:id
 */
export async function getPage(request, env, userContext, pageId) {
    try {
        const page = await env.DB.prepare(`
            SELECT p.id, p.title, p.type, p.space_id, p.metadata_json, p.raw_json, 
                   p.download_url, p.web_url, p.created_at, p.updated_at,
                   s.name as space_name
            FROM kms_page p
            LEFT JOIN kms_space s ON p.space_id = s.id
            WHERE p.id = ? AND p.is_active = 1
        `).bind(pageId).first();
        
        if (!page) {
            return jsonResponse({ error: 'Page not found' }, 404, request);
        }
        
        // Parse JSON fields
        const metadata = page.metadata_json ? JSON.parse(page.metadata_json) : {};
        const rawData = page.raw_json ? JSON.parse(page.raw_json) : {};
        
        return jsonResponse({
            page: {
                id: page.id,
                title: page.title,
                type: page.type,
                space_id: page.space_id,
                space_name: page.space_name,
                content_md: rawData.content_md || '',
                metadata,
                download_url: page.download_url,
                web_url: page.web_url,
                created_at: page.created_at,
                updated_at: page.updated_at
            }
        }, 200, request);
        
    } catch (error) {
        log.error('Error getting page', { error, pageId });
        return jsonResponse({ error: 'Failed to get page' }, 500, request);
    }
}
