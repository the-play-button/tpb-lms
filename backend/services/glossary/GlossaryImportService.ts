/**
 * GlossaryImportService — bulk import iteration kept out of the handler.
 */

import { log } from '@the-play-button/tpb-sdk-js';
import { upsertTerm } from './GlossaryService.js';
import { isValidTermPayload } from '../../handlers/glossary/_glossaryShared.js';
import type { Env } from "../../types/Env.js";

export const bulkImportTerms = async (env: Env, orgId: string, terms) => {
    let successCount = 0;
    let errorCount = 0;

    for (const term of terms) {
        if (!isValidTermPayload(term)) {
            errorCount += 1;
            continue;
        }
        try {
            await upsertTerm(env, orgId, term);
            successCount += 1;
        } catch (error) {
            log.error('glossary term import failed', error, { sourceTerm: term.source_term });
            errorCount += 1;
        }
    }

    return { successCount, errorCount };
};
