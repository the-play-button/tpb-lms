# Users

## Objectif

Gestion des identites. Voir, creer, editer les utilisateurs, les assigner a des groupes, voir leurs permissions effectives.

---

## Wireframe - Liste

```
┌──────────────────────────────────────────────────────────────────────┐
│ Users                                                [+ Invite User]│
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Search...]  [Org: All ▼]  [Status: All ▼]  [Type: All ▼]          │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ ○ │ Email                 │ Org   │ Type    │ Groups │ Status  │ │
│  ├───┼───────────────────────┼───────┼─────────┼────────┼─────────┤ │
│  │ ○ │ matthieu@tpb.ai       │ TPB   │ human   │ 2      │ Active  │ │
│  │ ○ │ julien@acme.com       │ Acme  │ human   │ 1      │ Active  │ │
│  │ ○ │ api@service.io        │ TPB   │ service │ 0      │ Active  │ │
│  │ ○ │ bob@test.com          │ TPB   │ human   │ 0      │ Pending │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  [Bulk Actions ▼]  Selected: 0                                      │
│                                                                      │
│  [< Prev]  Page 1 of 5  [Next >]        Showing 1-20 of 95          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe - Detail (Side Panel)

```
┌────────────────────────────────────────────┐
│ matthieu@tpb.ai                [Edit] [x]  │
├────────────────────────────────────────────┤
│                                            │
│  Organization: The Play Button             │
│  Type: human                               │
│  Status: ● Active                          │
│  Created: 2024-01-15                       │
│  Display Name: Matthieu ML                 │
│                                            │
│  Groups (2)                                │
│  ────────────                              │
│  • Administrators       [Remove]           │
│  • Developers           [Remove]           │
│  [+ Add to Group]                          │
│                                            │
│  Effective Permissions                     │
│  ────────────────────                      │
│  ● manage:*         (via Administrators)   │
│  ● vault:secret:*   (via Developers)       │
│  ● lms:*            (via Developers)       │
│  [View full matrix →]                      │
│  [Why can't access...? →]                  │
│                                            │
│  Service Tokens                            │
│  ──────────────                            │
│  • dev-container (active)                  │
│  • ci-pipeline (revoked)                   │
│  [View all →]                              │
│                                            │
│  Actions                                   │
│  ───────                                   │
│  [Suspend] [Delete] [Reset CF Policy]      │
│                                            │
└────────────────────────────────────────────┘
```

---

## Mapping DB

### Table principale
```sql
iam_user
    id TEXT PRIMARY KEY              -- "usr_xxx"
    organization_id TEXT NOT NULL    -- FK iam_organization
    email TEXT NOT NULL
    display_name TEXT
    user_type TEXT DEFAULT 'human'   -- human | service
    manager_id TEXT                  -- FK iam_user (hierarchie)
    status TEXT DEFAULT 'pending'    -- pending | active | suspended
    cf_policy_id TEXT                -- CF Access policy ID
    created_at TEXT
    updated_at TEXT
    UNIQUE(organization_id, email)
```

### Tables liees
```sql
iam_user_group
    user_id TEXT NOT NULL            -- FK iam_user
    group_id TEXT NOT NULL           -- FK iam_group
    joined_at TEXT
    PRIMARY KEY (user_id, group_id)
```

### Queries

| Donnee | Query |
|--------|-------|
| Liste users | `SELECT u.*, o.name as org_name FROM iam_user u JOIN iam_organization o ON u.organization_id = o.id` |
| Groups d'un user | `SELECT g.* FROM iam_group g JOIN iam_user_group ug ON g.id = ug.group_id WHERE ug.user_id = ?` |
| Count groups | `SELECT COUNT(*) FROM iam_user_group WHERE user_id = ?` |
| Effective perms | Voir section "Calcul Permissions Effectives" |

### Calcul Permissions Effectives

```sql
SELECT DISTINCT p.action, p.resource
FROM iam_permission p
JOIN iam_role_permission rp ON p.id = rp.permission_id
JOIN iam_role r ON rp.role_id = r.id
JOIN iam_group_role gr ON r.id = gr.role_id
JOIN iam_user_group ug ON gr.group_id = ug.group_id
WHERE ug.user_id = ?
```

---

## Etats

### Liste vide
```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  No users yet.                                                     │
│                                                                    │
│  [+ Invite First User]                                             │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Create Modal
```
┌────────────────────────────────────────────┐
│ Invite User                            [x] │
├────────────────────────────────────────────┤
│                                            │
│  Email *                                   │
│  [_______________________________]         │
│                                            │
│  Display Name                              │
│  [_______________________________]         │
│                                            │
│  Organization *                            │
│  [The Play Button               ▼]         │
│                                            │
│  Type                                      │
│  ○ Human (default)                         │
│  ○ Service account                         │
│                                            │
│  Add to Groups                             │
│  [Select groups...              ▼]         │
│                                            │
│  [Cancel]                    [Invite]      │
│                                            │
└────────────────────────────────────────────┘
```

### Loading
Skeleton rows + spinner sur le bouton de pagination.

### Error
Toast notification avec message d'erreur.

---

## Interactions

| Action | Comportement |
|--------|--------------|
| Click ligne | Ouvre side panel detail |
| + Invite User | Ouvre modale creation |
| Edit | Ouvre modale edition |
| Add to Group | Dropdown avec groupes disponibles |
| Remove from Group | Confirmation puis DELETE `iam_user_group` |
| View full matrix | Navigue vers `/access/matrix?user=X` |
| Why can't access | Navigue vers `/explain?user=X` |
| Suspend | `UPDATE status = 'suspended'` |
| Delete | Confirmation + DELETE cascade |
| Reset CF Policy | Supprime `cf_policy_id`, declenche re-sync |

### Bulk Actions

| Action | Comportement |
|--------|--------------|
| Suspend selected | Suspend tous les users selectionnes |
| Add to group | Ajoute tous les users a un groupe |
| Export CSV | Telecharge liste filtree |

---

## Permissions

| Action | Permission Requise |
|--------|-------------------|
| Voir liste users | `read:user` |
| Voir users autres orgs | `manage:*` ou superadmin |
| Creer user | `manage:user` |
| Editer user | `manage:user` (meme org) |
| Supprimer user | `manage:user` (meme org) |
| Supprimer superadmin | superadmin uniquement |

---

## Filtres

| Filtre | Colonne | Options |
|--------|---------|---------|
| Search | `email`, `display_name` | Free text |
| Org | `organization_id` | Dropdown orgs |
| Status | `status` | All, Active, Pending, Suspended |
| Type | `user_type` | All, Human, Service |

---

## Sorting

| Colonne | Default | Direction |
|---------|---------|-----------|
| Email | ✓ | ASC |
| Created | | DESC |
| Status | | ASC |

---

## Edge Cases

| Cas | Comportement |
|-----|--------------|
| Email deja pris dans l'org | Erreur "Email already exists in this organization" |
| Supprimer user avec tokens actifs | Warning + force delete option |
| User dans 10+ groups | Affiche premiers 5 + "and 5 more" |
| Effective perms > 20 | Affiche premiers 5 + "View all" |

