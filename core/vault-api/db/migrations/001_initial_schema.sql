-- ============================================
-- TPB VAULT INITIAL SCHEMA - IDEMPOTENT
-- ERD: Unified.to aligned + TPB extensions (sys_*)
-- Storage: Cloudflare Secrets for values, D1 for metadata
-- ============================================

-- ============================================
-- iam_organization (Multi-tenant support)
-- ============================================
CREATE TABLE IF NOT EXISTS iam_organization (
    id TEXT PRIMARY KEY,                    -- "org_tpb"
    name TEXT NOT NULL,                     -- "The Play Button"
    slug TEXT UNIQUE NOT NULL,              -- "theplaybutton"
    cf_account_id TEXT,                     -- Cloudflare account ID
    settings_json TEXT,                     -- JSON config
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- connection (Unified.to: Connection)
-- Represents a vault/connection to a service
-- ============================================
CREATE TABLE IF NOT EXISTS connection (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES iam_organization(id),
    integration_type TEXT NOT NULL,       -- "infra" | "integrations" | "user_settings"
    integration_name TEXT,
    categories_json TEXT,                 -- JSON array: ["cloudflare", "ai"]
    permissions_json TEXT,                -- JSON array: ["read", "write"]
    environment TEXT DEFAULT 'production',
    is_paused INTEGER DEFAULT 0,
    external_xref TEXT,
    last_healthy_at TEXT,
    last_unhealthy_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_connection_type ON connection(integration_type);

-- ============================================
-- connection_auth (Unified.to: PropertyConnectionAuth)
-- Metadata about auth - 1:1 with connection
-- ============================================
CREATE TABLE IF NOT EXISTS connection_auth (
    id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL UNIQUE REFERENCES connection(id) ON DELETE CASCADE,
    name TEXT,                            -- "Infrastructure Secrets"
    api_url TEXT,
    authorize_url TEXT,
    token_url TEXT,
    app_id TEXT,
    meta_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- sys_secret_ref (TPB extension)
-- Registry of secrets - points to Cloudflare Secrets
-- NO VALUES STORED HERE - only references
-- ============================================
CREATE TABLE IF NOT EXISTS sys_secret_ref (
    id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL REFERENCES connection(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                   -- "OPENAI_API_KEY"
    cf_key TEXT NOT NULL UNIQUE,          -- "CONN_infra_OPENAI_API_KEY"
    type TEXT DEFAULT 'api_key',          -- api_key, access_token, client_id, client_secret, pem
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(connection_id, name)
);

CREATE INDEX IF NOT EXISTS idx_secret_ref_conn ON sys_secret_ref(connection_id);

-- ============================================
-- sys_audit_log (TPB extension)
-- Tracks access to secrets
-- ============================================
CREATE TABLE IF NOT EXISTS sys_audit_log (
    id TEXT PRIMARY KEY,
    connection_id TEXT,
    secret_ref_id TEXT,
    action TEXT NOT NULL,                 -- READ, CREATE, UPDATE, DELETE
    actor_id TEXT,
    actor_type TEXT,                      -- user, service_token
    context_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_conn ON sys_audit_log(connection_id, created_at DESC);

-- ============================================
-- iam_user (identities)
-- ============================================
CREATE TABLE IF NOT EXISTS iam_user (
    id TEXT PRIMARY KEY,                    -- "usr_xxx"
    organization_id TEXT NOT NULL REFERENCES iam_organization(id),
    email TEXT NOT NULL,
    display_name TEXT,
    user_type TEXT DEFAULT 'human',         -- human | service
    manager_id TEXT REFERENCES iam_user(id),
    status TEXT DEFAULT 'pending',          -- pending | active | suspended
    cf_policy_id TEXT,                      -- CF Access policy ID (if granted)
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_iam_user_org ON iam_user(organization_id);
CREATE INDEX IF NOT EXISTS idx_iam_user_email ON iam_user(email);

-- ============================================
-- iam_group (teams, departments)
-- ============================================
CREATE TABLE IF NOT EXISTS iam_group (
    id TEXT PRIMARY KEY,                    -- "grp_xxx"
    organization_id TEXT NOT NULL REFERENCES iam_organization(id),
    name TEXT NOT NULL,
    type TEXT DEFAULT 'team',               -- team | department | custom
    parent_id TEXT REFERENCES iam_group(id),
    manager_ids_json TEXT,                  -- JSON array of user_ids
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_iam_group_org ON iam_group(organization_id);

-- ============================================
-- iam_role (RBAC)
-- ============================================
CREATE TABLE IF NOT EXISTS iam_role (
    id TEXT PRIMARY KEY,                    -- "role_admin"
    organization_id TEXT REFERENCES iam_organization(id), -- NULL = system role
    name TEXT NOT NULL,
    description TEXT,
    is_system INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- iam_permission (atomic permissions)
-- ============================================
CREATE TABLE IF NOT EXISTS iam_permission (
    id TEXT PRIMARY KEY,                    -- "perm_secret_read"
    action TEXT NOT NULL,                   -- read | write | delete | manage
    resource TEXT NOT NULL,                 -- secret | user | course | *
    description TEXT
);

-- ============================================
-- iam_user_group (membership junction)
-- ============================================
CREATE TABLE IF NOT EXISTS iam_user_group (
    user_id TEXT NOT NULL REFERENCES iam_user(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL REFERENCES iam_group(id) ON DELETE CASCADE,
    joined_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, group_id)
);

-- ============================================
-- iam_group_role (role assignment junction)
-- ============================================
CREATE TABLE IF NOT EXISTS iam_group_role (
    group_id TEXT NOT NULL REFERENCES iam_group(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES iam_role(id) ON DELETE CASCADE,
    granted_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (group_id, role_id)
);

-- ============================================
-- iam_role_permission (permission mapping junction)
-- ============================================
CREATE TABLE IF NOT EXISTS iam_role_permission (
    role_id TEXT NOT NULL REFERENCES iam_role(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES iam_permission(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ============================================
-- iam_service_token (TPB IAM extension)
-- Tracks self-service generated service tokens
-- ============================================
CREATE TABLE IF NOT EXISTS iam_service_token (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES iam_organization(id),
    cf_token_id TEXT NOT NULL,           -- ID cote Cloudflare
    subject_email TEXT NOT NULL,         -- Qui l'a cree
    name TEXT NOT NULL,                  -- "dev-container-{email}"
    created_at TEXT DEFAULT (datetime('now')),
    revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_iam_token_subject ON iam_service_token(subject_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_iam_token_active ON iam_service_token(subject_email, name) WHERE revoked_at IS NULL;
