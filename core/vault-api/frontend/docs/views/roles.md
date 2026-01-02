# Roles & Permissions

## Objectif

Definition RBAC : creer et gerer les roles, assigner des permissions atomiques, voir quels groupes ont quels roles.

---

## Wireframe - Master-Detail

```
┌──────────────────────────────────────────────────────────────────────┐
│ Roles & Permissions                                                  │
├───────┬──────────────────────────────────────────────────────────────┤
│       │                                                              │
│ Roles │  Role: superadmin                         [Edit] [Delete]   │
│ ───── │  ─────────────────                                          │
│       │  🔒 System role (non-editable)                              │
│ • superadmin │                                                       │
│ • admin      │  Description                                         │
│ • developer  │  ────────────                                        │
│ • viewer     │  Full administrative access to all resources.        │
│ • lms_instr  │                                                       │
│              │  Permissions (3)                                     │
│ ─────────    │  ┌────────────────────────────────────────────┐      │
│              │  │ Action    │ Resource │ Description        │      │
│ [+ New Role] │  ├───────────┼──────────┼────────────────────┤      │
│              │  │ manage    │ *        │ Full access        │      │
│              │  │ read      │ audit    │ View audit logs    │      │
│              │  │ manage    │ secret   │ Manage secrets     │      │
│              │  └────────────────────────────────────────────┘      │
│              │                                                       │
│              │  [+ Add Permission]                                   │
│              │                                                       │
│              │  Assigned to Groups (1)                              │
│              │  ─────────────────────                               │
│              │  • Administrators (TPB)                               │
│              │                                                       │
│              │  [View in Access Graph →]                            │
│              │                                                       │
└───────┴──────────────────────────────────────────────────────────────┘
```

---

## Wireframe - Permissions Matrix (vue alternative)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Permissions Matrix                              [View: List ▼]      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│              │ manage:* │ read:* │ write:secret │ read:audit │       │
│  ────────────┼──────────┼────────┼──────────────┼────────────┤       │
│  superadmin  │    ●     │   ●    │      ●       │     ●      │       │
│  admin       │    ○     │   ●    │      ●       │     ●      │       │
│  developer   │    ○     │   ●    │      ●       │     ○      │       │
│  viewer      │    ○     │   ●    │      ○       │     ○      │       │
│  lms_instr   │    ○     │   ○    │      ○       │     ○      │       │
│                                                                      │
│  Legend:  ● = Granted   ○ = Not granted                             │
│  Click cell to toggle (if role is editable)                         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Mapping DB

### Table principale - Roles
```sql
iam_role
    id TEXT PRIMARY KEY              -- "role_admin"
    organization_id TEXT             -- FK iam_organization (NULL = system role)
    name TEXT NOT NULL
    description TEXT
    is_system INTEGER DEFAULT 0      -- 1 = non-editable
    created_at TEXT
```

### Table Permissions
```sql
iam_permission
    id TEXT PRIMARY KEY              -- "perm_secret_read"
    action TEXT NOT NULL             -- read | write | delete | manage
    resource TEXT NOT NULL           -- secret | user | course | * (wildcard)
    description TEXT
```

### Table de jonction Role-Permission
```sql
iam_role_permission
    role_id TEXT NOT NULL
    permission_id TEXT NOT NULL
    PRIMARY KEY (role_id, permission_id)
```

### Table de jonction Group-Role
```sql
iam_group_role
    group_id TEXT NOT NULL
    role_id TEXT NOT NULL
    granted_at TEXT
    PRIMARY KEY (group_id, role_id)
```

### Queries

| Donnee | Query |
|--------|-------|
| Liste roles | `SELECT * FROM iam_role ORDER BY is_system DESC, name ASC` |
| Permissions d'un role | `SELECT p.* FROM iam_permission p JOIN iam_role_permission rp ON p.id = rp.permission_id WHERE rp.role_id = ?` |
| Groupes avec ce role | `SELECT g.* FROM iam_group g JOIN iam_group_role gr ON g.id = gr.group_id WHERE gr.role_id = ?` |
| Toutes permissions | `SELECT * FROM iam_permission ORDER BY resource, action` |

