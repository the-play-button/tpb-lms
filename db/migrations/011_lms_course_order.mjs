#!/usr/bin/env node
/**
 * lms_course.sys_order_index (Plan 12) — explicit course ordering.
 *
 * The unified.to model + our schema gave lms_class a sys_order_index but not lms_course,
 * so the classroom sorted courses ORDER BY name ASC (alphabetical) — losing the Skool
 * classroom order (bonuses at the end). This adds the ordinal column + index; the API
 * sorts on it and the importer sets it from the course_trees.json position.
 *
 * Idempotent: ADD COLUMN guarded (SQLite has no ADD COLUMN IF NOT EXISTS).
 *
 * Usage (repo root):
 *   node db/migrations/011_lms_course_order.mjs --local
 *   node db/migrations/011_lms_course_order.mjs --remote
 */
import { execFileSync } from 'node:child_process';

const SCOPE = process.argv.includes('--remote') ? '--remote' : '--local';
const CONFIG = 'backend/wrangler.toml';
const DB = 'lms-db';

const sql = (command, { tolerateDuplicateColumn = false } = {}) => {
    try {
        execFileSync('npx', ['wrangler', 'd1', 'execute', DB, SCOPE, '--config', CONFIG, '--json', '--command', command],
            { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    } catch (error) {
        const msg = String(error.stdout || '') + String(error.stderr || '') + String(error.message || '');
        if (tolerateDuplicateColumn && /duplicate column name/i.test(msg)) {
            console.log('  (sys_order_index column already present — skip)');
            return;
        }
        throw error;
    }
};

const main = () => {
    console.log(`011_lms_course_order ${SCOPE}`);
    sql('ALTER TABLE lms_course ADD COLUMN sys_order_index INTEGER DEFAULT 0', { tolerateDuplicateColumn: true });
    sql('CREATE INDEX IF NOT EXISTS idx_lms_course_order ON lms_course(sys_order_index)');
    console.log('  done.');
};

main();
