# Phase 1 - Database Schema

## Nouvelles tables

```sql
-- ============================================
-- IAM ORGANIZATION (Multi-tenant)
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
-- IAM USER (identities)
-- ============================================
CREATE TABLE iam_user (
    id TEXT PRIMARY KEY,                    -- "usr_xxx"
    organization_id TEXT NOT NULL REFERENCES iam_organization(id),
    email TEXT NOT NULL,
    display_name TEXT,
    user_type TEXT DEFAULT 'human',         -- human | service
    manager_id TEXT REFERENCES iam_user(id),
    status TEXT DEFAULT 'pending',          -- pending | active | suspended
    cf_policy_id TEXT,                      -- CF Access policy ID (si ajouté)
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(organization_id, email)
);

CREATE INDEX idx_iam_user_org ON iam_user(organization_id);
CREATE INDEX idx_iam_user_email ON iam_user(email);

-- ============================================
-- IAM GROUP (teams, departments)
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

-- ============================================
-- IAM ROLE (RBAC)
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
-- IAM PERMISSION (atomic permissions)
-- ============================================
CREATE TABLE iam_permission (
    id TEXT PRIMARY KEY,                    -- "perm_secret_read"
    action TEXT NOT NULL,                   -- read | write | delete | manage
    resource TEXT NOT NULL,                 -- secret | user | course | *
    description TEXT
);

-- ============================================
-- JUNCTION TABLES
-- ============================================
CREATE TABLE iam_user_group (
    user_id TEXT NOT NULL REFERENCES iam_user(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL REFERENCES iam_group(id) ON DELETE CASCADE,
    joined_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, group_id)
);

CREATE TABLE iam_group_role (
    group_id TEXT NOT NULL REFERENCES iam_group(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES iam_role(id) ON DELETE CASCADE,
    granted_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (group_id, role_id)
);

CREATE TABLE iam_role_permission (
    role_id TEXT NOT NULL REFERENCES iam_role(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES iam_permission(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);
```

## Modifications existantes

```sql
-- Ajouter organization_id à connection
ALTER TABLE connection ADD COLUMN organization_id TEXT REFERENCES iam_organization(id);

-- Ajouter organization_id à iam_service_token
ALTER TABLE iam_service_token ADD COLUMN organization_id TEXT REFERENCES iam_organization(id);
```

## Seed Data

```sql
-- Default org
INSERT INTO iam_organization (id, name, slug, cf_account_id) VALUES
    ('org_tpb', 'The Play Button', 'theplaybutton', '79d621c1d8e20c3c85009b30099b96e0');

-- System roles
INSERT INTO iam_role (id, organization_id, name, description, is_system) VALUES
    ('role_superadmin', NULL, 'superadmin', 'Full system access', 1),
    ('role_admin', NULL, 'admin', 'Organization admin', 1),
    ('role_developer', NULL, 'developer', 'Developer access to infra secrets', 1),
    ('role_reader', NULL, 'reader', 'Read-only access', 1);

-- Permissions
INSERT INTO iam_permission (id, action, resource, description) VALUES
    ('perm_all', 'manage', '*', 'Full access to everything'),
    ('perm_secret_read', 'read', 'secret', 'Read secrets'),
    ('perm_secret_write', 'write', 'secret', 'Write secrets'),
    ('perm_user_read', 'read', 'user', 'Read users'),
    ('perm_user_manage', 'manage', 'user', 'Manage users'),
    ('perm_token_create', 'create', 'service_token', 'Create service tokens');

-- Role-Permission mappings
INSERT INTO iam_role_permission (role_id, permission_id) VALUES
    ('role_superadmin', 'perm_all'),
    ('role_admin', 'perm_user_manage'),
    ('role_admin', 'perm_secret_read'),
    ('role_developer', 'perm_secret_read'),
    ('role_developer', 'perm_token_create'),
    ('role_reader', 'perm_secret_read'),
    ('role_reader', 'perm_user_read');

-- Bootstrap admin user
INSERT INTO iam_user (id, organization_id, email, display_name, status, user_type) VALUES
    ('usr_admin', 'org_tpb', 'matthieu.marielouise@theplaybutton.ai', 'Matthieu', 'active', 'human');

-- Admin group with admin role
INSERT INTO iam_group (id, organization_id, name, type, description) VALUES
    ('grp_admins', 'org_tpb', 'Administrators', 'team', 'Organization administrators');

INSERT INTO iam_user_group (user_id, group_id) VALUES ('usr_admin', 'grp_admins');
INSERT INTO iam_group_role (group_id, role_id) VALUES ('grp_admins', 'role_superadmin');

-- Update existing connections
UPDATE connection SET organization_id = 'org_tpb' WHERE organization_id IS NULL;
UPDATE iam_service_token SET organization_id = 'org_tpb' WHERE organization_id IS NULL;
```

## Fichier à modifier

`db/schema.sql` : Ajouter tout le SQL ci-dessus après les tables existantes.

