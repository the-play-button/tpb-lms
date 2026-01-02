# Access Graph - Visualisation Interactive

## Probleme Resolu

**Pain point marche** : Les IAM affichent des listes (users, groups, roles) mais jamais les RELATIONS entre eux. Comprendre "qui a acces a quoi via quoi" demande un puzzle mental.

- AWS IAM : Politique JSON, aucune visualisation
- Auth0 : Onglets separes pour Users, Roles, Permissions
- Okta : Navigation entre pages, pas de vue globale

---

## Concept

**Solution TPB Vault** : Visualisation interactive sous forme de graphe montrant les chemins d'acces :
- **Noeuds** : Users, Groups, Roles, Permissions
- **Aretes** : Relations (membership, assignment, grant)
- **Interactions** : Click pour details, highlight pour tracer un chemin

---

## Wireframe Principal

```
┌──────────────────────────────────────────────────────────────────────┐
│ Access Graph                                    [User ▼] [Scope ▼]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                         ┌─────────┐                                  │
│                         │ matthieu│                                  │
│                         └────┬────┘                                  │
│               ┌──────────────┼──────────────┐                        │
│               ▼              ▼              ▼                        │
│          ┌────────┐    ┌────────┐    ┌────────┐                     │
│          │ Admins │    │  Devs  │    │  LMS   │                     │
│          └───┬────┘    └───┬────┘    └───┬────┘                     │
│              ▼             ▼             ▼                          │
│         ┌─────────┐   ┌─────────┐   ┌─────────┐                     │
│         │superadmin│   │developer│   │lms_instr│                     │
│         └────┬─────┘   └────┬────┘   └────┬────┘                     │
│              ▼              ▼             ▼                          │
│         ┌─────────┐   ┌─────────┐   ┌─────────┐                     │
│         │ manage:*│   │ vault:* │   │  lms:*  │                     │
│         └─────────┘   └─────────┘   └─────────┘                     │
│                                                                      │
│  Mode: [User→Scopes]  [Scope→Users]  [Group→Members]                │
│                                                                      │
│  Legend: ○ User  □ Group  ◇ Role  ● Permission                      │
│                                                                      │
│  [Click node for details]  [Highlight path to scope]                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Modes de Visualisation

### Mode 1: User → Scopes (defaut)

Affiche un user au centre et tous ses chemins vers les permissions.

```
         matthieu
            │
     ┌──────┴──────┐
     ▼             ▼
  Admins        Devs
     │             │
     ▼             ▼
 superadmin    developer
     │             │
     ▼             ▼
  manage:*      vault:*
```

### Mode 2: Scope → Users

Affiche un scope et tous les users qui l'ont.

```
                vault:secret:*
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
    developer    superadmin    custom_role
        │            │            │
        ▼            ▼            ▼
      Devs        Admins       Special
        │            │            │
   ┌────┴────┐       │            │
   ▼    ▼    ▼       ▼            ▼
 juli  mari  bob  matthieu     alice
```

### Mode 3: Group → Members

Affiche un groupe et sa structure interne.

```
              Developers
                  │
     ┌────────────┼────────────┐
     │            │            │
     ▼            ▼            ▼
  julien       marie         bob
     │            │            │
     └────────────┼────────────┘
                  │
                  ▼
             developer (role)
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
    vault:*    lms:*    read:*
```

---

## Wireframe - Detail au Click

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│    ┌─────────────────────────────────────────────────────────────┐  │
│    │                                                             │  │
│    │  [Graph visualization...]                                   │  │
│    │                                                             │  │
│    │                 (click on Developers)                       │  │
│    │                                                             │  │
│    └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Group: Developers                                              │  │
│  │ ───────────────────                                            │  │
│  │ Organization: TPB                                              │  │
│  │ Members: 5                                                     │  │
│  │ Roles: developer, lms_viewer                                   │  │
│  │                                                                │  │
│  │ [View in Groups →]  [Highlight all members]                    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Mapping DB

### Construction du Graphe

```sql
-- Noeuds Users
SELECT id, email, 'user' as type FROM iam_user WHERE organization_id = ?

-- Noeuds Groups
SELECT id, name, 'group' as type FROM iam_group WHERE organization_id = ?

-- Noeuds Roles
SELECT id, name, 'role' as type FROM iam_role 
WHERE organization_id = ? OR organization_id IS NULL

-- Noeuds Permissions
SELECT id, action || ':' || resource as label, 'permission' as type 
FROM iam_permission

-- Aretes User → Group
SELECT user_id as source, group_id as target, 'member_of' as type 
FROM iam_user_group

-- Aretes Group → Role
SELECT group_id as source, role_id as target, 'has_role' as type 
FROM iam_group_role

