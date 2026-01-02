-- ============================================
-- TPB VAULT SCHEMA
-- ERD: Unified.to aligned + TPB extensions (sys_*)
-- Storage: Cloudflare Secrets for values, D1 for metadata
-- ============================================

-- Clean slate (reverse order of dependencies)
DROP TABLE IF EXISTS iam_role_permission;
DROP TABLE IF EXISTS iam_group_role;
DROP TABLE IF EXISTS iam_user_group;
DROP TABLE IF EXISTS iam_permission;
DROP TABLE IF EXISTS iam_role;
DROP TABLE IF EXISTS iam_group;
DROP TABLE IF EXISTS iam_user;
DROP TABLE IF EXISTS iam_service_token;
DROP TABLE IF EXISTS sys_audit_log;
DROP TABLE IF EXISTS sys_secret_ref;
DROP TABLE IF EXISTS connection_auth;
DROP TABLE IF EXISTS connection;
DROP TABLE IF EXISTS iam_organization;

-- ============================================
-- iam_organization (Multi-tenant support)
-- ============================================
CREATE TABLE iam_organization (
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
CREATE TABLE connection (
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

CREATE INDEX idx_connection_type ON connection(integration_type);

-- ============================================
-- connection_auth (Unified.to: PropertyConnectionAuth)
-- Metadata about auth - 1:1 with connection
-- ============================================
CREATE TABLE connection_auth (
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
CREATE TABLE sys_secret_ref (
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

CREATE INDEX idx_secret_ref_conn ON sys_secret_ref(connection_id);

-- ============================================
-- sys_audit_log (TPB extension)
-- Tracks access to secrets
-- ============================================
CREATE TABLE sys_audit_log (
    id TEXT PRIMARY KEY,
    connection_id TEXT,
    secret_ref_id TEXT,
    action TEXT NOT NULL,                 -- READ, CREATE, UPDATE, DELETE
    actor_id TEXT,
    actor_type TEXT,                      -- user, service_token
    context_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_conn ON sys_audit_log(connection_id, created_at DESC);

-- ============================================
-- iam_user (identities)
-- ============================================
CREATE TABLE iam_user (
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

CREATE INDEX idx_iam_user_org ON iam_user(organization_id);
CREATE INDEX idx_iam_user_email ON iam_user(email);

-- ============================================
-- iam_group (teams, departments)
-- ============================================
CREATE TABLE iam_group (
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

CREATE INDEX idx_iam_group_org ON iam_group(organization_id);

-- ============================================
-- iam_role (RBAC)
-- ============================================
CREATE TABLE iam_role (
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
CREATE TABLE iam_permission (
    id TEXT PRIMARY KEY,                    -- "perm_secret_read"
    action TEXT NOT NULL,                   -- read | write | delete | manage
    resource TEXT NOT NULL,                 -- secret | user | course | *
    description TEXT
);

-- ============================================
-- iam_user_group (membership junction)
-- ============================================
CREATE TABLE iam_user_group (
    user_id TEXT NOT NULL REFERENCES iam_user(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL REFERENCES iam_group(id) ON DELETE CASCADE,
    joined_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, group_id)
);

-- ============================================
-- iam_group_role (role assignment junction)
-- ============================================
CREATE TABLE iam_group_role (
    group_id TEXT NOT NULL REFERENCES iam_group(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES iam_role(id) ON DELETE CASCADE,
    granted_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (group_id, role_id)
);

-- ============================================
-- iam_role_permission (permission mapping junction)
-- ============================================
CREATE TABLE iam_role_permission (
    role_id TEXT NOT NULL REFERENCES iam_role(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES iam_permission(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ============================================
-- iam_service_token (TPB IAM extension)
-- Tracks self-service generated service tokens
-- ============================================
CREATE TABLE iam_service_token (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES iam_organization(id),
    cf_token_id TEXT NOT NULL,           -- ID cote Cloudflare
    subject_email TEXT NOT NULL,         -- Qui l'a cree
    name TEXT NOT NULL,                  -- "dev-container-{email}"
    created_at TEXT DEFAULT (datetime('now')),
    revoked_at TEXT
);

CREATE INDEX idx_iam_token_subject ON iam_service_token(subject_email, created_at DESC);
CREATE INDEX idx_iam_token_active ON iam_service_token(subject_email, name) WHERE revoked_at IS NULL;

-- ============================================
-- CONNECTION TYPES (see VAULT_API_SPEC.md)
-- ============================================
-- integration_type   | Convention ID                          | Usage
-- -------------------|----------------------------------------|----------------------------------
-- infra              | conn_infra                             | Shared infrastructure secrets
-- integrations       | conn_integrations                      | Third-party API credentials
-- user_settings      | conn_user_<email_escaped>              | Per-user personal settings
--                    | (@ -> _at_, . -> _)                    |
-- ============================================

-- ============================================
-- SEED: Default organization
-- ============================================
INSERT INTO iam_organization (id, name, slug, cf_account_id) VALUES
    ('org_tpb', 'The Play Button', 'theplaybutton', '79d621c1d8e20c3c85009b30099b96e0');

-- ============================================
-- SEED: Default connections (with organization)
-- ============================================
INSERT INTO connection (id, organization_id, integration_type, integration_name, categories_json)
VALUES 
    ('conn_infra', 'org_tpb', 'infra', 'Infrastructure', '["cloudflare", "ai", "modal"]'),
    ('conn_integrations', 'org_tpb', 'integrations', 'Third-party Integrations', '["unified", "tally"]');

INSERT INTO connection_auth (id, connection_id, name)
VALUES
    ('auth_infra', 'conn_infra', 'Infrastructure Secrets'),
    ('auth_integrations', 'conn_integrations', 'Integration Secrets');

-- Seed secret references (values are in Cloudflare Secrets)
INSERT INTO sys_secret_ref (id, connection_id, name, cf_key, type, description) VALUES
    -- Infrastructure secrets
    ('ref_cf_token', 'conn_infra', 'CLOUDFLARE_API_TOKEN', 'CONN_infra_CLOUDFLARE_API_TOKEN', 'api_key', 'Cloudflare API token for deployments'),
    ('ref_cf_token_2', 'conn_infra', 'CLOUDFLARE_API_TOKEN_2', 'CONN_infra_CLOUDFLARE_API_TOKEN_2', 'api_key', 'Secondary Cloudflare API token'),
    ('ref_cf_account', 'conn_infra', 'CLOUDFLARE_ACCOUNT_ID', 'CONN_infra_CLOUDFLARE_ACCOUNT_ID', 'api_key', 'Cloudflare account ID'),
    ('ref_openai', 'conn_infra', 'OPENAI_API_KEY', 'CONN_infra_OPENAI_API_KEY', 'api_key', 'OpenAI API key'),
    ('ref_modal_id', 'conn_infra', 'MODAL_TOKEN_ID', 'CONN_infra_MODAL_TOKEN_ID', 'api_key', 'Modal token ID'),
    ('ref_modal_secret', 'conn_infra', 'MODAL_TOKEN_SECRET', 'CONN_infra_MODAL_TOKEN_SECRET', 'api_key', 'Modal token secret'),
    ('ref_modal_api_secret', 'conn_infra', 'MODAL_API_SECRET', 'CONN_infra_MODAL_API_SECRET', 'api_key', 'Shared secret for Modal API authentication (sphere-grid, etc.)'),
    -- Integration secrets
    ('ref_unified_token', 'conn_integrations', 'UNIFIEDTO_API_TOKEN', 'CONN_integrations_UNIFIEDTO_API_TOKEN', 'api_key', 'Unified.to API token'),
    ('ref_unified_ws', 'conn_integrations', 'UNIFIEDTO_WORKSPACE_ID', 'CONN_integrations_UNIFIEDTO_WORKSPACE_ID', 'api_key', 'Unified.to workspace ID'),
    ('ref_unified_secret', 'conn_integrations', 'UNIFIEDTO_WORKSPACE_SECRET', 'CONN_integrations_UNIFIEDTO_WORKSPACE_SECRET', 'api_key', 'Unified.to workspace secret'),
    ('ref_unified_conn', 'conn_integrations', 'UNIFIEDTO_CONNECTION_ID', 'CONN_integrations_UNIFIEDTO_CONNECTION_ID', 'api_key', 'Unified.to connection ID'),
    ('ref_tally', 'conn_integrations', 'TALLY_API_KEY', 'CONN_integrations_TALLY_API_KEY', 'api_key', 'Tally API key');

-- ============================================
-- SEED: IAM System Roles
-- ============================================
INSERT INTO iam_role (id, organization_id, name, description, is_system) VALUES
    ('role_superadmin', NULL, 'superadmin', 'Full system access across all orgs', 1),
    ('role_admin', NULL, 'admin', 'Organization admin', 1),
    ('role_developer', NULL, 'developer', 'Developer access to infra secrets', 1),
    ('role_reader', NULL, 'reader', 'Read-only access', 1);

-- ============================================
-- SEED: IAM Permissions
-- ============================================
INSERT INTO iam_permission (id, action, resource, description) VALUES
    ('perm_all', 'manage', '*', 'Full access to everything'),
    ('perm_secret_read', 'read', 'secret', 'Read secrets'),
    ('perm_secret_write', 'write', 'secret', 'Write secrets'),
    ('perm_user_read', 'read', 'user', 'Read users'),
    ('perm_user_manage', 'manage', 'user', 'Manage users'),
    ('perm_group_manage', 'manage', 'group', 'Manage groups'),
    ('perm_token_create', 'create', 'service_token', 'Create service tokens');

-- ============================================
-- SEED: IAM Role-Permission mappings
-- ============================================
INSERT INTO iam_role_permission (role_id, permission_id) VALUES
    ('role_superadmin', 'perm_all'),
    ('role_admin', 'perm_user_manage'),
    ('role_admin', 'perm_group_manage'),
    ('role_admin', 'perm_secret_read'),
    ('role_admin', 'perm_secret_write'),
    ('role_developer', 'perm_secret_read'),
    ('role_developer', 'perm_token_create'),
    ('role_reader', 'perm_secret_read'),
    ('role_reader', 'perm_user_read');

-- ============================================
-- SEED: Bootstrap admin user
-- ============================================
INSERT INTO iam_user (id, organization_id, email, display_name, status, user_type) VALUES
    ('usr_admin', 'org_tpb', 'matthieu.marielouise@theplaybutton.ai', 'Matthieu', 'active', 'human');

-- ============================================
-- SEED: Admin group with superadmin role
-- ============================================
INSERT INTO iam_group (id, organization_id, name, type, description) VALUES
    ('grp_admins', 'org_tpb', 'Administrators', 'team', 'Organization administrators'),
    ('grp_developers', 'org_tpb', 'Developers', 'team', 'Development team');

INSERT INTO iam_user_group (user_id, group_id) VALUES 
    ('usr_admin', 'grp_admins');

INSERT INTO iam_group_role (group_id, role_id) VALUES 
    ('grp_admins', 'role_superadmin'),
    ('grp_developers', 'role_developer');

-- ============================================
-- EXAMPLE: Per-user connection (user_settings)
-- Uncomment and adapt for new users
-- ============================================
-- INSERT INTO connection (id, organization_id, integration_type, integration_name, categories_json)
-- VALUES ('conn_user_john_doe_at_example_com', 'org_tpb', 'user_settings', 'John Doe Settings', '["personal"]');
--
-- INSERT INTO connection_auth (id, connection_id, name)
-- VALUES ('auth_user_john_doe', 'conn_user_john_doe_at_example_com', 'User Settings');
