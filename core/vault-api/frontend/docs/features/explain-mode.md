# Explain Mode - L'IAM qui s'explique

## Probleme Resolu

**Pain point marche** : Toutes les solutions IAM repondent "Access Denied" sans expliquer pourquoi ni comment resoudre.

- AWS IAM : "User is not authorized to perform action X"
- Auth0 : "Insufficient scope"
- Okta : "Access denied"

L'admin doit ensuite faire un puzzle mental pour comprendre : quels groupes, quels roles, quelles permissions ?

---

## Concept

**Solution TPB Vault** : Au lieu de juste dire "Access Denied", expliquer :
1. **POURQUOI** l'acces est refuse (quelle permission manque)
2. **COMMENT** resoudre (options concretes avec boutons d'action)
3. **QUEL CHEMIN** la permission prendrait si accordee

---

## Wireframe Principal

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🔍 Why can't julien@acme.com access LMS Admin?                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ❌ ACCESS DENIED                                                    │
│                                                                      │
│  Reason: Missing scope `lms:admin:*`                                │
│                                                                      │
│  julien@acme.com currently has:                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ ● lms:course:read    (via Developers → developer)              │ │
│  │ ● vault:secret:read  (via Developers → developer)              │ │
│  │ ○ lms:admin:*        ← MISSING                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  How to fix:                                                        │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Option A: Add to group "LMS Admins"                            │ │
│  │           → grants lms:admin:*, lms:course:*, lms:student:*    │ │
│  │                                                       [Do it]  │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │ Option B: Assign role "lms_admin" to group "Developers"        │ │
│  │           → affects 5 other users in this group                │ │
│  │                                                       [Do it]  │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │ Option C: Create custom role with only lms:admin:*             │ │
│  │           → minimal privilege approach                         │ │
│  │                                                       [Do it]  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Permission path (if granted via Option A):                         │
│  julien → LMS Admins → role_lms_admin → lms:admin:*                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe - Permission Granted

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🔍 Why can matthieu@tpb.ai access Vault Secrets?                    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✅ ACCESS GRANTED                                                   │
│                                                                      │
│  matthieu@tpb.ai has scope `vault:secret:*`                         │
│                                                                      │
│  Permission path:                                                   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │  matthieu  ──▶  Administrators  ──▶  superadmin  ──▶  manage:* │ │
│  │     └───────▶  Developers      ──▶  developer  ──▶  vault:*   │ │
│  │                                                                │ │
│  │  Note: Two paths grant this access (redundant)                 │ │
│  │                                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  [View in Access Graph →]                                           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### 1. Global Search Bar

```
┌──────────────────────────────────────────────────────────────────────┐
│  🔍 Why can't [julien@acme.com  ▼] access [lms:admin:*  ▼] ?        │
└──────────────────────────────────────────────────────────────────────┘
```

Accessible depuis n'importe quelle page via le header.

### 2. User Detail Page

```
┌────────────────────────────────────────────┐
│ Effective Permissions                      │
│ ────────────────────                       │
│ ● manage:*         (via Administrators)    │
│ ● vault:secret:*   (via Developers)        │
│                                            │
│ [Why can't access...? →]                   │
│                                            │
└────────────────────────────────────────────┘
```

### 3. Permissions Matrix

Click sur cellule ○ → popup avec explain + fix options.

### 4. Deep Link

`/explain?user=julien@acme.com&scope=lms:admin:*`

---

## Mapping DB

### Algorithme

1. **Recuperer permissions actuelles du user**
```sql
SELECT DISTINCT p.action, p.resource, g.name as via_group, r.name as via_role
FROM iam_permission p
JOIN iam_role_permission rp ON p.id = rp.permission_id
JOIN iam_role r ON rp.role_id = r.id
JOIN iam_group_role gr ON r.id = gr.role_id
JOIN iam_group g ON gr.group_id = g.id
JOIN iam_user_group ug ON g.id = ug.group_id
WHERE ug.user_id = ?
```

2. **Verifier si scope demande est present**
```javascript
const hasScope = userPermissions.some(p => 
  matchScope(p.action + ':' + p.resource, requestedScope)
);
```

3. **Si non, trouver les chemins possibles**
```sql
-- Groupes qui donnent ce scope
SELECT g.id, g.name, r.name as role_name
FROM iam_group g
JOIN iam_group_role gr ON g.id = gr.group_id
JOIN iam_role r ON gr.role_id = r.id
JOIN iam_role_permission rp ON r.id = rp.role_id
JOIN iam_permission p ON rp.permission_id = p.id
WHERE (p.action || ':' || p.resource = ? OR p.resource = '*')
AND g.organization_id = (SELECT organization_id FROM iam_user WHERE id = ?)
```

4. **Calculer impact de chaque option**
```javascript
// Pour chaque groupe candidat, compter les autres membres affectes
const impactCount = await db.query(`
  SELECT COUNT(*) FROM iam_user_group WHERE group_id = ?
`, [groupId]);
```

---

## API Endpoints

### POST `/iam/explain`

**Request:**
```json
{
  "user_id": "usr_julien",
  "scope": "lms:admin:*"
}
```

**Response (denied):**
```json
{
  "granted": false,
  "reason": "Missing scope lms:admin:*",
  "current_permissions": [
    {"scope": "lms:course:read", "via_group": "Developers", "via_role": "developer"}
  ],
  "fix_options": [
    {
      "type": "add_to_group",
      "group_id": "grp_lms_admins",
      "group_name": "LMS Admins",
      "grants": ["lms:admin:*", "lms:course:*", "lms:student:*"],
      "impact": "Only affects this user"
    },
    {
      "type": "assign_role_to_group",
      "group_id": "grp_devs",
      "role_id": "role_lms_admin",
      "impact": "Affects 5 other users"
    }
  ]
}
```

**Response (granted):**
```json
{
  "granted": true,
  "paths": [
    {
      "user": "julien",
      "group": "Developers",
      "role": "developer",
      "permission": "vault:*"
    }
  ]
}
```

### POST `/iam/explain/fix`

Execute une des fix options.

**Request:**
```json
{
  "user_id": "usr_julien",
  "fix_type": "add_to_group",
  "group_id": "grp_lms_admins"
}
```

---

## UX Details

### Autocompletion User

- Recherche dans `iam_user.email` et `iam_user.display_name`
- Affiche avatar + email + org
- Limite 10 suggestions

### Autocompletion Scope

- Liste tous les scopes connus (permissions + app scopes)
- Grouper par namespace (`lms:*`, `vault:*`, etc.)
- Affiche description si disponible

### Fix Options - Ordre de priorite

1. **Minimal impact first** : Options qui n'affectent que l'user cible
2. **Existing patterns** : Utiliser des groupes/roles deja etablis
3. **Create new** : En dernier recours, creer un role custom

### Warning sur Actions Sensibles

```
┌────────────────────────────────────────────┐
│ ⚠️ Warning                                 │
│                                            │
│ Adding to "Administrators" grants          │
│ SUPERADMIN access to ALL applications.     │
│                                            │
│ [Cancel]  [I understand, proceed]          │
└────────────────────────────────────────────┘
```

---

## Edge Cases

| Cas | Comportement |
|-----|--------------|
| User inexistant | Erreur "User not found" |
| Scope invalide | Erreur "Unknown scope" |
| Permission via wildcard | Afficher "via manage:*" |
| Plusieurs chemins | Lister tous les chemins |
| Aucune fix possible | "Contact administrator" |
| User dans 10+ groupes | Paginer les options |

---

## Differenciateur vs Marche

| Aspect | Concurrence | TPB Vault |
|--------|-------------|-----------|
| Message d'erreur | "Access Denied" | Raison precise + chemin |
| Resolution | Documentation externe | Boutons d'action inline |
| Impact | Invisible | Preview avant action |
| UX | Debug manuel | Experience guidee |

