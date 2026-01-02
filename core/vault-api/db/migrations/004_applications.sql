-- ============================================
-- Migration 004: Application Management
-- Enables TPB applications to manage their own IAM
-- ============================================

-- ============================================
-- iam_application (TPB extension)
-- Registered applications with scoped service accounts
-- ============================================
CREATE TABLE IF NOT EXISTS iam_application (
    id TEXT PRIMARY KEY,                    -- "app_lms"
    organization_id TEXT NOT NULL REFERENCES iam_organization(id),
    name TEXT NOT NULL UNIQUE,              -- "lms"
    display_name TEXT,                      -- "Learning Management System"
    description TEXT,
    namespace TEXT NOT NULL UNIQUE,         -- "lms" (prefix for all resources)
    scopes TEXT NOT NULL,                   -- "lms:role:*,lms:permission:*,lms:group:*"
    
    -- Service account credentials (reference)
    cf_token_id TEXT,                       -- Cloudflare service token ID
    credentials_last_rotated_at TEXT,
    
    -- Metadata
    icon_url TEXT,
    homepage_url TEXT,
    contact_email TEXT,
    
    -- Status
    status TEXT DEFAULT 'active',           -- active, suspended, revoked
    created_by TEXT,                        -- Admin who registered it
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_iam_application_org ON iam_application(organization_id);
CREATE INDEX IF NOT EXISTS idx_iam_application_namespace ON iam_application(namespace);
CREATE INDEX IF NOT EXISTS idx_iam_application_status ON iam_application(status);

-- ============================================
-- Extend iam_service_token with application support
-- ============================================
ALTER TABLE iam_service_token ADD COLUMN application_id TEXT REFERENCES iam_application(id);
ALTER TABLE iam_service_token ADD COLUMN scopes TEXT;

-- ============================================
-- Audit log
-- ============================================
INSERT INTO sys_audit_log (id, action, actor_id, actor_type, context_json, created_at)
VALUES (
    lower(hex(randomblob(16))),
    'migration:004_applications',
    'system',
    'system',
    '{"description": "Added iam_application table and scopes support"}',
    datetime('now')
);