---

## Etats

### Role Systeme (non-editable)
```
┌────────────────────────────────────────────┐
│ 🔒 System Role                             │
│                                            │
│ This role is managed by the system and     │
│ cannot be edited or deleted.               │
│                                            │
└────────────────────────────────────────────┘
```

### Create Role Modal
```
┌────────────────────────────────────────────┐
│ New Role                               [x] │
├────────────────────────────────────────────┤
│                                            │
│  Name *                                    │
│  [_______________________________]         │
│                                            │
│  Description                               │
│  [_______________________________]         │
│  [_______________________________]         │
│                                            │
│  Scope (optional)                          │
│  [Organization: TPB              ▼]        │
│  Leave empty for global role               │
│                                            │
│  [Cancel]                    [Create]      │
│                                            │
└────────────────────────────────────────────┘
```

### Add Permission Modal
```
┌────────────────────────────────────────────┐
│ Add Permission                         [x] │
├────────────────────────────────────────────┤
│                                            │
│  Select permissions to add:                │
│                                            │
│  ☐ manage:user     Manage users            │
│  ☐ read:user       View users              │
│  ☐ manage:group    Manage groups           │
│  ☐ read:group      View groups             │
│  ☐ manage:secret   Manage secrets          │
│  ☐ read:secret     View secrets            │
│  ☐ read:audit      View audit logs         │
│                                            │
│  [Cancel]                    [Add]         │
│                                            │
└────────────────────────────────────────────┘
```

---

## Interactions

| Action | Comportement |
|--------|--------------|
| Click role (sidebar) | Affiche detail dans le panel droit |
| + New Role | Ouvre modale creation |
| Edit | Ouvre modale edition (si non-system) |
| Delete | Confirmation + DELETE (si non-system, non-assigne) |
| + Add Permission | Ouvre modale selection permissions |
| Remove Permission | Confirmation + DELETE `iam_role_permission` |
| Click cell (matrix) | Toggle permission si role editable |
| View in Access Graph | Navigue vers `/insights/graph?role=X` |

---

## Permissions

| Action | Permission Requise |
|--------|-------------------|
| Voir roles | `read:role` |
| Creer role | `manage:role` |
| Editer role | `manage:role` |
| Supprimer role | `manage:role` |
| Assigner permissions | `manage:role` |

---

## Edge Cases

| Cas | Comportement |
|-----|--------------|
| Role systeme | Boutons Edit/Delete disabled, badge "System" |
| Supprimer role assigne | Erreur "Role is assigned to X groups" |
| Nom deja pris | Erreur "Role name already exists" |
| Permission wildcard `manage:*` | Warning "This grants full access" |
| Role sans permission | Warning badge "No permissions" |

---

## Permissions Disponibles (Seed Data)

| ID | Action | Resource | Description |
|----|--------|----------|-------------|
| perm_manage_all | manage | * | Full access to everything |
| perm_read_all | read | * | Read access to everything |
| perm_manage_user | manage | user | Create, edit, delete users |
| perm_read_user | read | user | View users |
| perm_manage_group | manage | group | Create, edit, delete groups |
| perm_read_group | read | group | View groups |
| perm_manage_role | manage | role | Create, edit, delete roles |
| perm_read_role | read | role | View roles |
| perm_manage_secret | manage | secret | Create, edit, delete secrets |
| perm_read_secret | read | secret | Read secret values |
| perm_read_audit | read | audit | View audit logs |
| perm_manage_app | manage | application | Manage applications |
| perm_read_app | read | application | View applications |

---

## Natural Language Integration

Dans le detail d'un role, afficher la description generee :

```
┌────────────────────────────────────────────────────────────────────┐
│ Description (auto-generated)                                       │
│ ────────────────────────────                                       │
│                                                                    │
│ "This role can view and edit users, view groups, and read         │
│  secrets. It cannot delete anything or access audit logs."        │
│                                                                    │
│ [Edit description]  [Regenerate from permissions]                  │
└────────────────────────────────────────────────────────────────────┘
```

Voir [features/nl-policies.md](../features/nl-policies.md) pour les details.

