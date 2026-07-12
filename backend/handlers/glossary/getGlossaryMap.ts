/**
 * Get glossary as lookup map (for translation engine)
 * Internal helper function — handler-style export retained for callers.
 */

import { buildLookupMap } from '../../services/glossary/GlossaryService.js';

export const getGlossaryMap = (env, orgId, sourceLang, targetLang) =>
    buildLookupMap(env, orgId, sourceLang, targetLang);
