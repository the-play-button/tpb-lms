# Service Tokens

## Objectif

Gestion des tokens M2M (machine-to-machine). Permettre aux developpeurs de generer leurs propres tokens (self-service) et aux admins de voir/revoquer tous les tokens.

---

## Wireframe - Vue Utilisateur

```
┌──────────────────────────────────────────────────────────────────────┐
│ Service Tokens                                  [+ Generate Token]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  My Tokens                                                          │
│  ─────────                                                          │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Name                     │ Created    │ Status  │              │ │
│  ├──────────────────────────┼────────────┼─────────┼──────────────┤ │
│  │ dev-container-matthieu   │ 2024-12-30 │ Active  │ [Revoke]     │ │
│  │ ci-pipeline              │ 2024-12-15 │ Active  │ [Revoke]     │ │
│  │ local-testing            │ 2024-11-01 │ Revoked │              │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ℹ️ Tokens give programmatic access to vault-api.                    │
│     Store them securely and revoke when no longer needed.           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe - Vue Admin

```
┌──────────────────────────────────────────────────────────────────────┐
│ Service Tokens                                  [+ Generate Token]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [My Tokens]  [All Tokens]                                          │
│               ──────────                                             │
│                                                                      │
│  [Search...]  [User: All ▼]  [Status: Active ▼]  [App: All ▼]       │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Name              │ Owner           │ App   │ Created  │ Status│ │
│  ├───────────────────┼─────────────────┼───────┼──────────┼───────┤ │
│  │ dev-container-mat │ matthieu@tpb   │ -     │ 12-30    │ Active│ │
│  │ dev-container-jul │ julien@tpb     │ -     │ 12-28    │ Active│ │
│  │ lms-service       │ system         │ LMS   │ 12-01    │ Active│ │
│  │ api-service       │ system         │ API   │ 11-15    │ Active│ │
│  │ ci-old            │ marie@tpb      │ -     │ 10-01    │ Revoked││
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  [Bulk Actions ▼]  Selected: 0                                      │
│                                                                      │
│  [< Prev]  Page 1 of 3  [Next >]                                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Mapping DB

### Table principale
```sql
iam_service_token
    id TEXT PRIMARY KEY
    organization_id TEXT             -- FK iam_organization
    cf_token_id TEXT NOT NULL        -- ID cote Cloudflare Access
    cf_client_id TEXT                -- Client ID pour auth
    subject_email TEXT NOT NULL      -- Email du createur
    name TEXT NOT NULL               -- "dev-container-matthieu"
    application_id TEXT              -- FK iam_application (si token d'app)
    scopes TEXT                      -- "vault:secret:*" ou null
    created_at TEXT
    revoked_at TEXT                  -- NULL si actif
```

### Queries

| Donnee | Query |
|--------|-------|
| Mes tokens | `SELECT * FROM iam_service_token WHERE subject_email = ? ORDER BY created_at DESC` |
| Tous les tokens | `SELECT st.*, a.name as app_name FROM iam_service_token st LEFT JOIN iam_application a ON st.application_id = a.id ORDER BY st.created_at DESC` |
| Tokens actifs | `WHERE revoked_at IS NULL` |
| Count par user | `SELECT subject_email, COUNT(*) FROM iam_service_token WHERE revoked_at IS NULL GROUP BY subject_email` |

---

## Etats

