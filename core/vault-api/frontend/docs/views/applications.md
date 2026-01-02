# Applications

## Objectif

Gestion des OAuth Clients (applications TPB). Definir les audiences, scopes, credentials, et voir le statut de synchronisation avec Cloudflare Access.

---

## Wireframe - Liste

```
┌──────────────────────────────────────────────────────────────────────┐
│ Applications                                     [+ Register App]   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Search...]  [Org: All ▼]  [Status: All ▼]                         │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  ┌──────┐                                                       ││
│  │  │ LMS  │  TPB Learning Management System                       ││
│  │  └──────┘  Namespace: lms                                       ││
│  │            Audiences: lms-viewer, lms-api                       ││
│  │            Status: ● Active       [Manage] [Credentials]        ││
│  ├─────────────────────────────────────────────────────────────────┤│
│  │  ┌──────┐                                                       ││
│  │  │ API  │  TPB Public API                                       ││
│  │  └──────┘  Namespace: api                                       ││
│  │            Audiences: api-v1                                    ││
│  │            Status: ● Active       [Manage] [Credentials]        ││
│  ├─────────────────────────────────────────────────────────────────┤│
│  │  ┌──────┐                                                       ││
│  │  │ CRM  │  Customer Relationship Management                     ││
│  │  └──────┘  Namespace: crm                                       ││
│  │            Audiences: crm-app                                   ││
│  │            Status: ○ Suspended    [Manage] [Credentials]        ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe - Detail

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Back │ TPB LMS                                   [Edit] [Delete]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Overview                          │  Scopes Declares               │
│  ────────                          │  ───────────────               │
│  ID: app_tpblms                    │  lms:course:*                  │
│  Namespace: lms                    │  lms:student:*                 │
│  Status: ● Active                  │  lms:instructor:*              │
│  Created: 2024-06-01               │  lms:admin:*                   │
│  Created by: matthieu@tpb.ai       │  [+ Add Scope]                 │
│                                                                      │
│  Audiences (2)                                                       │
│  ─────────────                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Audience      │ CF Group ID        │ Status   │ Last Sync      │ │
│  ├───────────────┼────────────────────┼──────────┼────────────────┤ │
│  │ lms-viewer    │ abc123...          │ ✓ Synced │ 5 min ago      │ │
│  │ lms-api       │ def456...          │ ✓ Synced │ 5 min ago      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│  [+ Add Audience]  [Sync All]                                        │
│                                                                      │
│  Authorized Groups                                                   │
│  ─────────────────                                                   │
│  • Administrators (all scopes)                                      │
│  • LMS Instructors (lms:course:*, lms:student:*)                    │
│  • LMS Students (lms:course:read)                                   │
│  [+ Authorize Group]                                                 │
│                                                                      │
│  Credentials                                                        │
│  ───────────                                                        │
│  Client ID: app_tpblms_a1b2c3d4                                     │
│  Client Secret: ●●●●●●●●●●●●●●●●                                    │
│  Last rotated: 2024-12-15                                           │
│  [Rotate Credentials]  [View Secret (once)]                         │
│                                                                      │
│  Actions                                                             │
│  ───────                                                             │
│  [Suspend Application]  [Delete]                                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Mapping DB

### Table principale
```sql
iam_application
    id TEXT PRIMARY KEY              -- "app_lms"
    organization_id TEXT NOT NULL    -- FK iam_organization
    name TEXT NOT NULL UNIQUE
    display_name TEXT
    description TEXT
    namespace TEXT NOT NULL UNIQUE   -- "lms" (prefix for resources)
    scopes TEXT NOT NULL             -- "lms:role:*,lms:permission:*"
    audiences TEXT                   -- JSON: ["lms-viewer", "lms-api"]
    
    -- Service account credentials
    cf_token_id TEXT                 -- Cloudflare service token ID
    credentials_last_rotated_at TEXT
    
    -- Metadata
    icon_url TEXT
    homepage_url TEXT
    contact_email TEXT
    
    -- Status
    status TEXT DEFAULT 'active'     -- active | suspended | revoked
    created_by TEXT
    created_at TEXT
    updated_at TEXT
```

### Table Infrastructure State
```sql
sys_infra_state
    audience TEXT PRIMARY KEY        -- "lms-viewer"
    namespace TEXT NOT NULL          -- "lms"
    provider TEXT NOT NULL           -- "cloudflare_access"
    provider_resource_id TEXT        -- CF Access Group ID
    provider_resource_type TEXT      -- "access_group"
    last_sync_at TEXT
    sync_status TEXT                 -- pending | synced | drift | error
    error_message TEXT
    created_at TEXT
    updated_at TEXT