-- Aretes Role → Permission
SELECT role_id as source, permission_id as target, 'grants' as type 
FROM iam_role_permission
```

### Highlight Path

Pour tracer le chemin entre un user et un scope :

```sql
-- Tous les chemins user → permission
WITH RECURSIVE paths AS (
  -- Base: user -> group
  SELECT 
    u.id as start_id,
    g.id as current_id,
    'group' as current_type,
    u.id || ' -> ' || g.id as path
  FROM iam_user u
  JOIN iam_user_group ug ON u.id = ug.user_id
  JOIN iam_group g ON ug.group_id = g.id
  WHERE u.id = ?
  
  UNION ALL
  
  -- Recursive: group -> role
  SELECT 
    p.start_id,
    r.id,
    'role',
    p.path || ' -> ' || r.id
  FROM paths p
  JOIN iam_group_role gr ON p.current_id = gr.group_id
  JOIN iam_role r ON gr.role_id = r.id
  WHERE p.current_type = 'group'
  
  UNION ALL
  
  -- Recursive: role -> permission
  SELECT 
    p.start_id,
    perm.id,
    'permission',
    p.path || ' -> ' || perm.id
  FROM paths p
  JOIN iam_role_permission rp ON p.current_id = rp.role_id
  JOIN iam_permission perm ON rp.permission_id = perm.id
  WHERE p.current_type = 'role'
)
SELECT * FROM paths WHERE current_type = 'permission' AND current_id = ?
```

---

## API Endpoints

### GET `/iam/graph/user/:id`

**Response:**
```json
{
  "nodes": [
    {"id": "usr_matthieu", "type": "user", "label": "matthieu@tpb.ai"},
    {"id": "grp_admins", "type": "group", "label": "Administrators"},
    {"id": "role_superadmin", "type": "role", "label": "superadmin"},
    {"id": "perm_manage_all", "type": "permission", "label": "manage:*"}
  ],
  "edges": [
    {"source": "usr_matthieu", "target": "grp_admins", "type": "member_of"},
    {"source": "grp_admins", "target": "role_superadmin", "type": "has_role"},
    {"source": "role_superadmin", "target": "perm_manage_all", "type": "grants"}
  ]
}
```

### GET `/iam/graph/scope/:scope`

Graphe inverse : qui a ce scope ?

### GET `/iam/graph/group/:id`

Structure d'un groupe specifique.

---

## UX Interactions

| Action | Comportement |
|--------|--------------|
| Click node | Affiche panel detail |
| Double-click node | Navigue vers la vue correspondante |
| Hover node | Highlight connections directes |
| Click "Highlight path" | Colore le chemin vers un scope |
| Drag node | Repositionne (layout manuel) |
| Scroll | Zoom in/out |
| Mode switch | Reconstruit le graphe depuis autre perspective |

### Couleurs des Noeuds

| Type | Couleur | Icone |
|------|---------|-------|
| User | Bleu | ○ |
| Group | Vert | □ |
| Role | Orange | ◇ |
| Permission | Violet | ● |

### Etat des Aretes

| Etat | Style |
|------|-------|
| Normal | Ligne grise fine |
| Highlighted | Ligne bleue epaisse |
| Selected | Ligne bleue + animation pulse |

---

## Implementation Technique

### Librairie Recommandee

- **D3.js** : Force-directed graph layout
- Ou **Cytoscape.js** : Plus simple pour les graphes IAM

### Layout Algorithm

Force-directed avec :
- Users en haut
- Groups au milieu
- Roles en bas
- Permissions tout en bas

```javascript
const simulation = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(edges).distance(100))
  .force("charge", d3.forceManyBody().strength(-200))
  .force("y", d3.forceY(d => {
    if (d.type === 'user') return 0;
    if (d.type === 'group') return 200;
    if (d.type === 'role') return 400;
    return 600; // permission
  }));
```

---

## Edge Cases

| Cas | Comportement |
|-----|--------------|
| User dans 10+ groups | Regrouper visuellement |
| > 50 noeuds | Collapse automatique + expand on click |
| Cycle (ne devrait pas arriver) | Detecter et afficher warning |
| Permission wildcard | Noeud special avec badge "*" |
| Graphe vide | Message "No permissions assigned" |

---

## Integration

| Page | Integration |
|------|-------------|
| Dashboard | Widget "Quick Access Graph" pour user courant |
| User Detail | Bouton "View in Access Graph" |
| Group Detail | Bouton "View in Access Graph" |
| Role Detail | Bouton "View in Access Graph" |
| Explain Mode | Link vers graphe avec highlight |

---

## Performance

- **Cache** : Graphe cache 5 min par user/scope
- **Lazy loading** : Expand nodes on demand si > 20 connexions
- **Server-side layout** : Pre-calculer positions pour gros graphes