### Aucun token
```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  You don't have any service tokens yet.                            │
│                                                                    │
│  Service tokens allow scripts and applications to access          │
│  vault-api programmatically.                                       │
│                                                                    │
│  [+ Generate Your First Token]                                     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Generate Token Modal
```
┌────────────────────────────────────────────┐
│ Generate Service Token                 [x] │
├────────────────────────────────────────────┤
│                                            │
│  Token Name *                              │
│  [dev-container-matthieu    ]              │
│                                            │
│  ℹ️ This will create a Cloudflare Access   │
│     service token linked to your account.  │
│                                            │
│  [Cancel]                  [Generate]      │
│                                            │
└────────────────────────────────────────────┘
```

### Token Created Modal (one-time)
```
┌────────────────────────────────────────────┐
│ ✓ Token Created                        [x] │
├────────────────────────────────────────────┤
│                                            │
│  ⚠️ Save these credentials NOW.            │
│     They will NOT be shown again.          │
│                                            │
│  Client ID                                 │
│  ┌────────────────────────────────────┐    │
│  │ abc123.access                      │    │
│  │                           [Copy]   │    │
│  └────────────────────────────────────┘    │
│                                            │
│  Client Secret                             │
│  ┌────────────────────────────────────┐    │
│  │ sk_xyz789...                       │    │
│  │                           [Copy]   │    │
│  └────────────────────────────────────┘    │
│                                            │
│  Add to .devcontainer/.env:                │
│  ┌────────────────────────────────────┐    │
│  │ VAULT_CLIENT_ID=abc123.access      │    │
│  │ VAULT_CLIENT_SECRET=sk_xyz789...   │    │
│  │                           [Copy]   │    │
│  └────────────────────────────────────┘    │
│                                            │
│  [I've saved these credentials]            │
│                                            │
└────────────────────────────────────────────┘
```

### Revoke Confirmation
```
┌────────────────────────────────────────────┐
│ Revoke Token                           [x] │
├────────────────────────────────────────────┤
│                                            │
│  Are you sure you want to revoke           │
│  "dev-container-matthieu"?                 │
│                                            │
│  ⚠️ Any scripts using this token will      │
│     immediately stop working.              │
│                                            │
│  [Cancel]                  [Revoke]        │
│                                            │
└────────────────────────────────────────────┘
```

---

## Interactions

| Action | Comportement |
|--------|--------------|
| + Generate Token | Ouvre modale, appel CF API, affiche credentials |
| Revoke | Confirmation, `UPDATE revoked_at = NOW()`, revoke CF token |
| Tab My Tokens | Filtre sur `subject_email = current_user` |
| Tab All Tokens | Affiche tous (admin only) |
| Search | Recherche sur `name`, `subject_email` |
| Bulk Revoke | Revoque tous les tokens selectionnes |

---

## Permissions

| Action | Permission Requise |
|--------|-------------------|
| Voir mes tokens | Tout utilisateur authentifie |
| Generer mon token | Tout utilisateur authentifie |
| Revoquer mon token | Proprietaire du token |
| Voir tous les tokens | `manage:*` ou superadmin |
| Revoquer n'importe quel token | `manage:*` ou superadmin |

---

## Filtres (Vue Admin)

| Filtre | Colonne | Options |
|--------|---------|---------|
| Search | `name`, `subject_email` | Free text |
| User | `subject_email` | Dropdown users |
| Status | `revoked_at` | All, Active, Revoked |
| App | `application_id` | All, Personal, [App names] |

---

## Edge Cases

| Cas | Comportement |
|-----|--------------|
| Nom de token deja pris | Suffixe auto `-2`, `-3`, etc. |
| Limite tokens par user | Warning a 5 tokens, erreur a 10 |
| Token sans scopes | Token personnel avec `vault:secret:*` par defaut |
| CF API erreur | Retry + message d'erreur detaille |
| Token d'app (non personnel) | Tag "App Token" + non-revocable par le user |

---

## Token Types

| Type | Createur | Usage | Scopes |
|------|----------|-------|--------|
| Personal | User self-service | Dev local, CI perso | `vault:secret:*` |
| Application | Admin/System | Service-to-service | Definis par l'app |

---

## Security Notes

- Les tokens sont crees via l'API Cloudflare Access
- `cf_client_id` et `cf_token_id` sont stockes, pas le secret
- Le secret n'est visible qu'une fois (lors de la creation)
- La revocation est immediate (cote CF + cote vault-api)
- Audit log pour chaque creation/revocation

