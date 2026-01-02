# What-If Simulator - Preview Avant Changement

## Probleme Resolu

**Pain point marche** : Les changements IAM sont irreversibles et leurs impacts sont invisibles jusqu'a ce qu'un user se plaigne.

- "J'ai ajoute X au groupe Admin et maintenant il peut tout supprimer"
- "J'ai retire un role et 50 users ont perdu l'acces"
- Aucun filet de securite

---

## Concept

**Solution TPB Vault** : Simuler l'impact d'un changement AVANT de l'appliquer :

1. **Preview des permissions** : Ce que l'user va gagner/perdre
2. **Impact scope** : Combien d'users/ressources sont affectes
3. **Warnings** : Alertes sur actions sensibles (superadmin, etc.)
4. **Apply ou Cancel** : Decision eclairee

---

## Wireframe Principal

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🧪 What-If Simulator                                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Simulate: [Add user to group ▼]                                    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ User: [julien@acme.com                                    ▼]  │ │
│  │ Group: [Administrators                                    ▼]  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  [Simulate Impact]                                                  │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  Preview of changes for julien@acme.com:                            │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Permissions GAINED:                                          │ │
│  │  + manage:*              Full administrative access            │ │
│  │  + billing:*             Access to billing                     │ │
│  │  + read:audit            View audit logs                       │ │
│  │                                                                │ │
│  │  Permissions UNCHANGED:                                        │ │
│  │  ● lms:course:read       (already has via Developers)         │ │
│  │  ● vault:secret:read     (already has via Developers)         │ │
│  │                                                                │ │
│  │  New capabilities:                                             │ │
│  │  • Can delete users                                           │ │
│  │  • Can revoke any service token                               │ │
│  │  • Can access Cloudflare Dashboard                            │ │
│  │  • Can manage all applications                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ⚠️ WARNING                                                         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ This grants SUPERADMIN access to julien@acme.com               │ │
│  │ julien will have full control over ALL resources               │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Affected resources:                                                │
│  • 8 applications (can now manage)                                  │
│  • 45 users (can now edit/delete)                                   │
│  • All secrets (can now read/write)                                 │
│                                                                      │
│  [Cancel]                                    [Apply Change]         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Actions Simulables

### 1. Add user to group

```
Simulate: [Add user to group ▼]
User: [___________]
Group: [___________]
```

### 2. Remove user from group

```
Simulate: [Remove user from group ▼]
User: [___________]
Group: [___________]
```

### 3. Assign role to group

```
Simulate: [Assign role to group ▼]
Role: [___________]
Group: [___________]
```

### 4. Remove role from group

```
Simulate: [Remove role from group ▼]
Role: [___________]
Group: [___________]
```

### 5. Add permission to role

```
Simulate: [Add permission to role ▼]
Permission: [___________]
Role: [___________]
```

### 6. Delete user

```
Simulate: [Delete user ▼]
User: [___________]
```

---

## Wireframe - Remove Simulation

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🧪 What-If Simulator                                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Simulate: [Remove role from group ▼]                               │
│                                                                      │
│  Role: [developer              ▼]                                   │
│  Group: [Developers            ▼]                                   │
│                                                                      │
│  [Simulate Impact]                                                  │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  ⚠️ This change affects 5 users:                                    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Users losing permissions:                                     │ │
│  │                                                                │ │
│  │  • julien@tpb.ai         loses: vault:*, lms:*                │ │
│  │  • marie@tpb.ai          loses: vault:*, lms:*                │ │
│  │  • bob@tpb.ai            loses: vault:*, lms:*                │ │
│  │  • alice@tpb.ai          loses: vault:*, lms:*                │ │
│  │  • charlie@tpb.ai        loses: vault:*, lms:*                │ │
│  │                                                                │ │
│  │  Note: matthieu@tpb.ai keeps access via "Administrators"      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Impact summary:                                                    │
│  • 5 users lose vault:secret:* access                              │
│  • 5 users lose lms:* access                                       │
│  • 5 users will NOT be able to access Vault API anymore            │
│                                                                      │
│  [Cancel]                                    [Apply Change]         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### 1. Standalone Page

`/insights/what-if` - Pour exploration libre.

### 2. Modale Contextuelle

Declenchee automatiquement avant actions sensibles :

```javascript
// Dans le code UI
const isSensitiveAction = (action, target) => {
  // Add to admin group
  if (action === 'add_to_group' && target.hasRole('superadmin')) return true;
  // Assign superadmin role
  if (action === 'assign_role' && target.role === 'superadmin') return true;
  // Remove from any group with > 5 members affected
  if (action === 'remove_role' && affectedUsers > 5) return true;
  return false;
};

if (isSensitiveAction(action, target)) {
  showWhatIfModal(action, target);
} else {
  executeAction(action, target);
}
```

### 3. Depuis Explain Mode

Link "What if we add X to group Y?" → pre-remplit le simulateur.

### 4. Depuis Permissions Matrix

Click cellule ○ → popup → "Simulate granting this permission".

---

## Mapping DB

### Calcul des Permissions Actuelles

