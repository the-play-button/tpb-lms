#!/usr/bin/env node
/**
 * Seed per-course progression mode (Plan 09).
 *
 * Sets pa06-2 (knowledge course — how to write SOMs) to `free` navigation so the
 * Skool-style mode is demonstrated. pw05-2 (WGE onboarding) is left untouched → it
 * keeps the default `linear` (forced sequential — the intended lock).
 *
 * Idempotent: json_set overwrites the single key in raw_json (COALESCE to '{}' when
 * absent) without touching other keys. Reversible:
 *   UPDATE lms_course SET raw_json = json_remove(raw_json, '$.tpb_progression_mode') WHERE id='pa06-2';
 *
 * Usage (repo root):
 *   node db/migrations/008_seed_progression_modes.mjs --local
 *   node db/migrations/008_seed_progression_modes.mjs --remote
 */
import { execFileSync } from 'node:child_process';

const SCOPE = process.argv.includes('--remote') ? '--remote' : '--local';
const CONFIG = 'backend/wrangler.toml';
const DB = 'lms-db';

const sql = (command) => {
    const out = execFileSync(
        'npx',
        ['wrangler', 'd1', 'execute', DB, SCOPE, '--config', CONFIG, '--json', '--command', command],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    const parsed = JSON.parse(out);
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    return first?.results || [];
};

// courseId -> progression mode. Only non-default (free) courses need a row; linear
// is the default so untouched courses stay linear.
const MODES = [
    { courseId: 'pa06-2', mode: 'free' },
];

const main = () => {
    for (const { courseId, mode } of MODES) {
        sql(
            "UPDATE lms_course SET raw_json = json_set(COALESCE(raw_json, '{}'), " +
            `'$.tpb_progression_mode', '${mode}'), updated_at = datetime('now') WHERE id = '${courseId}'`,
        );
        console.log(`[008-seed] set ${courseId} progression_mode = ${mode}`);
    }
};

main();
