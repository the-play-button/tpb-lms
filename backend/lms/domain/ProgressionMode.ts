/**
 * ProgressionMode — per-course navigation policy. `linear` = hyper-linear onboarding
 * (steps unlock one-by-one) ; `free` = Skool-style free navigation. SSOT for the
 * authoring input schemas. Stored in lms_course.raw_json.tpb_progression_mode and
 * read at runtime by services/courses/_progressionMode.js.
 */
export const PROGRESSION_MODES = ['linear', 'free'] as const;
export type ProgressionMode = (typeof PROGRESSION_MODES)[number];
