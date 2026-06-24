/**
 * GlossaryService — DB access for glossary terms (CRUD + lookup map).
 */

import { upsertGlossaryTerm } from '../../handlers/glossary/_glossaryShared.js';

export const upsertTerm = (env, orgId, payload) => upsertGlossaryTerm(env.DB, orgId, payload);

export const listTerms = (env, orgId, filters = {}) => {
    let query = `
        SELECT id, source_lang, target_lang, source_term, target_term, context, created_at
        FROM glossary
        WHERE org_id = ?
    `;
    const params = [orgId];
    if (filters.sourceLang) {
        query += ' AND source_lang = ?';
        params.push(filters.sourceLang);
    }
    if (filters.targetLang) {
        query += ' AND target_lang = ?';
        params.push(filters.targetLang);
    }
    query += ' ORDER BY source_term';
    return env.DB.prepare(query).bind(...params).all();
};

export const deleteTerm = (env, orgId, termId) =>
    env.DB.prepare('DELETE FROM glossary WHERE id = ? AND org_id = ?')
        .bind(termId, orgId).run();

export const buildLookupMap = async (env, orgId, sourceLang, targetLang) => {
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
};
