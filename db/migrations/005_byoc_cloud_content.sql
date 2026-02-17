-- ============================================
-- BYOC (Bring Your Own Cloud) Content Tables
-- ============================================
-- Migrates content storage from GitHub PAT to cloud providers
-- via Unified.to + IAMPAM bastion.
--
-- lms_content_ref: References to files in author's cloud storage
-- lms_content_share: Granular sharing of .pitch and other files
-- lms_content_access: Access audit trail

-- Reference to a file in an author's cloud storage
CREATE TABLE IF NOT EXISTS lms_content_ref (
    id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL,       -- Unified.to connection ID
    file_id TEXT NOT NULL,             -- Provider file ID
    name TEXT NOT NULL,
    content_type TEXT NOT NULL,        -- 'markdown' | 'pitch' | 'pdf'
    owner_email TEXT NOT NULL,
    course_id TEXT,                    -- FK lms_course
    class_id TEXT,                     -- FK lms_class
    usage TEXT,                        -- 'intro' | 'step_document' | 'pitch_attachment'
    lang TEXT DEFAULT 'source',
    source_ref_id TEXT,               -- FK self (for i18n: points to source-language ref)
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(connection_id, file_id, lang)
);

CREATE INDEX IF NOT EXISTS idx_content_ref_course ON lms_content_ref(course_id);
CREATE INDEX IF NOT EXISTS idx_content_ref_class ON lms_content_ref(class_id);
CREATE INDEX IF NOT EXISTS idx_content_ref_owner ON lms_content_ref(owner_email);
CREATE INDEX IF NOT EXISTS idx_content_ref_source ON lms_content_ref(source_ref_id);

-- Granular sharing (.pitch and other files)
CREATE TABLE IF NOT EXISTS lms_content_share (
    id TEXT PRIMARY KEY,
    content_ref_id TEXT NOT NULL REFERENCES lms_content_ref(id),
    shared_by TEXT NOT NULL,
    shared_with TEXT NOT NULL,
    role TEXT DEFAULT 'READ' CHECK(role IN ('READ', 'WRITE')),
    provider_permission_id TEXT,      -- Cloud provider permission ID (for revocation)
    shared_at TEXT DEFAULT (datetime('now')),
    revoked_at TEXT DEFAULT NULL,
    UNIQUE(content_ref_id, shared_with)
);

CREATE INDEX IF NOT EXISTS idx_content_share_ref ON lms_content_share(content_ref_id);
CREATE INDEX IF NOT EXISTS idx_content_share_by ON lms_content_share(shared_by);
CREATE INDEX IF NOT EXISTS idx_content_share_with ON lms_content_share(shared_with);

-- Access audit trail
CREATE TABLE IF NOT EXISTS lms_content_access (
    id TEXT PRIMARY KEY,
    content_ref_id TEXT NOT NULL REFERENCES lms_content_ref(id),
    user_email TEXT NOT NULL,
    accessed_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_content_access_ref ON lms_content_access(content_ref_id);
CREATE INDEX IF NOT EXISTS idx_content_access_user ON lms_content_access(user_email);
