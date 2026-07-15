/**
 * GlossaryService — DB access for glossary terms (CRUD + lookup map).
 */

import { upsertGlossaryTerm } from '../../handlers/glossary/_glossaryShared.js';
import type { Env } from "../../types/Env.js";
import type { GlossaryTermPayload } from '../../handlers/glossary/_glossaryShared.js';

interface GlossaryFilters { sourceLang?: string | null; targetLang?: string | null; }
interface GlossaryRow { source_term?: string; target_term?: string; [key: string]: unknown; }

export const upsertTerm = (env: Env, orgId: string, payload: GlossaryTermPayload): Promise<string>  => upsertGlossaryTerm(env.DB, orgId, payload);

export const listTerms = (env: Env, orgId: string, filters: GlossaryFilters = {}): Promise<D1Result<Record<string, unknown>>>  => {
    let query = `
        SELECT id, source_lang, target_lang, source_term, target_term, context, created_at
        FROM glossary
        WHERE org_id = ?
    `;
    const params: string[] = [orgId];
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

export const deleteTerm = (env: Env, orgId: string, termId: string): Promise<D1Result<Record<string, unknown>>>  =>
    env.DB.prepare('DELETE FROM glossary WHERE id = ? AND org_id = ?')
        .bind(termId, orgId).run();

export const buildLookupMap = async (env: Env, orgId: string, sourceLang: string, targetLang: string): Promise<Map<string, string | undefined>>  => {
    const result = await env.DB.prepare(`
        SELECT source_term, target_term
        FROM glossary
        WHERE org_id = ? AND source_lang = ? AND target_lang = ?
    `).bind(orgId, sourceLang, targetLang).all<GlossaryRow>();

    const map = new Map<string, string | undefined>();
    for (const row of result.results) {
        if (row.source_term) map.set(row.source_term.toLowerCase(), row.target_term);
    }
    return map;
};
