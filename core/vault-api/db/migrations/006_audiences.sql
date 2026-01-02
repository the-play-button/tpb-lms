-- ============================================
-- Migration 006: Audience-Based Access Control
-- OAuth-style audiences for applications
-- ============================================

-- Add audiences column to iam_application
-- JSON array of business identifiers (e.g., ["lms-viewer", "lms-api"])
ALTER TABLE iam_application ADD COLUMN audiences TEXT;

-- ============================================
-- Infrastructure State Tracking
-- Tracks provisioned resources for reconciliation
-- ============================================
CREATE TABLE IF NOT EXISTS sys_infra_state (
    audience TEXT PRIMARY KEY,              -- "lms-viewer"
    namespace TEXT NOT NULL,                -- "tpblms"
    provider TEXT NOT NULL,                 -- "cloudflare_access"
    provider_resource_id TEXT,              -- CF Access Group ID
    provider_resource_type TEXT,            -- "access_group"
    last_sync_at TEXT,
    sync_status TEXT DEFAULT 'pending',     -- pending, synced, drift, error
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_infra_state_namespace ON sys_infra_state(namespace);
CREATE INDEX IF NOT EXISTS idx_infra_state_provider ON sys_infra_state(provider);
CREATE INDEX IF NOT EXISTS idx_infra_state_status ON sys_infra_state(sync_status);

-- ============================================
-- Audit log entry
-- ============================================
INSERT INTO sys_audit_log (id, action, actor_id, actor_type, context_json, created_at)
VALUES (
    lower(hex(randomblob(16))),
    'migration:006_audiences',
    'system',
    'system',
    '{"description": "Added audiences column and sys_infra_state table for OAuth-style access control"}',
    datetime('now')
);

