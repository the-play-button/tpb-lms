#!/usr/bin/env node
/**
 * LmsProgram (Plan 10) — a grouping level above lms_course.
 *
 * The unified.to LMS model stops at Course → (nested) Section → Lesson. A Skool
 * "classroom" (e.g. Maker School) is a PROGRAM that bundles N distinct courses, each
 * with its own cover/description/progress. This migration adds:
 *   - lms_program  (id, name, description, media_json cover, is_active, raw_json)
 *   - lms_course.program_id  (nullable FK → standalone courses keep program_id NULL)
 *   - idx_lms_course_program
 *
 * Idempotent: CREATE TABLE IF NOT EXISTS + ADD COLUMN guarded (SQLite has no
 * ADD COLUMN IF NOT EXISTS → the "duplicate column" error is swallowed on re-run).
 *
 * Usage (repo root):
 *   node db/migrations/010_lms_program.mjs --local
 *   node db/migrations/010_lms_program.mjs --remote
 */
import { execFileSync } from 'node:child_process';

const SCOPE = process.argv.includes('--remote') ? '--remote' : '--local';
const CONFIG = 'backend/wrangler.toml';
const DB = 'lms-db';

const sql = (command, { tolerateDuplicateColumn = false } = {}) => {
    try {
        execFileSync(
            'npx',
            ['wrangler', 'd1', 'execute', DB, SCOPE, '--config', CONFIG, '--json', '--command', command],
            { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
        );
    } catch (error) {
        const msg = String(error.stdout || '') + String(error.stderr || '') + String(error.message || '');
        if (tolerateDuplicateColumn && /duplicate column name/i.test(msg)) {
            console.log('  (program_id column already present — skip)');
            return;
        }
        throw error;
    }
};

const main = () => {
    console.log(`010_lms_program ${SCOPE}`);
    sql(`CREATE TABLE IF NOT EXISTS lms_program (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        media_json TEXT,
        is_active INTEGER DEFAULT 1,
        raw_json TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )`);
    sql(`ALTER TABLE lms_course ADD COLUMN program_id TEXT REFERENCES lms_program(id)`,
        { tolerateDuplicateColumn: true });
    sql(`CREATE INDEX IF NOT EXISTS idx_lms_course_program ON lms_course(program_id)`);
    console.log('  done.');
};

main();
