/**
 * Per-course progression mode (stored in lms_course.raw_json.tpb_progression_mode).
 *
 * - `linear` (default) : hyper-linear onboarding. Steps unlock one-by-one, no skip,
 *   no back, complete-to-proceed.
 * - `free` : Skool-style. Every lesson reachable, jump anywhere, back allowed, no
 *   complete-to-proceed gate.
 */

export const PROGRESSION_MODES = ['linear', 'free'];
export const DEFAULT_PROGRESSION_MODE = 'linear';

/**
 * Resolve a course's progression mode from its raw_json. Unknown / absent → linear.
 * An explicit-but-invalid value is surfaced (§ WARNINGS = SIGNAL), never silently
 * masked, but does not throw — a config typo must not 500 the course.
 * @param {string|object|null|undefined} rawJson - lms_course.raw_json (string or parsed).
 * @returns {'linear'|'free'}
 */
export const resolveProgressionMode = (rawJson) => {
    if (!rawJson) return DEFAULT_PROGRESSION_MODE;

    let parsed;
    try {
        parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    } catch {
        return DEFAULT_PROGRESSION_MODE;
    }

    const mode = parsed?.tpb_progression_mode;
    if (mode == null) return DEFAULT_PROGRESSION_MODE;
    if (PROGRESSION_MODES.includes(mode)) return mode;

    console.warn('Invalid tpb_progression_mode, defaulting to linear', { mode });
    return DEFAULT_PROGRESSION_MODE;
};
