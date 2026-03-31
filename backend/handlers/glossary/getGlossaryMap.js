// entropy-handler-service-pattern-ok: simple handler, business logic is minimal
/**
 * Get glossary as lookup map (for translation engine)
 * Internal helper function
 */

export const getGlossaryMap = async (env, orgId, sourceLang, targetLang) => {
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
};
