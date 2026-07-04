#!/usr/bin/env node
/**
 * Seed for migration 006 (nested sections) — demonstrates the SECTION → LESSON
 * tree on a real course (pa06-2, « Comment Rédiger des SOMs Numériques Complets »).
 *
 * Groups the 15 flat lessons into 3 SECTION folders so the nested-sections
 * sidebar (renderStepsSidebar / renderNodesTree) has real data to render. The
 * DFS-flatten order (backend CoursesService) is preserved because sibling order
 * is kept via sys_order_index (sections ordered 1..3, lessons keep 1..15 within
 * their section).
 *
 * Idempotent: SECTION ids are deterministic (`sec_pa06-2_<slug>`), INSERT OR
 * IGNORE, and re-parenting is a targeted UPDATE per lesson id (course + kind
 * guarded). Re-runnable safely.
 *
 * Reversible:
 *   UPDATE lms_class SET parent_class_id=NULL WHERE course_id='pa06-2' AND node_kind='LESSON';
 *   DELETE FROM lms_class WHERE id IN ('sec_pa06-2_preparation','sec_pa06-2_redaction','sec_pa06-2_validation');
 *
 * Content untouched — only grouping changes.
 *
 * Usage (from repo root, where backend/wrangler.toml is reachable):
 *   node db/migrations/007_seed_pa06_sections.mjs --local
 *   node db/migrations/007_seed_pa06_sections.mjs --remote
 */
import { execFileSync } from 'node:child_process';

const SCOPE = process.argv.includes('--remote') ? '--remote' : '--local';
const CONFIG = 'backend/wrangler.toml';
const DB = 'lms-db';
const COURSE_ID = 'pa06-2';

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

const esc = (s) => String(s).replace(/'/g, "''");

// SECTION folders + the lesson ids they own (ordered). sys_order_index on the
// SECTION rows orders the folders; lessons keep their existing sys_order_index.
const SECTIONS = [
    {
        id: `sec_${COURSE_ID}_preparation`,
        name: '1. Préparation & Structure',
        order: 1,
        lessons: ['step01-preparation', 'step02-create-structure', 'step03-fill-metadata'],
    },
    {
        id: `sec_${COURSE_ID}_redaction`,
        name: '2. Rédaction du contenu',
        order: 2,
        lessons: [
            'step04-write-why', 'step05-clarify-what', 'step06-define-who-when',
            'step07-write-how', 'step08-1-video', 'step08-2-drawings', 'step08-3-references',
        ],
    },
    {
        id: `sec_${COURSE_ID}_validation`,
        name: '3. Validation & Publication',
        order: 3,
        lessons: [
            'step09-validation-quizzes', 'step10-notes-references',
            'step11-review-publish', 'step12-convert-distribute', 'step13-pruning-archiving',
        ],
    },
];

const main = () => {
    // Guard: the course must exist and still be flat (no SECTION rows yet).
    const existing = sql(
        `SELECT id FROM lms_class WHERE course_id='${COURSE_ID}' AND node_kind='SECTION'`,
    );
    const lessons = sql(
        `SELECT id FROM lms_class WHERE course_id='${COURSE_ID}' AND node_kind='LESSON'`,
    );
    if (lessons.length === 0) {
        console.log(`[007-seed] course ${COURSE_ID} has no lessons — nothing to do.`);
        return;
    }
    console.log(`[007-seed] ${lessons.length} lesson(s), ${existing.length} existing SECTION(s).`);

    let created = 0;
    let reparented = 0;
    for (const { id, name, order, lessons: lessonIds } of SECTIONS) {
        sql(
            'INSERT OR IGNORE INTO lms_class (id, course_id, name, node_kind, parent_class_id, sys_order_index) ' +
            `VALUES ('${esc(id)}', '${esc(COURSE_ID)}', '${esc(name)}', 'SECTION', NULL, ${order})`,
        );
        created += 1;
        const idList = lessonIds.map((lid) => `'${esc(lid)}'`).join(',');
        sql(
            `UPDATE lms_class SET parent_class_id='${esc(id)}' ` +
            `WHERE id IN (${idList}) AND course_id='${esc(COURSE_ID)}' AND node_kind='LESSON'`,
        );
        reparented += lessonIds.length;
    }

    console.log(`[007-seed] ensured ${created} SECTION node(s), re-parented ${reparented} lesson(s) under pa06-2.`);
};

main();
