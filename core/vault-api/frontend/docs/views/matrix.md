# Permissions Matrix

## Objectif

Vue synthetique debug : afficher une matrice User x Scopes pour visualiser rapidement qui a acces a quoi. Cliquer sur une cellule pour comprendre la source de la permission.

---

## Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│ Permissions Matrix                                                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Org: TPB ▼]  [App: All ▼]  [Search user...]                       │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                │ manage:* │ lms:* │ vault:* │ billing:read │    │ │
│  ├────────────────┼──────────┼───────┼─────────┼──────────────┤    │ │
│  │ matthieu@tpb   │    ●     │   ●   │    ●    │      ●       │    │ │
│  │ julien@tpb     │    ○     │   ●   │    ○    │      ○       │    │ │
│  │ marine@tpb     │    ○     │   ●   │    ●    │      ○       │    │ │
│  │ bob@acme       │    ○     │   ○   │    ○    │      ○       │    │ │
│  │ alice@acme     │    ○     │   ●   │    ○    │      ○       │    │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Legend:  ● Granted (click for source)  ○ Not granted              │
│                                                                      │
│  [< Prev]  Page 1 of 5  [Next >]        Showing 20 users            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Wireframe - Popup Source (au clic sur cellule)

```
┌─────────────────────────────────────────┐
│ julien@tpb → lms:*                      │
├─────────────────────────────────────────┤
│                                         │
│ Permission granted via:                 │
│                                         │
│ Path:                                   │
│ julien → Developers → developer → lms:* │
│                                         │
│ Details:                                │
│ • Group: Developers                     │
│ • Role: developer                       │
│ • Permission: manage:lms (lms:*)        │
│                                         │
│ [View User]  [View Group]  [View Role]  │
│                                         │
│ [Why doesn't have X? →]                 │
│                                         │
└─────────────────────────────────────────┘
```

---

## Wireframe - Cell Not Granted (au clic)

```
┌─────────────────────────────────────────┐
│ julien@tpb → manage:*                   │
├─────────────────────────────────────────┤
│                                         │
│ ❌ Permission NOT granted               │
│                                         │
│ julien is not in any group with         │
│ the "manage:*" permission.              │
│                                         │
│ To grant this permission:               │
│ • Add julien to "Administrators"        │
│ • Or assign role "superadmin" to        │
│   one of julien's groups                │
│                                         │
│ [Add to Administrators]                 │
│ [Use What-If Simulator →]               │
│                                         │
└─────────────────────────────────────────┘
```

---

## Mapping DB

### Calcul de la Matrice

La matrice est calculee dynamiquement via JOIN :

```sql
-- Pour chaque user, calculer ses permissions effectives
SELECT 
    u.id as user_id,
    u.email,
    p.action || ':' || p.resource as scope,
    g.name as via_group,
    r.name as via_role
FROM iam_user u
JOIN iam_user_group ug ON u.id = ug.user_id
JOIN iam_group g ON ug.group_id = g.id
JOIN iam_group_role gr ON g.id = gr.group_id
JOIN iam_role r ON gr.role_id = r.id
JOIN iam_role_permission rp ON r.id = rp.role_id
JOIN iam_permission p ON rp.permission_id = p.id
WHERE u.organization_id = ?
ORDER BY u.email, scope
```

### Colonnes Dynamiques

Les colonnes (scopes) sont determinees par :
1. Toutes les permissions distinctes dans `iam_permission`
2. Ou filtrees par application (`namespace:*`)

```sql
-- Liste des scopes pour les colonnes
SELECT DISTINCT action || ':' || resource as scope
FROM iam_permission
ORDER BY resource, action
```

### Query Source d'une Permission

```sql
SELECT 
    g.id as group_id,
    g.name as group_name,
    r.id as role_id,
    r.name as role_name,
    p.id as permission_id,
    p.action || ':' || p.resource as scope
FROM iam_user_group ug
JOIN iam_group g ON ug.group_id = g.id
JOIN iam_group_role gr ON g.id = gr.group_id
JOIN iam_role r ON gr.role_id = r.id
JOIN iam_role_permission rp ON r.id = rp.role_id
JOIN iam_permission p ON rp.permission_id = p.id
WHERE ug.user_id = ?
AND (p.action || ':' || p.resource = ? OR p.resource = '*')
```

---

## Etats

### Matrice vide
```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  No users with permissions found.                                  │
│                                                                    │
│  Start by:                                                         │
│  1. Creating users                                                 │
│  2. Adding them to groups                                          │
│  3. Assigning roles to groups                                      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Loading
Skeleton matrix avec colonnes grises.

### Trop de colonnes
```
┌────────────────────────────────────────────────────────────────────┐
│ ⚠️ Too many scopes to display (45)                                 │
│                                                                    │
│ Filter by application to reduce columns:                          │
│ [App: All ▼] → Select specific app                                │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Interactions

| Action | Comportement |
|--------|--------------|
| Click cellule ● | Popup avec source de la permission |
| Click cellule ○ | Popup avec explication + fix options |
| Filter Org | Recalcule matrice pour cette org |
| Filter App | Filtre colonnes sur `namespace:*` scopes |
| Search user | Filtre lignes sur `email` |
| View User | Navigue vers `/identity/users/:id` |
| View Group | Navigue vers `/identity/groups/:id` |
| View Role | Navigue vers `/identity/roles` |
| Why doesn't have | Navigue vers Explain Mode |
| What-If Simulator | Navigue vers `/insights/what-if?user=X&action=add_to_group` |

---

## Permissions

| Action | Permission Requise |
|--------|-------------------|
| Voir la matrice | `read:user` + `read:role` |
| Voir toutes les orgs | `manage:*` ou superadmin |
| Actions depuis popup | Selon l'action (add to group = `manage:group`) |

---

## Filtres

| Filtre | Effet |
|--------|-------|
| Org | Filtre users par `organization_id` |
| App | Filtre colonnes par `namespace` prefix |
| Search | Filtre lignes par `email` (contains) |

---

## Pagination

| Element | Comportement |
|---------|--------------|
| Users (lignes) | Pagination 20 par page |
| Scopes (colonnes) | Scroll horizontal si > 10 colonnes |

---

## Performance

### Optimisations

1. **Cache**: Matrice cachee 5 minutes, invalidee sur changement IAM
2. **Lazy loading**: Colonnes chargees a la demande si > 20
3. **Materialized view** (future): Pre-calculer `user_effective_permissions`

### Query Complexity

- Best case: O(users * groups * roles * permissions)
- Avec index: ~50ms pour 1000 users, 10 scopes

---

## Edge Cases

| Cas | Comportement |
|-----|--------------|
| User sans groupe | Ligne avec tous ○ |
| Permission wildcard `*:*` | ● sur toutes les colonnes |
| Scope inherited (via `*`) | Badge "via wildcard" |
| > 100 users | Pagination obligatoire |
| > 30 scopes | Warning + filtre app suggere |
| Permission via plusieurs chemins | Liste tous les chemins dans popup |

---

## Integration Explain Mode

La matrice est le point d'entree naturel vers Explain Mode :

1. User voit ○ sur une cellule
2. Click → popup "Permission NOT granted"
3. Link "Why doesn't have X?" → `/explain?user=Y&scope=X`
4. Explain Mode donne solutions detaillees

