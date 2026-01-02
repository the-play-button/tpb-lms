# Groups

## Objectif

Gestion des groupes (teams, departments). Assigner des roles aux groupes, gerer les membres, voir le statut de synchronisation Cloudflare.

---

## Wireframe - Liste

```
┌──────────────────────────────────────────────────────────────────────┐
│ Groups                                              [+ New Group]   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Search...]  [Org: All ▼]  [Type: All ▼]                           │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Name            │ Org   │ Type   │ Members │ Roles │ CF Sync   │ │
│  ├─────────────────┼───────┼────────┼─────────┼───────┼───────────┤ │
│  │ Administrators  │ TPB   │ team   │ 2       │ 1     │ ✓ synced  │ │
│  │ Developers      │ TPB   │ team   │ 5       │ 2     │ ✓ synced  │ │
│  │ LMS Instructors │ TPB   │ custom │ 8       │ 1     │ ⚠️ drift  │ │
│  │ Sales Team      │ Acme  │ team   │ 12      │ 1     │ ✓ synced  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  [< Prev]  Page 1 of 2  [Next >]                                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe - Detail (Side Panel)

```
┌────────────────────────────────────────────┐
│ Administrators                  [Edit] [x] │
├────────────────────────────────────────────┤
│                                            │
│  Organization: The Play Button             │
│  Type: team                                │
│  Description: System administrators        │
│  Created: 2024-01-15                       │
│                                            │
│  CF Access Sync                            │
│  ──────────────                            │
│  Status: ✓ Synced                          │
│  Last sync: 5 min ago                      │
│  [Force Sync]                              │
│                                            │
│  Roles (1)                                 │
│  ─────────                                 │
│  • superadmin           [Remove]           │
│  [+ Assign Role]                           │
│                                            │
│  Members (2)                               │
│  ────────────                              │
│  • matthieu@tpb.ai      [Remove]           │
│  • wayzate@tpb.ai       [Remove]           │
│  [+ Add Member]                            │
│                                            │
│  Permissions (via roles)                   │
│  ───────────────────────                   │
│  ● manage:*                                │
│  ● read:audit                              │
│  [View in Access Graph →]                  │
│                                            │
│  Actions                                   │
│  ───────                                   │
│  [Delete Group]                            │
│                                            │
└────────────────────────────────────────────┘
```

---

## Mapping DB

### Table principale
```sql
iam_group
    id TEXT PRIMARY KEY              -- "grp_xxx"
    organization_id TEXT NOT NULL    -- FK iam_organization
    name TEXT NOT NULL
    type TEXT DEFAULT 'team'         -- team | department | custom
    parent_id TEXT                   -- FK iam_group (hierarchie)
    manager_ids_json TEXT            -- JSON array of user_ids
    description TEXT
    is_active INTEGER DEFAULT 1
    created_at TEXT
    UNIQUE(organization_id, name)
```

### Tables liees
```sql
iam_user_group
    user_id TEXT NOT NULL
    group_id TEXT NOT NULL
    joined_at TEXT
    PRIMARY KEY (user_id, group_id)

iam_group_role
    group_id TEXT NOT NULL
    role_id TEXT NOT NULL
    granted_at TEXT
    PRIMARY KEY (group_id, role_id)

sys_infra_state  -- Pour le statut CF sync
    audience TEXT PRIMARY KEY
    namespace TEXT NOT NULL
    provider TEXT NOT NULL           -- "cloudflare_access"
    provider_resource_id TEXT        -- CF Access Group ID
    sync_status TEXT                 -- pending | synced | drift | error
    last_sync_at TEXT
