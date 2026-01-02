# Organizations

## Objectif

Gestion des tenants (multi-tenant). Vue reservee aux superadmins pour gerer les organisations clientes.

---

## Wireframe - Liste

```
┌──────────────────────────────────────────────────────────────────────┐
│ Organizations                                        [+ New Org]    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Search...]  [Status: All ▼]                                       │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Name              │ Slug       │ Users │ Apps  │ Status        │ │
│  ├───────────────────┼────────────┼───────┼───────┼───────────────┤ │
│  │ The Play Button   │ tpb        │ 12    │ 3     │ ● Active      │ │
│  │ Acme Corp         │ acme       │ 45    │ 2     │ ● Active      │ │
│  │ Demo Client       │ demo       │ 3     │ 1     │ ○ Inactive    │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  [< Prev]  Page 1 of 1  [Next >]                                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe - Detail (Side Panel)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Back │ The Play Button                              [Edit] [...]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Settings                        │  Statistics                      │
│  ─────────                       │  ──────────                      │
│  ID: org_tpb                     │  Users: 12                       │
│  Slug: tpb                       │  Groups: 5                       │
│  CF Account: abc123              │  Applications: 3                 │
│  Created: 2024-01-15             │  Service Tokens: 8               │
│                                                                      │
│  Applications                                                        │
│  ────────────                                                        │
│  • TPB LMS (lms)           ● Active                                 │
│  • TPB API (api)           ● Active                                 │
│  • Analytics (analytics)   ● Active                                 │
│  [View all →]                                                        │
│                                                                      │
│  Recent Users                                                        │
│  ────────────                                                        │
│  • matthieu@tpb.ai         Active                                   │
│  • marie@tpb.ai            Active                                   │
│  • julien@tpb.ai           Active                                   │
│  [View all →]                                                        │
│                                                                      │
│  Actions                                                             │
│  ───────                                                             │
│  [Suspend Organization]  [Delete]                                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Mapping DB

### Table principale
```sql
iam_organization
    id TEXT PRIMARY KEY          -- "org_tpb"
    name TEXT NOT NULL           -- "The Play Button"
    slug TEXT UNIQUE NOT NULL    -- "tpb"
    cf_account_id TEXT           -- Cloudflare account ID
    settings_json TEXT           -- JSON config
    created_at TEXT
    updated_at TEXT
```

### Queries

| Donnee | Query |
|--------|-------|
| Liste orgs | `SELECT * FROM iam_organization ORDER BY name` |
| Count users | `SELECT COUNT(*) FROM iam_user WHERE organization_id = ?` |
| Count apps | `SELECT COUNT(*) FROM iam_application WHERE organization_id = ?` |
| Recent users | `SELECT * FROM iam_user WHERE organization_id = ? ORDER BY created_at DESC LIMIT 5` |

---

## Etats

### Liste vide
```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  No organizations yet.                                             │
│                                                                    │
│  [+ Create First Organization]                                     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Create/Edit Modal
```
┌────────────────────────────────────────────┐
│ New Organization                       [x] │
├────────────────────────────────────────────┤
│                                            │
│  Name *                                    │
│  [_______________________________]         │
│                                            │
│  Slug * (auto-generated)                   │
│  [_______________________________]         │
│                                            │
│  Cloudflare Account ID                     │
│  [_______________________________]         │
│                                            │
│  [Cancel]                    [Create]      │
│                                            │
└────────────────────────────────────────────┘
```

---

## Interactions

| Action | Comportement |
|--------|--------------|
| Click ligne | Ouvre side panel detail |
| + New Org | Ouvre modale creation |
| Edit | Ouvre modale edition |
| View all users | Navigue vers `/identity/users?org=X` |
| View all apps | Navigue vers `/access/applications?org=X` |
| Suspend | Confirmation puis `UPDATE status = 'suspended'` |
| Delete | Confirmation + check 0 users puis `DELETE` |

---

## Permissions

| Action | Permission Requise |
|--------|-------------------|
| Voir liste orgs | `manage:organization` ou superadmin |
| Creer org | `manage:organization` ou superadmin |
| Editer org | `manage:organization` ou superadmin |
| Supprimer org | superadmin uniquement |

---

## Edge Cases

| Cas | Comportement |
|-----|--------------|
| Delete org avec users | Erreur "Cannot delete org with active users" |
| Slug deja pris | Validation inline "Slug already exists" |
| CF Account ID invalide | Warning (pas bloquant) |

---

## Filtres

| Filtre | Colonne | Options |
|--------|---------|---------|
| Search | `name`, `slug` | Free text |
| Status | N/A (derive) | Active, Inactive, All |

---

## Sorting

| Colonne | Default | Direction |
|---------|---------|-----------|
| Name | ✓ | ASC |
| Users | | DESC |
| Created | | DESC |

