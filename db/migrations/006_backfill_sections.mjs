#!/usr/bin/env node
/**
 * Backfill for migration 006 (nested sections).
 *
 * Promotes legacy `raw_json.tpb_section` soft-labels into real SECTION nodes and
 * re-parents the labelled LESSON rows under them. Idempotent: SECTION node ids
 * are deterministic (`sec_<courseId>_<slug>`), re-parenting only touches rows
 * still at the root, and the tpb_section label is stripped once promoted.
 *
 * Runs `wrangler d1 execute` under the hood (same transport as the numbered SQL
 * migrations). This is a DATA migration, kept out of the numbered .sql set
 * because it needs to read-then-compute per row.
 *
 * Usage:
 *   node db/migrations/006_backfill_sections.mjs --local     # local D1
 *   node db/migrations/006_backfill_sections.mjs --remote    # remote D1
 *
 * Must be run from the repo root (where backend/wrangler.toml is reachable).
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
    // wrangler --json prints an array of result envelopes; take the first.
    const parsed = JSON.parse(out);
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    return first?.results || [];
};

const esc = (s) => String(s).replace(/'/g, "''");
const slug = (s) =>
    String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'section';

const main = () => {
    // 1. Find all LESSON rows that still carry a tpb_section label.
    const rows = sql(
        "SELECT id, course_id, sys_order_index, raw_json FROM lms_class " +
        "WHERE node_kind = 'LESSON' AND parent_class_id IS NULL " +
        "AND raw_json IS NOT NULL AND raw_json LIKE '%\"tpb_section\"%'",
    );

    if (rows.length === 0) {
        console.log('[006-backfill] no legacy tpb_section labels found — nothing to do.');
        return;
    }

    // 2. Group by (course_id, section label). Preserve first-seen order for the
    //    section's own sys_order_index.
    const sections = new Map(); // key `${courseId}::${label}` -> { courseId, label, order, lessonIds:[] }
    let seen = 0;
    for (const r of rows) {
        let label;
        try { label = JSON.parse(r.raw_json)?.tpb_section; } catch { label = null; }
        if (!label) continue;
        const key = `${r.course_id}::${label}`;
        if (!sections.has(key)) {
            sections.set(key, { courseId: r.course_id, label, order: seen++, lessonIds: [] });
        }
        sections.get(key).lessonIds.push(r.id);
    }

    // 3. Per section: create the SECTION node (idempotent), re-parent lessons,
    //    strip the tpb_section label.
    let created = 0;
    let reparented = 0;
    for (const { courseId, label, order, lessonIds } of sections.values()) {
        const secId = `sec_${courseId}_${slug(label)}`;
        sql(
            "INSERT OR IGNORE INTO lms_class (id, course_id, name, node_kind, parent_class_id, sys_order_index) " +
            `VALUES ('${esc(secId)}', '${esc(courseId)}', '${esc(label)}', 'SECTION', NULL, ${order})`,
        );
        created += 1;
        const idList = lessonIds.map((id) => `'${esc(id)}'`).join(',');
        sql(
            `UPDATE lms_class SET parent_class_id = '${esc(secId)}' ` +
            `WHERE id IN (${idList}) AND parent_class_id IS NULL`,
        );
        // Strip tpb_section from raw_json (json_remove) once promoted.
        sql(
            "UPDATE lms_class SET raw_json = json_remove(raw_json, '$.tpb_section') " +
            `WHERE id IN (${idList}) AND raw_json IS NOT NULL`,
        );
        reparented += lessonIds.length;
    }

    console.log(
        `[006-backfill] promoted ${created} SECTION node(s), re-parented ${reparented} lesson(s).`,
    );
};

main();
