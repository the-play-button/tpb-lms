-- Covering index for the keyset-cursor query in TranslationsService.ts
-- (cursor_query_without_covering_index). WHERE equality col as leading prefix + ORDER BY col next
-- → sort served from index, no USE TEMP B-TREE FOR ORDER BY full-scan (§ AGENTIC RISK). Pure perf,
-- idempotent + fresh-appliable.
--
-- NOTE: the 3 crm_event cursor hits (SessionService / LearnerProgressService) are NOT indexed here —
-- `crm_event` has no CREATE TABLE in tpb-lms/db/migrations (query references a table absent from the
-- repo schema). Adding an index on a non-existent table would break fresh-apply (§ MIGRATIONS). That
-- schema gap (crm_event source) is a separate investigation, not a covering-index slice.
CREATE INDEX IF NOT EXISTS idx_translations_cursor
  ON translations(source, created_at);