```

### Queries

| Donnee | Query |
|--------|-------|
| Liste apps | `SELECT a.*, o.name as org_name FROM iam_application a JOIN iam_organization o ON a.organization_id = o.id` |
| Audiences d'une app | `SELECT * FROM sys_infra_state WHERE namespace = ?` |
| Groupes autorises | Via `iam_group_role` + `iam_role` avec scopes matchant le namespace |

---

## Etats

### Liste vide
```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  No applications registered yet.                                   │
│                                                                    │
│  Applications are OAuth clients that can access vault-api.         │
│                                                                    │
│  [+ Register First Application]                                    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Register App Modal
```
┌────────────────────────────────────────────┐
│ Register Application                   [x] │
├────────────────────────────────────────────┤
│                                            │
│  Name *                                    │
│  [_______________________________]         │
│                                            │
│  Display Name                              │
│  [_______________________________]         │
│                                            │
│  Namespace * (unique, lowercase)           │
│  [_______________________________]         │
│                                            │
│  Organization *                            │
│  [The Play Button               ▼]         │
│                                            │
│  Scopes (comma-separated)                  │
│  [lms:*                         ]          │
│                                            │
│  Audiences (optional)                      │
│  [lms-viewer, lms-api           ]          │
│                                            │
│  [Cancel]                  [Register]      │
│                                            │
└────────────────────────────────────────────┘
```

### View Secret Modal (one-time)
```
┌────────────────────────────────────────────┐
│ ⚠️ Client Secret                       [x] │
├────────────────────────────────────────────┤
│                                            │
│  This secret will only be shown ONCE.      │
│  Copy it now and store it securely.        │
│                                            │
│  ┌────────────────────────────────────┐    │
│  │ sk_live_abc123def456...            │    │
│  │                           [Copy]   │    │
│  └────────────────────────────────────┘    │
│                                            │
│  [I've copied the secret]                  │
│                                            │
└────────────────────────────────────────────┘
```

---

## Interactions

| Action | Comportement |
|--------|--------------|
| Click card | Navigue vers detail `/access/applications/:id` |
| + Register App | Ouvre modale creation |
| Manage | Navigue vers detail |
| Credentials | Scroll to credentials section |
| Edit | Ouvre modale edition |
| + Add Audience | Ajoute audience au JSON + sync CF |
| + Add Scope | Ajoute scope a la liste |
| + Authorize Group | Assigne role avec scopes au groupe |
| Sync All | Force sync toutes les audiences |
| Rotate Credentials | Regenere client_id/secret + revoke ancien |
| View Secret | Modale one-time display |
| Suspend | `UPDATE status = 'suspended'` |
| Delete | Confirmation + DELETE cascade |

---

## Permissions

| Action | Permission Requise |
|--------|-------------------|
| Voir applications | `read:application` |
| Creer application | `manage:application` (superadmin) |
| Editer application | `manage:application` |
| Voir credentials | `manage:application` (owner ou superadmin) |
| Rotate credentials | `manage:application` |
| Supprimer | superadmin uniquement |

---

## Filtres

| Filtre | Colonne | Options |
|--------|---------|---------|
| Search | `name`, `namespace`, `display_name` | Free text |
| Org | `organization_id` | Dropdown orgs |
| Status | `status` | All, Active, Suspended, Revoked |

---

## Edge Cases

| Cas | Comportement |
|-----|--------------|
| Namespace deja pris | Erreur "Namespace already exists" |
| Audience en drift | Badge warning sur l'audience |
| Sync en erreur | Message d'erreur + retry button |
| Delete app avec tokens actifs | Warning + force option |
| Rotate avec sessions actives | Warning "X active sessions will be invalidated" |

---

## Sync Infrastructure Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   vault-api  │────▶│ infraProvider│────▶│ Cloudflare   │
│              │     │              │     │   Access     │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │  1. Add audience   │                    │
       │───────────────────▶│                    │
       │                    │  2. Create/Update  │
       │                    │     CF Group       │
       │                    │───────────────────▶│
       │                    │                    │
       │                    │  3. Store state    │
       │◀───────────────────│                    │
       │                    │                    │
       │  4. Update         │                    │
       │     sys_infra_state│                    │
       │                    │                    │
```

