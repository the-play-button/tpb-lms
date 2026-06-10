/**
 * Get glossary as lookup map (for translation engine)
 * Internal helper function
 */

export const getGlossaryMap = async (env, orgId, sourceLang, targetLang) => {
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
