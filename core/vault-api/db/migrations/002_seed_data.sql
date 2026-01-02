-- ============================================
-- TPB VAULT SEED DATA - IDEMPOTENT
-- Inserts default data only if not already present
-- ============================================

-- ============================================
-- SEED: Default organization
-- ============================================
INSERT OR IGNORE INTO iam_organization (id, name, slug, cf_account_id) VALUES
    ('org_tpb', 'The Play Button', 'theplaybutton', '79d621c1d8e20c3c85009b30099b96e0');

-- ============================================
-- SEED: Default connections (with organization)
-- ============================================
INSERT OR IGNORE INTO connection (id, organization_id, integration_type, integration_name, categories_json)
VALUES 
    ('conn_infra', 'org_tpb', 'infra', 'Infrastructure', '["cloudflare", "ai", "modal"]'),
    ('conn_integrations', 'org_tpb', 'integrations', 'Third-party Integrations', '["unified", "tally"]');

INSERT OR IGNORE INTO connection_auth (id, connection_id, name)
VALUES
    ('auth_infra', 'conn_infra', 'Infrastructure Secrets'),
    ('auth_integrations', 'conn_integrations', 'Integration Secrets');

-- Seed secret references (values are in Cloudflare Secrets)
INSERT OR IGNORE INTO sys_secret_ref (id, connection_id, name, cf_key, type, description) VALUES
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
INSERT OR IGNORE INTO iam_role (id, organization_id, name, description, is_system) VALUES
    ('role_superadmin', NULL, 'superadmin', 'Full system access across all orgs', 1),
    ('role_admin', NULL, 'admin', 'Organization admin', 1),
    ('role_developer', NULL, 'developer', 'Developer access to infra secrets', 1),
    ('role_reader', NULL, 'reader', 'Read-only access', 1);

-- ============================================
-- SEED: IAM Permissions
-- ============================================
INSERT OR IGNORE INTO iam_permission (id, action, resource, description) VALUES
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
INSERT OR IGNORE INTO iam_role_permission (role_id, permission_id) VALUES
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
INSERT OR IGNORE INTO iam_user (id, organization_id, email, display_name, status, user_type) VALUES
    ('usr_admin', 'org_tpb', 'matthieu.marielouise@theplaybutton.ai', 'Matthieu', 'active', 'human');

-- ============================================
-- SEED: Admin group with superadmin role
-- ============================================
INSERT OR IGNORE INTO iam_group (id, organization_id, name, type, description) VALUES
    ('grp_admins', 'org_tpb', 'Administrators', 'team', 'Organization administrators'),
    ('grp_developers', 'org_tpb', 'Developers', 'team', 'Development team');

INSERT OR IGNORE INTO iam_user_group (user_id, group_id) VALUES 
    ('usr_admin', 'grp_admins');

INSERT OR IGNORE INTO iam_group_role (group_id, role_id) VALUES 
    ('grp_admins', 'role_superadmin'),
    ('grp_developers', 'role_developer');
