/**
 * Translations Handler
 * 
 * CRUD operations for content translations.
 * Supports AI-generated and manual translations.
 */

import { jsonResponse, errorResponse } from '../cors.js';

/**
 * Get all translations for a content item
 * GET /translations/:type/:id
 */
export async function getTranslations(request, env, ctx) {
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
        
        // Group by language
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
}

/**
 * Create or update a translation
 * PUT /translations/:type/:id/:lang
 * Body: { field: "name", value: "Translated text", source: "manual" }
 */
export async function upsertTranslation(request, env, ctx) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
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
    
    // Get user from context for reviewed_by
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
}

/**
 * Batch upsert translations (for AI translation engine)
 * POST /translations/batch
 * Body: { translations: [{ content_type, content_id, field, lang, value, source }] }
 */
export async function batchUpsertTranslations(request, env, ctx) {
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
}

/**
 * Get translations needing review
 * GET /translations/review?source=ai&limit=50
 */
export async function getTranslationsForReview(request, env, ctx) {
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
}

/**
 * Apply translations to content object
 * Helper function used by courses handler
 */
export function applyTranslations(content, translations, lang) {
    if (!translations || !translations[lang]) return content;
    
    const langTranslations = translations[lang];
    const result = { ...content };
    
    for (const [field, data] of Object.entries(langTranslations)) {
        if (data.value && result[field] !== undefined) {
            result[field] = data.value;
        }
    }
    
    return result;
}