```sql
-- Permissions actuelles d'un user
SELECT DISTINCT p.action || ':' || p.resource as scope
FROM iam_permission p
JOIN iam_role_permission rp ON p.id = rp.permission_id
JOIN iam_group_role gr ON rp.role_id = gr.role_id
JOIN iam_user_group ug ON gr.group_id = ug.group_id
WHERE ug.user_id = ?
```

### Simulation "Add to Group"

```sql
-- Permissions que le user AURAIT apres ajout au groupe
SELECT DISTINCT p.action || ':' || p.resource as scope
FROM iam_permission p
JOIN iam_role_permission rp ON p.id = rp.permission_id
JOIN iam_group_role gr ON rp.role_id = gr.role_id
WHERE gr.group_id = ?  -- Le groupe cible
```

### Simulation "Remove Role from Group"

```sql
-- Users affectes par le retrait du role
SELECT u.id, u.email
FROM iam_user u
JOIN iam_user_group ug ON u.id = ug.user_id
WHERE ug.group_id = ?  -- Le groupe
AND NOT EXISTS (
  -- Exclure ceux qui ont ce role via un AUTRE groupe
  SELECT 1 FROM iam_user_group ug2
  JOIN iam_group_role gr ON ug2.group_id = gr.group_id
  WHERE ug2.user_id = u.id
  AND gr.role_id = ?
  AND ug2.group_id != ?
)
```

---

## API Endpoints

### POST `/iam/simulate`

**Request:**
```json
{
  "action": "add_to_group",
  "user_id": "usr_julien",
  "group_id": "grp_admins"
}
```

**Response:**
```json
{
  "affected_users": [
    {
      "user_id": "usr_julien",
      "email": "julien@acme.com",
      "permissions_gained": ["manage:*", "billing:*", "read:audit"],
      "permissions_lost": [],
      "permissions_unchanged": ["lms:course:read", "vault:secret:read"]
    }
  ],
  "warnings": [
    {
      "level": "critical",
      "message": "This grants SUPERADMIN access",
      "details": "julien will have full control over ALL resources"
    }
  ],
  "impact_summary": {
    "users_affected": 1,
    "applications_accessible": 8,
    "resources_manageable": 45
  }
}
```

### POST `/iam/simulate/impact`

Pour calculer l'impact sans specifier un user (ex: "assign role to group").

**Request:**
```json
{
  "action": "assign_role",
  "role_id": "role_admin",
  "group_id": "grp_devs"
}
```

**Response:**
```json
{
  "affected_users": [
    {"email": "julien@tpb.ai", "gains": ["manage:user", "manage:group"]},
    {"email": "marie@tpb.ai", "gains": ["manage:user", "manage:group"]},
    // ... 5 users
  ],
  "total_affected": 5,
  "warnings": []
}
```

---

## Warnings System

### Niveaux

| Niveau | Declencheur | Affichage |
|--------|-------------|-----------|
| Info | Changement mineur | Texte bleu |
| Warning | > 5 users affectes | Badge jaune |
| Critical | Superadmin ou > 20 users | Banner rouge |

### Conditions de Warning

```javascript
const getWarnings = (simulation) => {
  const warnings = [];
  
  // Superadmin grant
  if (simulation.permissions_gained.includes('manage:*')) {
    warnings.push({
      level: 'critical',
      message: 'This grants SUPERADMIN access'
    });
  }
  
  // Many users affected
  if (simulation.affected_users.length > 20) {
    warnings.push({
      level: 'critical',
      message: `This affects ${simulation.affected_users.length} users`
    });
  } else if (simulation.affected_users.length > 5) {
    warnings.push({
      level: 'warning',
      message: `This affects ${simulation.affected_users.length} users`
    });
  }
  
  // Removing last admin
  if (simulation.action === 'remove_from_group' 
      && simulation.group.hasRole('superadmin')
      && simulation.remaining_admins === 0) {
    warnings.push({
      level: 'critical',
      message: 'This will leave no administrators!'
    });
  }
  
  return warnings;
};
```

---

## UX Interactions

| Action | Comportement |
|--------|--------------|
| Select action type | Change le formulaire |
| Simulate Impact | Appel API, affiche preview |
| Cancel | Ferme sans action |
| Apply Change | Execute l'action reelle, notifie succes |
| Click user affecte | Navigue vers user detail |
| Click permission | Tooltip avec description |

---

## Edge Cases

| Cas | Comportement |
|-----|--------------|
| User deja dans le groupe | Message "No change - already member" |
| Role deja assigne | Message "No change - role already assigned" |
| Simulation identique a l'actuel | "No permissions change" |
| > 100 users affectes | Paginer, afficher "and X more" |
| Action bloquee par policy | Erreur "Cannot simulate - permission denied" |
| Dernier admin | Warning critique + confirmation double |

---

## Differenciateur vs Marche

| Aspect | Concurrence | TPB Vault |
|--------|-------------|-----------|
| Preview | Aucun | Impact complet avant action |
| Warnings | Post-facto | Pre-action, explicite |
| Rollback | Difficile | "Undo" via audit log |
| UX | "Are you sure?" | Details actionables |

