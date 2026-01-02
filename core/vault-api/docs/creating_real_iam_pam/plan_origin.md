# vault-api IAM Console

Transform vault-api into a complete Identity and Access Management system supporting multi-tenant organizations, user/group management, and centralized CASL-based authorization.---

## ERD Design (Unified.to-Inspired)

```mermaid
erDiagram
    iam_organization ||--o{ iam_user : contains
    iam_organization ||--o{ iam_group : contains
    iam_organization ||--o{ iam_role : defines
    iam_organization ||--o{ connection : owns
    
    iam_user ||--o{ iam_user_group : member_of
    iam_user ||--o{ iam_service_token : creates
    iam_user ||--o| iam_user : managed_by
    
    iam_group ||--o{ iam_user_group : has_members
    iam_group ||--o| iam_group : parent_of
    iam_group }o--o{ iam_group_role : assigned
    
    iam_role ||--o{ iam_group_role : assigned_to
    iam_role ||--o{ iam_role_permission : grants
    iam_permission ||--o{ iam_role_permission : included_in
    
    iam_organization {
        text id PK "org_tpb"
        text name "The Play Button"
        text slug "theplaybutton"
        text cf_account_id "Cloudflare Account"
        text created_at
        text updated_at
    }
    
    iam_user {
        text id PK "usr_xxx"
        text organization_id FK
        text email UK
        text display_name
        text user_type "human|service"
        text manager_id FK "self-ref"
        text status "active|suspended|pending"
        text cf_access_identity "CF identity"
        text created_at
        text updated_at
    }
    
    iam_group {
        text id PK "grp_xxx"
        text organization_id FK
        text name "Engineering Team"
        text type "team|department|custom"
        text parent_id FK "hierarchy"
        text manager_ids JSON "array of user_ids"
        text description
        text is_active
        text created_at
    }
    
    iam_role {
        text id PK "role_admin"
        text organization_id FK "null=system"
        text name "admin|reader|instructor"
        text description
        text is_system "builtin"
        text created_at
    }
    
    iam_permission {
        text id PK "perm_course_read"
        text action "read|write|delete|manage"
        text resource "course|secret|user|*"
        text description
    }
    
    iam_user_group {
        text user_id FK
        text group_id FK
        text joined_at
    }
    
    iam_group_role {
        text group_id FK
        text role_id FK
        text granted_at
    }
    
    iam_role_permission {
        text role_id FK
        text permission_id FK
    }
```

---

## Schema Changes

New tables to add to [`vault-api/db/schema.sql`](tpb_system/04.Execution/lms/core/vault-api/db/schema.sql):| Table | Purpose | Key Fields |

|-------|---------|------------|

| `iam_organization` | Multi-tenant orgs | id, name, slug, cf_account_id |

| `iam_user` | Human/service identities | id, org_id, email, manager_id, status |

| `iam_group` | Teams/departments (HRIS-style) | id, org_id, type, parent_id, manager_ids |

| `iam_role` | RBAC roles | id, org_id (null=system), name, is_system |

| `iam_permission` | Atomic permissions | id, action, resource |

| `iam_user_group` | User-Group membership (ReBAC) | user_id, group_id |

| `iam_group_role` | Group-Role assignment | group_id, role_id |

| `iam_role_permission` | Role-Permission mapping | role_id, permission_id |Modify existing:

- `connection`: Add `organization_id` FK (replaces workspace_id concept)
- `iam_service_token`: Add `organization_id` FK

---

## API Endpoints

### Organization Management

| Method | Endpoint | Description |

|--------|----------|-------------|

| GET | `/iam/organizations` | List orgs (superadmin only) |

| POST | `/iam/organizations` | Create org |

| GET | `/iam/organizations/:orgId` | Get org details |

| PATCH | `/iam/organizations/:orgId` | Update org |

### User Management (SCIM-inspired)

| Method | Endpoint | Description |

|--------|----------|-------------|

| GET | `/iam/organizations/:orgId/users` | List users |

| POST | `/iam/organizations/:orgId/users` | Create/invite user |

| GET | `/iam/organizations/:orgId/users/:userId` | Get user |

| PATCH | `/iam/organizations/:orgId/users/:userId` | Update user |

