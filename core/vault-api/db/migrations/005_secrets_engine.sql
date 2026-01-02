-- ============================================
-- Migration 005: Secrets Engine (KV)
-- HashiCorp Vault-style path-based secrets
-- ============================================

-- New simplified secrets table
CREATE TABLE IF NOT EXISTS sys_secret (
    path TEXT PRIMARY KEY,                    -- "infra/openai_api_key"
    cf_key TEXT UNIQUE NOT NULL,              -- "SECRET_infra_openai_api_key"
    type TEXT DEFAULT 'secret',               -- secret, api_key, token, certificate
    description TEXT,
    tags_json TEXT,                           -- JSON array: ["production", "ai"]
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sys_secret_type ON sys_secret(type);

-- ============================================
-- Audit log for this migration
-- ============================================
INSERT INTO sys_audit_log (id, action, actor_id, actor_type, context_json, created_at)
VALUES (
    lower(hex(randomblob(16))),
    'migration:005_secrets_engine',
    'system',
    'system',
    '{"description": "Added sys_secret table for KV-style secrets engine"}',
    datetime('now')
);


