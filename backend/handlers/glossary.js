/**
 * Glossary Handler
 * 
 * Business terminology dictionary per organization.
 * Used by translation engine to ensure consistent terminology.
 */

import { jsonResponse, errorResponse } from '../cors.js';

/**
 * Get glossary for an organization
 * GET /glossary/:orgId?source_lang=fr&target_lang=en
 */
export async function getGlossary(request, env, ctx) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const orgId = pathParts[2];
    
    if (!orgId) {
        return errorResponse('Missing org_id', 400);
    }
    
    const sourceLang = url.searchParams.get('source_lang');
    const targetLang = url.searchParams.get('target_lang');
    
    let query = `
        SELECT id, source_lang, target_lang, source_term, target_term, context, created_at
        FROM glossary
        WHERE org_id = ?
    `;
    const params = [orgId];
    
    if (sourceLang) {
        query += ' AND source_lang = ?';
        params.push(sourceLang);
    }
    if (targetLang) {
        query += ' AND target_lang = ?';
        params.push(targetLang);
    }
    
    query += ' ORDER BY source_term';
    
    try {
        const result = await env.DB.prepare(query).bind(...params).all();
        
        return jsonResponse({
            org_id: orgId,
            terms: result.results,
            total: result.results.length
        });
    } catch (error) {
        console.error('Error fetching glossary:', error);
        return errorResponse('Failed to fetch glossary', 500);
    }
}

/**
 * Add a term to the glossary
 * POST /glossary/:orgId
 * Body: { source_lang, target_lang, source_term, target_term, context? }
 */
export async function addGlossaryTerm(request, env, ctx) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const orgId = pathParts[2];
    
    if (!orgId) {
        return errorResponse('Missing org_id', 400);
    }
    
    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse('Invalid JSON body', 400);
    }
    
    const { source_lang, target_lang, source_term, target_term, context } = body;
    
    if (!source_lang || !target_lang || !source_term || !target_term) {
        return errorResponse('Missing required fields: source_lang, target_lang, source_term, target_term', 400);
    }
    
    const id = `${orgId}-${source_lang}-${target_lang}-${source_term.toLowerCase().replace(/\s+/g, '_')}`;
    
    try {
        await env.DB.prepare(`
            INSERT INTO glossary (id, org_id, source_lang, target_lang, source_term, target_term, context, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(org_id, source_lang, target_lang, source_term) 
            DO UPDATE SET target_term = ?, context = ?, updated_at = datetime('now')
        `).bind(id, orgId, source_lang, target_lang, source_term, target_term, context || null, target_term, context || null).run();
        
        return jsonResponse({
            success: true,
            id,
            org_id: orgId,
            source_lang,
            target_lang,
            source_term,
            target_term,
            context
        });
    } catch (error) {
        console.error('Error adding glossary term:', error);
        return errorResponse('Failed to add glossary term', 500);
    }
}

/**
 * Delete a glossary term
 * DELETE /glossary/:orgId/:termId
 */
export async function deleteGlossaryTerm(request, env, ctx) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const orgId = pathParts[2];
    const termId = pathParts[3];
    
    if (!orgId || !termId) {
        return errorResponse('Missing org_id or term_id', 400);
    }
    
    try {
        const result = await env.DB.prepare(`
            DELETE FROM glossary WHERE id = ? AND org_id = ?
        `).bind(termId, orgId).run();
        
        if (result.meta.changes === 0) {
            return errorResponse('Term not found', 404);
        }
        
        return jsonResponse({ success: true, deleted: termId });
    } catch (error) {
        console.error('Error deleting glossary term:', error);
        return errorResponse('Failed to delete glossary term', 500);
    }
}

/**
 * Batch import glossary terms
 * POST /glossary/:orgId/import
 * Body: { terms: [{ source_lang, target_lang, source_term, target_term, context? }] }
 */
export async function importGlossaryTerms(request, env, ctx) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const orgId = pathParts[2];
    
    if (!orgId) {
        return errorResponse('Missing org_id', 400);
    }
    
    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse('Invalid JSON body', 400);
    }
    
    const { terms } = body;
    if (!Array.isArray(terms) || terms.length === 0) {
        return errorResponse('terms must be a non-empty array', 400);
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const term of terms) {
        const { source_lang, target_lang, source_term, target_term, context } = term;
        if (!source_lang || !target_lang || !source_term || !target_term) {
            errorCount++;
            continue;
        }
        
        const id = `${orgId}-${source_lang}-${target_lang}-${source_term.toLowerCase().replace(/\s+/g, '_')}`;
        
        try {
            await env.DB.prepare(`
                INSERT INTO glossary (id, org_id, source_lang, target_lang, source_term, target_term, context, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(org_id, source_lang, target_lang, source_term) 
                DO UPDATE SET target_term = ?, context = ?, updated_at = datetime('now')
            `).bind(id, orgId, source_lang, target_lang, source_term, target_term, context || null, target_term, context || null).run();
            successCount++;
        } catch (error) {
            console.error(`Error importing term ${source_term}:`, error);
            errorCount++;
        }
    }
    
    return jsonResponse({
        success: true,
        imported: successCount,
        errors: errorCount
    });
}

/**
 * Get glossary as lookup map (for translation engine)
 * Internal helper function
 */
export async function getGlossaryMap(env, orgId, sourceLang, targetLang) {
    try {
        const result = await env.DB.prepare(`
            SELECT source_term, target_term
            FROM glossary
            WHERE org_id = ? AND source_lang = ? AND target_lang = ?
        `).bind(orgId, sourceLang, targetLang).all();
        
        const map = new Map();
        for (const row of result.results) {
            map.set(row.source_term.toLowerCase(), row.target_term);
        }
        return map;
    } catch (error) {
        console.error('Error building glossary map:', error);
        return new Map();
    }
}
