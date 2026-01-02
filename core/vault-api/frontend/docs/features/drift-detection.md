# Drift Detection - Sync Proactive

## Probleme Resolu

**Pain point marche** : La synchronisation entre l'IAM et l'infrastructure (Cloudflare Access, AWS IAM, etc.) est une boite noire. Quand ca casse, personne ne sait pourquoi.

- Les changements manuels cote infra creent des ecarts invisibles
- Les erreurs de sync silencieuses laissent des users sans acces
- Aucune alerte proactive

---

## Concept

**Solution TPB Vault** : Detection automatique et proactive des ecarts ("drift") entre vault-api et Cloudflare Access :

1. **Verification periodique** : Check toutes les 15 minutes
2. **Alertes visuelles** : Badge dans le header, widget dashboard
3. **Details actionables** : Qui manque, depuis quand, pourquoi
4. **Resolution en un clic** : Bouton "Sync Now"

---

## Wireframe Principal

```
┌──────────────────────────────────────────────────────────────────────┐
│ Drift Detection                                            [Fix All] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Cloudflare Access                          Last check: 2min ago │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ ⚠️ Group "LMS Instructors"                           DRIFT     │ │
│  │                                                                │ │
│  │  Vault expects: 8 members                                      │ │
│  │  CF Access has: 6 members                                      │ │
│  │                                                                │ │
│  │  Missing in Cloudflare:                                        │ │
│  │  • bob@example.com       (added in Vault 2h ago)              │ │
│  │  • alice@example.com     (added in Vault 1d ago)              │ │
│  │                                                                │ │
│  │  Extra in Cloudflare (not in Vault):                          │ │
│  │  • olduser@example.com   (manually added?)                    │ │
│  │                                                                │ │
│  │  [Sync Now]  [View Details]  [Ignore]                         │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │ ✓ Group "Administrators"                             IN SYNC  │ │
│  │   2 members, last synced 15min ago                            │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │ ✓ Group "Developers"                                 IN SYNC  │ │
│  │   5 members, last synced 15min ago                            │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │ ❌ Group "Sales Team"                                 ERROR    │ │
│  │   CF API error: Rate limit exceeded                           │ │
│  │   [Retry]                                                     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Settings                                                           │
│  ────────                                                           │
│  Auto-sync: [Every 15min ▼]                                        │
│  Alert threshold: [1h ▼]  (alert if drift > X time)                │
│  [Save Settings]                                                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe - Header Alert

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🔐 TPB Vault          │ Org: [TPB ▼]     │ ⚠️ 2 │ user@ │ [Logout] │
│                                              │                       │
│                                              └─ Badge drift alerts   │
└──────────────────────────────────────────────────────────────────────┘
```

Click sur le badge → dropdown avec resume :

```
┌─────────────────────────────────────┐
│ ⚠️ 2 Drift Alerts                   │
│                                     │
│ • LMS Instructors (2 missing)       │
│ • Sales Team (API error)            │
│                                     │
│ [View All →]                        │
└─────────────────────────────────────┘
```

---

## Wireframe - Dashboard Widget

```
┌─────────────────────────────────────────┐
│ Infrastructure Sync                     │
│ ────────────────────                    │
│                                         │
│ ✓ 3 groups in sync                      │
│ ⚠️ 1 drift detected                     │
│ ❌ 1 sync error                         │
│                                         │
│ [View Details →]                        │
└─────────────────────────────────────────┘
```

---

## Mapping DB

### Table principale
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

### Statuts

| Status | Description |
|--------|-------------|
| `pending` | Jamais synce |
| `synced` | Vault == CF Access |
| `drift` | Vault != CF Access |
| `error` | Erreur API CF |

### Queries

| Donnee | Query |
|--------|-------|
| Tous les etats | `SELECT * FROM sys_infra_state ORDER BY sync_status DESC, audience` |
| Drifts seulement | `WHERE sync_status = 'drift'` |
| Erreurs seulement | `WHERE sync_status = 'error'` |
| Par application | `WHERE namespace = ?` |

---

## Algorithme de Detection

### 1. Recuperer etat attendu (Vault)

```sql
-- Membres attendus pour un groupe/audience
SELECT u.email
FROM iam_user u
JOIN iam_user_group ug ON u.id = ug.user_id
JOIN iam_group g ON ug.group_id = g.id
JOIN iam_application a ON g.organization_id = a.organization_id
WHERE a.audiences LIKE '%' || ? || '%'
AND u.status = 'active'
```

