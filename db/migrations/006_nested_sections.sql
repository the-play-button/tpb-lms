-- ============================================
-- Migration 006: Nested sections (adjacency-list tree on lms_class)
-- ============================================
-- Promotes lms_class from a flat 2-level model (course -> class) + soft-label
-- raw_json.tpb_section into an arbitrary-depth adjacency-list tree, matching the
-- pattern ALREADY used by kms_space.parent_space_id, kms_page.parent_page_id,
-- and hris_group.parent_id in this same schema.
--
--   parent_class_id : self-FK. NULL = top-level node directly under the course.
--   node_kind       : 'SECTION' (grouping folder, no media) | 'LESSON' (leaf w/ media).
--
-- Existing rows become flat LESSON leaves (parent NULL) = a valid tree, so this
-- migration is a zero-regression widening. The companion backfill
-- (006_backfill_sections.mjs) then promotes any raw_json.tpb_section labels into
-- real SECTION nodes and re-parents the leaves under them.
--
-- Note: the 2 columns live in this migration (not in schema.sql's CREATE TABLE)
-- because SQLite has no `ADD COLUMN IF NOT EXISTS`; the repo already treats
-- migrations as the evolution layer (cf. migration 005 lms_content_ref, absent
-- from schema.sql). schema.sql documents the tree shape in a comment block.

ALTER TABLE lms_class ADD COLUMN parent_class_id TEXT REFERENCES lms_class(id);
ALTER TABLE lms_class ADD COLUMN node_kind TEXT NOT NULL DEFAULT 'LESSON';  -- SECTION | LESSON

CREATE INDEX IF NOT EXISTS idx_lms_class_parent
    ON lms_class(parent_class_id, sys_order_index);
