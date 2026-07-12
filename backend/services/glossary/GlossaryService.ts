/**
 * GlossaryService — DB access for glossary terms (CRUD + lookup map).
 */

import { upsertGlossaryTerm } from '../../handlers/glossary/_glossaryShared.js';
import type { Env } from "../../types/Env.js";

export const upsertTerm = (env: Env, orgId: string, payload) => upsertGlossaryTerm(env.DB, orgId, payload);

export const listTerms = (env: Env, orgId: string, filters = {}) => {
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

export const deleteTerm = (env: Env, orgId: string, termId: string) =>
    env.DB.prepare('DELETE FROM glossary WHERE id = ? AND org_id = ?')
        .bind(termId, orgId).run();

export const buildLookupMap = async (env: Env, orgId: string, sourceLang: string, targetLang: string) => {
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
