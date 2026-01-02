-- Migration 001: Add mastery levels and admin overview views
-- Date: 2025-12-30
-- Description: GAP-602 (v_course_mastery) + GAP-604 (v_admin_overview)

-- ============================================
-- v_course_mastery: Mastery levels based on progress (GAP-602)
-- ============================================
-- Drop view if exists (for idempotency)
DROP VIEW IF EXISTS v_course_mastery;

CREATE VIEW v_course_mastery AS
SELECT 
  p.*,
  CASE 
    WHEN p.progress_percent >= 100 THEN 'master'
    WHEN p.progress_percent >= 75 THEN 'gold'
    WHEN p.progress_percent >= 50 THEN 'silver'
    WHEN p.progress_percent >= 25 THEN 'bronze'
    ELSE 'none'
  END as mastery_level
FROM v_course_progress p;

-- ============================================
-- v_admin_overview: Global statistics for admin dashboard (GAP-604)
-- ============================================
-- Drop view if exists (for idempotency)
DROP VIEW IF EXISTS v_admin_overview;

CREATE VIEW v_admin_overview AS
SELECT 
  (SELECT COUNT(DISTINCT user_id) FROM lms_event) as total_students,
  (SELECT COUNT(DISTINCT user_id) FROM lms_event 
   WHERE occurred_at > datetime('now', '-24 hours')) as active_24h,
  (SELECT COUNT(DISTINCT user_id) FROM lms_event 
   WHERE occurred_at > datetime('now', '-7 days')) as active_7d,
  (SELECT COUNT(*) FROM lms_signal WHERE type = 'COURSE_COMPLETED') as courses_completed,
  (SELECT COUNT(*) FROM lms_signal WHERE type = 'VIDEO_COMPLETED') as videos_completed,
  (SELECT COUNT(*) FROM lms_signal WHERE type = 'QUIZ_PASSED') as quizzes_passed,
  (SELECT AVG(json_extract(data_json, '$.score')) FROM lms_signal 
   WHERE type = 'QUIZ_PASSED') as avg_quiz_score;

