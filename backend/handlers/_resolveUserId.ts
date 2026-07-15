import type { HandlerUserContext } from "../types/HandlerContext.js";

/**
 * Shared SSOT helper for extracting the LMS user id from a CF Access userContext.
 *
 * Lives under `handlers/` to be consumed by multiple thin transport-layer
 * handlers without re-introducing duplicate local definitions
 * (entropy `function_duplication_name`).
 */

export const resolveUserId = (userContext: HandlerUserContext): string | null  =>
    userContext?.contact?.id || userContext?.employee?.id || null;
