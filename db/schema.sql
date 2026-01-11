-- ============================================
-- TPB LMS D1 Schema - Unified.to Aligned
-- ============================================
-- Architecture:
-- - Tables alignées sur Unified.to (CRM, KMS, LMS, HRIS, REPOSITORY)
-- - Extension gamification (2 tables: badge, award)
-- - Extension event-sourcing (2 tables: lms_event, lms_signal)
-- - Extension enrollment (1 table: lms_enrollment)
-- - Vues monitoring (observabilité uniquement)
--
-- Unified.to Conformity (v2.0):
-- - Colonnes sans préfixe = exactement unified.to
-- - sys_* = colonnes techniques internes (ex: sys_order_index)
-- - v_* = vues/tables dérivées (recalculables)
-- - raw_json.tpb_* = extensions TPB documentées
--
-- Content Architecture:
-- - Contenu servi depuis GitHub (domaine REPOSITORY)
-- - media[].url pointe vers raw.githubusercontent.com
-- - raw_json.tpb_intro_url = URL du SOM index
-- ============================================

-- ============================================
-- UNIFIED.TO: CRM (Contacts & Events)
-- ============================================

-- CrmContact (learners externes)
CREATE TABLE IF NOT EXISTS crm_contact (
    id TEXT PRIMARY KEY,
    name TEXT,
    first_name TEXT,
    last_name TEXT,
    emails_json TEXT,          -- [{"email":"x@y.com","type":"WORK"}]
    company_ids_json TEXT,
    deal_ids_json TEXT,
    address_json TEXT,
    telephones_json TEXT,
    user_id TEXT,
    raw_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_crm_contact_email ON crm_contact(id);

-- CrmEvent (tracking: page views, video, forms, etc.)
CREATE TABLE IF NOT EXISTS crm_event (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,        -- PAGE_VIEW, VIDEO_VIEW, FORM, NOTE, EMAIL, CALL, MEETING, BADGE_EARNED
    contact_ids_json TEXT,     -- ["contact_123"]
    company_ids_json TEXT,
    deal_ids_json TEXT,
    lead_ids_json TEXT,
    user_id TEXT,
    
    -- Type-specific data (comme Unified.to)
    page_view_json TEXT,       -- {"url":"...", "count":1, "completion":95}
    form_json TEXT,            -- {"name":"Quiz", "fields":[...], "score":80, "passed":true}
    call_json TEXT,
    email_json TEXT,
    meeting_json TEXT,
    note_json TEXT,
    task_json TEXT,
    marketing_email_json TEXT,
    
    raw_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_crm_event_user ON crm_event(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_event_type ON crm_event(type);
CREATE INDEX IF NOT EXISTS idx_crm_event_created ON crm_event(created_at DESC);

-- ============================================
-- UNIFIED.TO: KMS (Knowledge Management)
-- ============================================

-- KmsSpace (content spaces/folders)
CREATE TABLE IF NOT EXISTS kms_space (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    parent_space_id TEXT,
    is_active INTEGER DEFAULT 1,
    user_id TEXT,
    raw_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_kms_space_parent ON kms_space(parent_space_id);

-- KmsPage (Markdown content pages)
CREATE TABLE IF NOT EXISTS kms_page (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'MARKDOWN',  -- MARKDOWN, HTML, TEXT
    space_id TEXT REFERENCES kms_space(id),
    parent_page_id TEXT,
    download_url TEXT,
    has_children INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    metadata_json TEXT,        -- [{"key":"...", "value":"...", "format":"..."}]
    user_id TEXT,
    web_url TEXT,
    raw_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_kms_page_space ON kms_page(space_id);
CREATE INDEX IF NOT EXISTS idx_kms_page_parent ON kms_page(parent_page_id);

-- ============================================
-- UNIFIED.TO: LMS (Learning Management)
-- ============================================

-- LmsCourse (courses)
CREATE TABLE IF NOT EXISTS lms_course (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    categories_json TEXT,      -- ["onboarding", "sales"]
    media_json TEXT,           -- [{"url":"...", "type":"VIDEO", "name":"..."}]
    instructor_ids_json TEXT,
    student_ids_json TEXT,
    currency TEXT,
    price_amount REAL,
    is_active INTEGER DEFAULT 1,
    is_private INTEGER DEFAULT 0,
    languages_json TEXT,
    raw_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- LmsClass (lessons/modules/steps within courses)
-- Unified.to conformity: uses sys_order_index, raw_json for extensions
CREATE TABLE IF NOT EXISTS lms_class (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES lms_course(id),
    name TEXT NOT NULL,
    description TEXT,
    
    -- Unified.to: media array with url, type, name
    -- Types: VIDEO (url=iframe), DOCUMENT (url=raw github), WEB (url=tally)
    media_json TEXT,           -- [{"url":"...", "type":"VIDEO|DOCUMENT|WEB", "name":"..."}]
    
    instructor_ids_json TEXT,
    student_ids_json TEXT,
    
    -- Technical column (not in unified.to, hence sys_ prefix)
    sys_order_index INTEGER DEFAULT 0,
    
    -- DEPRECATED: Use raw_json.tpb_step_type instead
    step_type TEXT DEFAULT 'VIDEO',  -- VIDEO, QUIZ, CONTENT, MIXED
    
    -- DEPRECATED: Use media[].url of type DOCUMENT instead
    content_md TEXT,           -- Markdown content for step (legacy)
    
    languages_json TEXT,
    
    -- Extensions TPB in raw_json:
    -- - tpb_step_type: VIDEO | QUIZ | CONTENT | MIXED
    -- - tpb_section: Optional section grouping
    -- - tpb_content_md: Legacy inline markdown (deprecated)
    raw_json TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lms_class_course ON lms_class(course_id);
CREATE INDEX IF NOT EXISTS idx_lms_class_order ON lms_class(course_id, sys_order_index);

-- ============================================
-- EXTENSION: LMS ENROLLMENT (TPB)
-- ============================================
-- Tracks user enrollments with limit enforcement (max 3 active)

CREATE TABLE IF NOT EXISTS lms_enrollment (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    
    -- Status: active (learning), completed (finished), abandoned (dropped)
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    
    -- Progress tracking
    current_class_id TEXT,
    completed_classes_count INTEGER DEFAULT 0,
    
    -- Timestamps
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

-- ============================================
-- UNIFIED.TO: HRIS (HR/Employees)
-- ============================================

-- HrisEmployee (internal users)
CREATE TABLE IF NOT EXISTS hris_employee (
    id TEXT PRIMARY KEY,
    name TEXT,
    first_name TEXT,
    last_name TEXT,
    emails_json TEXT,
    title TEXT,
    department TEXT,
    division TEXT,
    manager_id TEXT,
    company_id TEXT,
    groups_json TEXT,
    employee_roles_json TEXT,
    employment_status TEXT,    -- ACTIVE, INACTIVE
    employment_type TEXT,      -- FULL_TIME, PART_TIME, etc.
    image_url TEXT,
    metadata_json TEXT,
    raw_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    hired_at TEXT,
    terminated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_hris_employee_email ON hris_employee(id);
CREATE INDEX IF NOT EXISTS idx_hris_employee_department ON hris_employee(department);

-- HrisGroup (teams/departments)
CREATE TABLE IF NOT EXISTS hris_group (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,                 -- TEAM, DEPARTMENT, DIVISION, etc.
    description TEXT,
    company_id TEXT,
    parent_id TEXT,
    manager_ids_json TEXT,
    user_ids_json TEXT,
    is_active INTEGER DEFAULT 1,
    raw_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hris_group_type ON hris_group(type);
CREATE INDEX IF NOT EXISTS idx_hris_group_parent ON hris_group(parent_id);

-- ============================================
-- EXTENSION: API KEYS
-- ============================================

-- API Key for programmatic access (scripts, integrations)
CREATE TABLE IF NOT EXISTS api_key (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                -- "Zapier Integration", "CI/CD Pipeline"
    key_hash TEXT NOT NULL UNIQUE,     -- SHA256 hash (never store key in clear)
    key_prefix TEXT NOT NULL,          -- "tpb_" + 8 chars (for identification)
    user_id TEXT,                      -- Owner (optional, ref: crm_contact.id)
    scopes TEXT DEFAULT '*',           -- Permissions (for Phase 2 OAuth: "read:courses,write:events")
    created_at TEXT DEFAULT (datetime('now')),
    last_used_at TEXT,
    expires_at TEXT,                   -- Optional expiration
    is_active INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_api_key_hash ON api_key(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_key_user ON api_key(user_id);
CREATE INDEX IF NOT EXISTS idx_api_key_active ON api_key(is_active);

-- ============================================
-- EXTENSION: GAMIFICATION (2 tables only)
-- ============================================

-- GamificationBadge (entity - badge definitions)
CREATE TABLE IF NOT EXISTS gamification_badge (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    type TEXT NOT NULL CHECK (type IN ('COMPLETION', 'STREAK', 'POINTS', 'ACHIEVEMENT', 'SKILL')),
    category TEXT,
    rarity TEXT DEFAULT 'COMMON' CHECK (rarity IN ('COMMON', 'RARE', 'EPIC', 'LEGENDARY')),
    points_reward INTEGER DEFAULT 0,
    criteria_json TEXT,        -- {"type":"video_count", "threshold":10}
    is_active INTEGER DEFAULT 1,
    metadata_json TEXT,
    raw_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- GamificationAward (fact - badge earned)
CREATE TABLE IF NOT EXISTS gamification_award (
    id TEXT PRIMARY KEY,
    badge_id TEXT NOT NULL REFERENCES gamification_badge(id),
    user_id TEXT NOT NULL,     -- Ref: crm_contact.id or hris_employee.id
    user_type TEXT DEFAULT 'contact',  -- 'contact' or 'employee'
    course_id TEXT,            -- Context
    class_id TEXT,
    awarded_at TEXT DEFAULT (datetime('now')),
    context_json TEXT,
    raw_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(badge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gamification_award_user ON gamification_award(user_id);
CREATE INDEX IF NOT EXISTS idx_gamification_award_badge ON gamification_award(badge_id);

-- ============================================
-- EXTENSION: LMS EVENT SOURCING
-- ============================================

-- LmsEvent (facts - immutable event store)
CREATE TABLE IF NOT EXISTS lms_event (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,            -- VIDEO_PING, QUIZ_SUBMIT
    user_id TEXT NOT NULL,
    course_id TEXT,
    class_id TEXT,
    occurred_at TEXT NOT NULL,     -- ISO8601 timestamp (client time)
    payload_json TEXT NOT NULL,    -- Type-specific data
    context_json TEXT,             -- {session_id, ip, user_agent}
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lms_event_user_class ON lms_event(user_id, class_id, type);
CREATE INDEX IF NOT EXISTS idx_lms_event_occurred ON lms_event(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_lms_event_course ON lms_event(course_id, user_id);

-- LmsSignal (derived instructions from projections)
CREATE TABLE IF NOT EXISTS lms_signal (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,            -- VIDEO_COMPLETED, QUIZ_PASSED, STEP_COMPLETED, COURSE_COMPLETED
    user_id TEXT NOT NULL,
    course_id TEXT,
    class_id TEXT,
    source_event_ids TEXT,         -- ["evt_1", "evt_2"] - traceability
    data_json TEXT,                -- Derived data (e.g., coverage_pct, score)
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(type, user_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_lms_signal_user ON lms_signal(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_lms_signal_type ON lms_signal(type);

-- ============================================
-- MATERIALIZED VIEW: User Progress (v_*)
-- Projection table - calculated from events
-- Prefix v_ = not SSOT, rebuildable
-- ============================================

CREATE TABLE IF NOT EXISTS v_user_progress (
    user_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    
    -- Video progress
    video_max_position_sec INTEGER DEFAULT 0,
    video_duration_sec INTEGER DEFAULT 0,
    video_completed INTEGER DEFAULT 0,  -- bool: 1 if max_position >= 90% duration
    video_completed_at TEXT,
    
    -- Quiz progress  
    quiz_passed INTEGER DEFAULT 0,      -- bool
    quiz_score INTEGER DEFAULT 0,
    quiz_max_score INTEGER DEFAULT 0,
    quiz_passed_at TEXT,
    
    -- Timestamps
    updated_at TEXT DEFAULT (datetime('now')),
    
    PRIMARY KEY (user_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_v_user_progress_course ON v_user_progress(user_id, course_id);

-- ============================================
-- VIEWS: Monitoring & Observability
-- ============================================

-- v_event_daily_stats: Daily event counts (monitoring)
CREATE VIEW IF NOT EXISTS v_event_daily_stats AS
SELECT 
    date(occurred_at) as date,
    type,
    COUNT(*) as count
FROM lms_event
GROUP BY date(occurred_at), type;

-- v_signal_summary: Signal counts per user (dashboard)
CREATE VIEW IF NOT EXISTS v_signal_summary AS
SELECT 
    user_id,
    SUM(CASE WHEN type = 'VIDEO_COMPLETED' THEN 1 ELSE 0 END) as video_completed_count,
    SUM(CASE WHEN type = 'QUIZ_PASSED' THEN 1 ELSE 0 END) as quiz_passed_count,
    SUM(CASE WHEN type = 'STEP_COMPLETED' THEN 1 ELSE 0 END) as step_completed_count,
    SUM(CASE WHEN type = 'COURSE_COMPLETED' THEN 1 ELSE 0 END) as course_completed_count
FROM lms_signal
GROUP BY user_id;

-- v_leaderboard: Ranking based on signals + badges
CREATE VIEW IF NOT EXISTS v_leaderboard AS
SELECT 
    user_id,
    (video_completed_count * 50) + (quiz_passed_count * 100) + (course_completed_count * 200) + COALESCE(badge_points, 0) as total_points,
    video_completed_count,
    quiz_passed_count,
    badges_count,
    ROW_NUMBER() OVER (ORDER BY (video_completed_count * 50) + (quiz_passed_count * 100) + (course_completed_count * 200) + COALESCE(badge_points, 0) DESC) as rank
FROM (
    SELECT 
        s.user_id,
        SUM(CASE WHEN s.type = 'VIDEO_COMPLETED' THEN 1 ELSE 0 END) as video_completed_count,
        SUM(CASE WHEN s.type = 'QUIZ_PASSED' THEN 1 ELSE 0 END) as quiz_passed_count,
        SUM(CASE WHEN s.type = 'COURSE_COMPLETED' THEN 1 ELSE 0 END) as course_completed_count,
        COUNT(DISTINCT a.badge_id) as badges_count,
        SUM(DISTINCT b.points_reward) as badge_points
    FROM lms_signal s
    LEFT JOIN gamification_award a ON s.user_id = a.user_id
    LEFT JOIN gamification_badge b ON a.badge_id = b.id
    GROUP BY s.user_id
);

-- v_user_activity: User engagement (last activity, 24h count)
CREATE VIEW IF NOT EXISTS v_user_activity AS
SELECT 
    user_id,
    MAX(occurred_at) as last_event_at,
    SUM(CASE WHEN occurred_at > datetime('now', '-24 hours') THEN 1 ELSE 0 END) as events_24h,
    COUNT(*) as total_events
FROM lms_event
GROUP BY user_id;

-- v_course_progress: Progress percentage per user/course (GAP-601)
CREATE VIEW IF NOT EXISTS v_course_progress AS
SELECT 
    p.user_id,
    c.id as course_id,
    c.name as course_title,
    COUNT(DISTINCT CASE WHEN p.video_completed = 1 OR p.quiz_passed = 1 THEN p.class_id END) as completed_steps,
    (SELECT COUNT(*) FROM lms_class WHERE course_id = c.id) as total_steps,
    ROUND(
        CAST(COUNT(DISTINCT CASE WHEN p.video_completed = 1 OR p.quiz_passed = 1 THEN p.class_id END) AS FLOAT) / 
        NULLIF((SELECT COUNT(*) FROM lms_class WHERE course_id = c.id), 0) * 100, 1
    ) as progress_percent,
    MAX(p.updated_at) as last_activity
FROM lms_course c
LEFT JOIN v_user_progress p ON p.course_id = c.id
GROUP BY p.user_id, c.id;


-- ============================================
-- SEED DATA: Default Badges
-- ============================================

INSERT OR IGNORE INTO gamification_badge (id, name, description, icon_url, type, category, rarity, points_reward, criteria_json, is_active) VALUES
    ('first_video', 'Premier Pas', 'Regardé votre première vidéo', '/badges/first_video.svg', 'ACHIEVEMENT', 'onboarding', 'COMMON', 10, '{"type":"video_count","threshold":1}', 1),
    ('video_5', 'Spectateur Assidu', 'Regardé 5 vidéos', '/badges/video_5.svg', 'COMPLETION', 'learning', 'COMMON', 25, '{"type":"video_count","threshold":5}', 1),
    ('video_25', 'Cinéphile', 'Regardé 25 vidéos', '/badges/video_25.svg', 'COMPLETION', 'learning', 'RARE', 100, '{"type":"video_count","threshold":25}', 1),
    ('first_quiz', 'Premier Quiz', 'Réussi votre premier quiz', '/badges/first_quiz.svg', 'ACHIEVEMENT', 'onboarding', 'COMMON', 10, '{"type":"quiz_passed","threshold":1}', 1),
    ('quiz_10', 'Quiz Master', 'Réussi 10 quiz', '/badges/quiz_10.svg', 'COMPLETION', 'learning', 'RARE', 50, '{"type":"quiz_passed","threshold":10}', 1),
    ('perfect_quiz', 'Perfectionniste', 'Score parfait sur un quiz', '/badges/perfect_quiz.svg', 'ACHIEVEMENT', 'excellence', 'RARE', 25, '{"type":"quiz_perfect","threshold":1}', 1),
    ('streak_7', 'Semaine de Feu', '7 jours consécutifs d''activité', '/badges/streak_7.svg', 'STREAK', 'engagement', 'EPIC', 75, '{"type":"streak_days","threshold":7}', 1),
    ('streak_30', 'Mois Légendaire', '30 jours consécutifs d''activité', '/badges/streak_30.svg', 'STREAK', 'engagement', 'LEGENDARY', 300, '{"type":"streak_days","threshold":30}', 1),
    ('course_complete', 'Formation Terminée', 'Complété un cours entier', '/badges/course_complete.svg', 'COMPLETION', 'learning', 'RARE', 100, '{"type":"course_complete","threshold":1}', 1),
    ('course_5', 'Expert en Formation', 'Complété 5 cours', '/badges/course_5.svg', 'COMPLETION', 'mastery', 'EPIC', 500, '{"type":"course_complete","threshold":5}', 1);

-- ============================================
-- SEED DATA: Sample Course (WGE Onboarding)
-- ============================================

INSERT OR IGNORE INTO lms_course (id, name, description, categories_json, is_active, created_at) VALUES
    ('wge-onboarding', 'Onboarding WGE', 'Découvrez les valeurs de Wonder Grip Europe et la vie dans l''entreprise', '["onboarding"]', 1, datetime('now'));

INSERT OR IGNORE INTO lms_class (id, course_id, name, description, media_json, order_index, created_at) VALUES
    ('wge-onboarding-1', 'wge-onboarding', 'Les valeurs de WGE', 'Présentation par Julien CORNILLON', '[{"type":"VIDEO","stream_id":"618dd4d79f510ea8f4ab9e883af92fc4","name":"Les valeurs de WGE"}]', 1, datetime('now')),
    ('wge-onboarding-2', 'wge-onboarding', 'La vie dans l''entreprise', 'Présentation par Mai KUROKAWA', '[{"type":"VIDEO","stream_id":"26857db63bcbcf87a816bbad1f3d17a1","name":"La vie dans l''entreprise"}]', 2, datetime('now')),
    ('wge-onboarding-quiz', 'wge-onboarding', 'Quiz de validation', 'Validez vos acquis', '[{"type":"QUIZ","tally_form_id":"Y5R7Mq","name":"Quiz de validation"}]', 3, datetime('now'));

-- ============================================
-- XP Configuration (reference only)
-- ============================================
-- VIDEO_VIEW (completion >= 90%): +50 XP
-- FORM (quiz passed): +100 XP
-- Badge earned: +badge.points_reward XP