```

### Queries

| Donnee | Query |
|--------|-------|
| Liste groups | `SELECT g.*, o.name as org_name FROM iam_group g JOIN iam_organization o ON g.organization_id = o.id WHERE g.is_active = 1` |
| Members d'un group | `SELECT u.* FROM iam_user u JOIN iam_user_group ug ON u.id = ug.user_id WHERE ug.group_id = ?` |
| Roles d'un group | `SELECT r.* FROM iam_role r JOIN iam_group_role gr ON r.id = gr.role_id WHERE gr.group_id = ?` |
| CF Sync status | `SELECT * FROM sys_infra_state WHERE namespace = ? AND audience LIKE ?` |
| Permissions via roles | Voir section "Calcul Permissions" |

### Calcul Permissions (d'un groupe)

```sql
SELECT DISTINCT p.action, p.resource
FROM iam_permission p
JOIN iam_role_permission rp ON p.id = rp.permission_id
JOIN iam_group_role gr ON rp.role_id = gr.role_id
WHERE gr.group_id = ?
```

---

## Etats

### Liste vide
```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  No groups yet.                                                    │
│                                                                    │
│  Groups help organize users and assign permissions.                │
│                                                                    │
│  [+ Create First Group]                                            │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Create Modal
```
┌────────────────────────────────────────────┐
│ New Group                              [x] │
├────────────────────────────────────────────┤
│                                            │
│  Name *                                    │
│  [_______________________________]         │
│                                            │
│  Organization *                            │
│  [The Play Button               ▼]         │
│                                            │
│  Type                                      │
│  [team                          ▼]         │
│                                            │
│  Description                               │
│  [_______________________________]         │
│  [_______________________________]         │
│                                            │
│  Assign Roles                              │
│  [Select roles...               ▼]         │
│                                            │
│  [Cancel]                    [Create]      │
│                                            │
└────────────────────────────────────────────┘
```

### Drift Alert (dans le detail)
```
┌────────────────────────────────────────────┐
│ ⚠️ Sync Drift Detected                     │
│                                            │
│ Vault: 8 members                           │
│ CF Access: 6 members                       │
│                                            │
│ Missing in CF:                             │
│ • bob@example.com                          │
│ • alice@example.com                        │
│                                            │
│ [Sync Now]  [View Details]                 │
└────────────────────────────────────────────┘
```

---

## Interactions

| Action | Comportement |
|--------|--------------|
| Click ligne | Ouvre side panel detail |
| + New Group | Ouvre modale creation |
| Edit | Ouvre modale edition |
| + Add Member | Dropdown users disponibles + insert `iam_user_group` |
| Remove Member | Confirmation + DELETE `iam_user_group` |
| + Assign Role | Dropdown roles + insert `iam_group_role` |
| Remove Role | Confirmation + DELETE `iam_group_role` |
| Force Sync | Appel API `/iam/sync-audiences` |
| Delete | Confirmation + soft delete `is_active = 0` |
| View in Access Graph | Navigue vers `/insights/graph?group=X` |

---

## Permissions

| Action | Permission Requise |
|--------|-------------------|
| Voir liste groups | `read:group` |
| Creer group | `manage:group` |
| Editer group | `manage:group` (meme org) |
| Ajouter/retirer membres | `manage:group` |
| Assigner roles | `manage:role` |
| Supprimer group | `manage:group` |

---

## Filtres

| Filtre | Colonne | Options |
|--------|---------|---------|
| Search | `name`, `description` | Free text |
| Org | `organization_id` | Dropdown orgs |
| Type | `type` | All, Team, Department, Custom |

---

## Sorting

| Colonne | Default | Direction |
|---------|---------|-----------|
| Name | ✓ | ASC |
| Members | | DESC |
| Created | | DESC |

---

## Edge Cases

| Cas | Comportement |
|-----|--------------|
| Nom deja pris dans l'org | Erreur "Group name already exists" |
| Supprimer groupe avec membres | Warning "This will remove X users from group" |
| Groupe sans role | Warning badge "No roles assigned" |
| CF sync en erreur | Badge rouge + message d'erreur |
| > 50 membres | Pagination dans la liste membres |