### 2. Recuperer etat reel (CF Access)

```javascript
const cfGroup = await cfAccess.getAccessGroup(groupId);
const cfMembers = cfGroup.include
  .filter(rule => rule.email)
  .map(rule => rule.email.email);
```

### 3. Calculer le diff

```javascript
const expected = new Set(vaultMembers);
const actual = new Set(cfMembers);

const missing = [...expected].filter(e => !actual.has(e));
const extra = [...actual].filter(e => !expected.has(e));

const status = (missing.length === 0 && extra.length === 0) 
  ? 'synced' 
  : 'drift';
```

### 4. Mettre a jour sys_infra_state

```sql
UPDATE sys_infra_state 
SET sync_status = ?, 
    last_sync_at = datetime('now'),
    error_message = NULL
WHERE audience = ?
```

---

## API Endpoints

### GET `/iam/drift`

**Response:**
```json
{
  "summary": {
    "total": 5,
    "synced": 3,
    "drift": 1,
    "error": 1
  },
  "items": [
    {
      "audience": "lms-viewer",
      "namespace": "lms",
      "status": "drift",
      "last_sync_at": "2024-12-31T10:00:00Z",
      "drift_details": {
        "expected_count": 8,
        "actual_count": 6,
        "missing": ["bob@example.com", "alice@example.com"],
        "extra": ["olduser@example.com"]
      }
    },
    {
      "audience": "sales-app",
      "namespace": "sales",
      "status": "error",
      "error_message": "CF API: Rate limit exceeded",
      "last_sync_at": "2024-12-31T09:45:00Z"
    }
  ],
  "last_check": "2024-12-31T10:15:00Z"
}
```

### POST `/iam/drift/check`

Force une verification immediate.

### POST `/iam/drift/sync`

**Request:**
```json
{
  "audience": "lms-viewer"
}
```

Ou pour tout syncer :
```json
{
  "all": true
}
```

---

## Automatisation

### Cron Job (Scheduled Worker)

```javascript
// Toutes les 15 minutes
export default {
  async scheduled(event, env, ctx) {
    const audiences = await env.DB.prepare(
      'SELECT * FROM sys_infra_state'
    ).all();
    
    for (const audience of audiences.results) {
      await checkAndUpdateDrift(audience, env);
    }
  }
};
```

### Trigger sur Changement

A chaque `ADD_MEMBER` ou `REMOVE_MEMBER`, trigger une sync immediate :

```javascript
// Dans groups.js apres addMember/removeMember
await infraProvider.syncAudience(audienceName, newMembersList);
await updateInfraState(audienceName, 'synced');
```

---

## UX Interactions

| Action | Comportement |
|--------|--------------|
| View Details | Expand pour voir les membres manquants/extra |
| Sync Now | Appel POST `/iam/drift/sync`, spinner, refresh |
| Fix All | Sync toutes les audiences en drift |
| Retry (error) | Re-tente le sync pour cette audience |
| Ignore | Cache temporairement cette alerte (session) |
| Save Settings | Persiste preferences auto-sync |

---

## Edge Cases

| Cas | Comportement |
|-----|--------------|
| CF API down | Status "error", retry auto apres 5min |
| Audience sans groupe CF | Status "pending", suggestion de creer |
| Membre avec email different | Match insensible a la casse |
| > 100 membres en drift | Paginer la liste, afficher "and X more" |
| Rate limit CF | Backoff exponentiel, alerte admin |

---

## Alertes

### Niveaux d'alerte

| Niveau | Condition | Action |
|--------|-----------|--------|
| Info | Drift < 1h | Badge jaune |
| Warning | Drift > 1h | Badge orange + notification |
| Critical | Drift > 24h | Badge rouge + email admin |

### Notification Email (future)

```
Subject: [TPB Vault] Drift detected in "LMS Instructors"

Hi admin,

A drift has been detected between TPB Vault and Cloudflare Access:

Audience: LMS Instructors
Duration: 2 hours
Missing users: bob@example.com, alice@example.com

Click here to fix: https://vault.tpb.ai/insights/drift

---
TPB Vault IAM Console
```

---

## Differenciateur vs Marche

| Aspect | Concurrence | TPB Vault |
|--------|-------------|-----------|
| Sync status | "Fire and forget" | Dashboard temps reel |
| Detection | Manuelle/reactive | Automatique/proactive |
| Resolution | Debug logs, CLI | Un clic, inline |
| Alertes | Aucune ou email generique | Badge contextuel + details |