| DELETE | `/iam/organizations/:orgId/users/:userId` | Deactivate user |

### Group Management (HRIS-inspired)

| Method | Endpoint | Description |

|--------|----------|-------------|

| GET | `/iam/organizations/:orgId/groups` | List groups |

| POST | `/iam/organizations/:orgId/groups` | Create group |

| PATCH | `/iam/organizations/:orgId/groups/:groupId` | Update group |

| POST | `/iam/organizations/:orgId/groups/:groupId/members` | Add members |

| DELETE | `/iam/organizations/:orgId/groups/:groupId/members/:userId` | Remove member |

### Role/Permission Management

| Method | Endpoint | Description |

|--------|----------|-------------|

| GET | `/iam/organizations/:orgId/roles` | List roles (system + custom) |

| POST | `/iam/organizations/:orgId/roles` | Create custom role |

| POST | `/iam/organizations/:orgId/groups/:groupId/roles` | Assign role to group |

### CASL Authorization Endpoint

| Method | Endpoint | Description |

|--------|----------|-------------|

| POST | `/iam/can` | Check if user can perform action |Request body:

```json
{
  "user_id": "usr_xxx",
  "action": "read",
  "resource": "course",
  "resource_id": "course_123",
  "context": { "tenant_id": "org_tpb" }
}
```

Response:

```json
{
  "allowed": true,
  "reason": "role:instructor grants course:read",
  "rules_evaluated": 3
}
```

---

## CASL Integration Strategy

1. **Server-side CASL in vault-api**: Define abilities based on user's roles/groups
2. **`/iam/can` endpoint**: Apps call this to check authorization
3. **Cached abilities**: Return user's full ability set for client-side caching
4. **Audit trail**: Log all authorization decisions in `sys_audit_log`

Example CASL ability building in vault-api:

```javascript
// Built from user's groups -> roles -> permissions
const ability = defineAbility((can, cannot) => {
  if (roles.includes('admin')) {
    can('manage', 'all');
  }
  if (roles.includes('instructor')) {
    can('read', 'Course');
    can('write', 'Course', { instructor_id: userId });
  }
  if (roles.includes('student')) {
    can('read', 'Course', { enrolled: true });
  }
});
```

---

## Migration Path

1. **No breaking changes**: Existing endpoints (`/vault/*`, `/iam/service-tokens`) remain unchanged
2. **Add `organization_id`**: Default org `org_tpb` for existing data
3. **Seed system roles**: `admin`, `reader`, `instructor`, `student`
4. **Seed permissions**: Based on existing IAMPAM matrix

---

## Files to Modify/Create

| File | Action |

|------|--------|

| [`db/schema.sql`](tpb_system/04.Execution/lms/core/vault-api/db/schema.sql) | Add new IAM tables |

| `backend/handlers/organizations.js` | Create - Org CRUD |

| `backend/handlers/users.js` | Create - User CRUD |

| `backend/handlers/groups.js` | Create - Group CRUD |

| `backend/handlers/roles.js` | Create - Role/Permission CRUD |

| `backend/handlers/can.js` | Create - CASL authorization |

| [`backend/index.js`](tpb_system/04.Execution/lms/core/vault-api/backend/index.js) | Add new routes |

| [`backend/middleware/auth.js`](tpb_system/04.Execution/lms/core/vault-api/backend/middleware/auth.js) | Enhance with org context |

| `package.json` | Add `@casl/ability` dependency |---

## Seed Data

```sql
-- System roles (organization_id = NULL)
INSERT INTO iam_role (id, organization_id, name, is_system) VALUES
  ('role_superadmin', NULL, 'superadmin', 1),
  ('role_admin', NULL, 'admin', 1),
  ('role_reader', NULL, 'reader', 1);

-- Default organization
INSERT INTO iam_organization (id, name, slug) VALUES
  ('org_tpb', 'The Play Button', 'theplaybutton');

-- Base permissions
INSERT INTO iam_permission (id, action, resource) VALUES
  ('perm_all', 'manage', '*'),
  ('perm_secret_read', 'read', 'secret'),
  ('perm_secret_write', 'write', 'secret'),
  ('perm_user_read', 'read', 'user'),
  ('perm_user_manage', 'manage', 'user');

```