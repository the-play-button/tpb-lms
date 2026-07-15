/**
 * Get glossary as lookup map (for translation engine)
 * Internal helper function — handler-style export retained for callers.
 */

import { buildLookupMap } from '../../services/glossary/GlossaryService.js';
import type { Env } from "../../types/Env.js";

export const getGlossaryMap = (env: Env, orgId: string, sourceLang: string, targetLang: string): Promise<Map<string, string | undefined>>  =>
    buildLookupMap(env, orgId, sourceLang, targetLang);
