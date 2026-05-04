-- Migration 004 — patched 2026-05-04 to be self-bootstrapping (Plan I follow-up)
--
-- Originally:
--   - ALTER TABLE lms_class RENAME COLUMN order_index TO sys_order_index
--   - DROP/CREATE INDEX idx_lms_class_order
--   - CREATE TABLE lms_enrollment + indexes
-- Bug: failed on fresh D1 because `lms_class` doesn't exist yet
-- (defined in schema.sql, never auto-applied by release_train).
-- Fix: CREATE TABLE IF NOT EXISTS lms_class with the FINAL shape (post-rename),
-- so the RENAME becomes redundant. The lms_enrollment + indexes are safe (already
-- IF NOT EXISTS).
--
-- Dev/staging: already in d1_migrations → wrangler skips, no effect.
-- Fresh DB: lms_class is created with sys_order_index from the start, no RENAME needed.

CREATE TABLE IF NOT EXISTS lms_class (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES lms_course(id),
    name TEXT NOT NULL,
    description TEXT,
    media_json TEXT,
    instructor_ids_json TEXT,
    student_ids_json TEXT,
    sys_order_index INTEGER DEFAULT 0,
    step_type TEXT DEFAULT 'VIDEO',
    content_md TEXT,
    languages_json TEXT,
    raw_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

DROP INDEX IF EXISTS idx_lms_class_order;
CREATE INDEX IF NOT EXISTS idx_lms_class_order ON lms_class(course_id, sys_order_index);

CREATE TABLE IF NOT EXISTS lms_enrollment (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    current_class_id TEXT,
    completed_classes_count INTEGER DEFAULT 0,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    abandoned_at TEXT,
    last_activity_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, course_id),
    FOREIGN KEY (course_id) REFERENCES lms_course(id)
);

CREATE INDEX IF NOT EXISTS idx_lms_enrollment_user ON lms_enrollment(user_id, status);
CREATE INDEX IF NOT EXISTS idx_lms_enrollment_course ON lms_enrollment(course_id);
CREATE INDEX IF NOT EXISTS idx_lms_enrollment_active ON lms_enrollment(status) WHERE status = 'active';
