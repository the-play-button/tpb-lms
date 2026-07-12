/**
 * Shared helpers for glossary handlers.
 * SSOT for term-id derivation + DB upsert.
 */

export const REQUIRED_FIELDS = ['source_lang', 'target_lang', 'source_term', 'target_term'];

export const isValidTermPayload = (payload) =>
    payload &&
    REQUIRED_FIELDS.every((key) => typeof payload[key] === 'string' && payload[key].length > 0);

export const deriveTermId = (orgId: string, sourceLang: string, targetLang: string, sourceTerm) =>
    `${orgId}-${sourceLang}-${targetLang}-${sourceTerm.toLowerCase().replace(/\s+/g, '_')}`;

export const upsertGlossaryTerm = async (db: D1Database, orgId: string, payload) => {
    const { source_lang, target_lang, source_term, target_term, context } = payload;
    const id = deriveTermId(orgId, source_lang, target_lang, source_term);

    await db.prepare(`
        INSERT INTO glossary (id, org_id, source_lang, target_lang, source_term, target_term, context, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(org_id, source_lang, target_lang, source_term)
        DO UPDATE SET target_term = ?, context = ?, updated_at = datetime('now')
    `).bind(
        id, orgId, source_lang, target_lang, source_term, target_term,
        context || null, target_term, context || null,
    ).run();

    return id;
};

export const extractOrgIdFromUrl = (request: Request) => {
    const pathParts = new URL(request.url).pathname.split('/');
    return pathParts[2] || null;
};
