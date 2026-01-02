# Navigation et Sitemap

## Structure de Navigation

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🔐 TPB Vault          │ Org: [Dropdown]     │ user@email │ [Logout] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Dashboard]  [Identity]  [Access]  [Insights]  [Settings]          │
│                  │           │          │                            │
│                  ├─ Users    ├─ Apps    ├─ Access Graph              │
│                  ├─ Groups   ├─ Tokens  ├─ What-If                   │
│                  └─ Roles    └─ Matrix  ├─ Audit Stories             │
│                                         └─ Drift Detection           │
│                                                                      │
│  🔍 [Why can't ... access ... ?]              ← Global Explain Mode │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Sitemap Complet

```
/                              → Dashboard (metriques, alertes, activity)

/organizations                 → Liste des tenants
/organizations/:id             → Detail org

/identity/users                → Liste users
/identity/users/:id            → Detail user (side panel ou page)
/identity/groups               → Liste groups  
/identity/groups/:id           → Detail group
/identity/roles                → Roles & Permissions (master-detail)

/access/applications           → Liste apps OAuth
/access/applications/:id       → Detail app
/access/tokens                 → Service tokens (my tokens + admin view)
/access/matrix                 → Permissions Matrix (User x Scope)

/insights/graph                → Access Graph (visualisation interactive)
/insights/what-if              → What-If Simulator (standalone)
/insights/audit                → Audit Stories
/insights/drift                → Drift Detection

/explain?user=X&scope=Y        → Explain Mode (deep link)

/settings/organizations        → Gestion orgs (superadmin only)
/settings/integrations         → Connexions externes (future)
```

---

## Header

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  [Logo TPB Vault]                                                    │
│                                                                      │
│  ┌──────────────────────────────────┐                               │
│  │ Org: The Play Button         ▼  │  ← Org switcher (si multi)    │
│  └──────────────────────────────────┘                               │
│                                                                      │
│  [matthieu@tpb.ai ▼]  ← User menu                                   │
│    • Mon profil                                                      │
│    • Mes tokens                                                      │
│    • Deconnexion                                                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Comportements

| Element | Comportement |
|---------|--------------|
| Logo | Retour au Dashboard |
| Org Switcher | Visible si user a acces a plusieurs orgs |
| User Menu | Dropdown avec actions self-service |

---

## Sidebar (Navigation Principale)

```
┌────────────────────────┐
│                        │
│  📊 Dashboard          │
│                        │
│  IDENTITY              │
│  ─────────             │
│  👤 Users              │
│  👥 Groups             │
│  🔑 Roles              │
│                        │
│  ACCESS                │
│  ──────                │
│  📱 Applications       │
│  🎫 Service Tokens     │
│  📋 Matrix             │
│                        │
│  INSIGHTS              │
│  ────────              │
│  🕸️ Access Graph       │
│  🧪 What-If            │
│  📖 Audit Stories      │
│  ⚠️ Drift Detection    │
│                        │
│  ─────────             │
│  ⚙️ Settings           │
│                        │
└────────────────────────┘
```

### Etats Visuels

| Etat | Style |
|------|-------|
| Item actif | Background highlight + bordure gauche |
| Item avec alerte | Badge rouge (ex: Drift Detection avec 2 drifts) |
| Section | Titre gris uppercase, non-cliquable |

---

## Global Search (Explain Mode)

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  🔍 Why can't [_______________] access [_______________] ?          │
│                                                                      │
│  Suggestions:                                                       │
│  • julien@acme.com                                                  │
│  • marie@tpb.ai                                                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Comportements

1. **Autocompletion user** : Recherche dans `iam_user.email`
2. **Autocompletion scope** : Liste des scopes connus (permissions + app scopes)
3. **Enter** : Navigue vers `/explain?user=X&scope=Y`

---

## Responsive Considerations

| Breakpoint | Comportement |
|------------|--------------|
| Desktop (>1200px) | Sidebar visible, content full width |
| Tablet (768-1200px) | Sidebar collapsible, icons only |
| Mobile (<768px) | Hamburger menu, sidebar drawer |

---

## Breadcrumbs

```
Dashboard > Identity > Users > matthieu@tpb.ai
```

### Regles

- Toujours afficher le chemin complet
- Chaque segment est cliquable
- Maximum 4 niveaux

---

## Quick Actions (Context-Aware)

Sur chaque page, des actions rapides contextuelles :

| Page | Quick Actions |
|------|---------------|
| Dashboard | + New User, + New App, Sync All |
| Users | + Invite User, Bulk Actions |
| Groups | + New Group |
| Applications | + Register App |
| Tokens | + Generate Token |

