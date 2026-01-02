# Dashboard

## Objectif

Vue d'ensemble de l'etat IAM : metriques cles, alertes drift, activite recente.

---

## Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│ Dashboard                                                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │    12    │  │    45    │  │     8    │  │     3    │             │
│  │   Orgs   │  │  Users   │  │   Apps   │  │  Alerts  │             │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘             │
│                                                                      │
│  ┌─────────────────────────────────┐  ┌───────────────────────────┐ │
│  │ Drift Alerts                    │  │ Quick Actions             │ │
│  │ ────────────                    │  │ ─────────────             │ │
│  │ ⚠️ LMS Instructors: 2 missing   │  │ [+ New User]              │ │
│  │ ✓ Administrators: in sync      │  │ [+ New Application]       │ │
│  │                     [View All]  │  │ [Sync Audiences]          │ │
│  └─────────────────────────────────┘  └───────────────────────────┘ │
│                                                                      │
│  Recent Activity                                                     │
│  ────────────────                                                    │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ 10:15  matthieu@tpb added julien@acme to "Developers"          │ │
│  │ 10:12  service_token rotated for "TPB LMS"                     │ │
│  │ 10:00  marie@tpb created application "Analytics"               │ │
│  │ 09:45  system synced audiences to Cloudflare                   │ │
│  │                                                    [View All →] │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Mapping DB

| Section | Table(s) | Query |
|---------|----------|-------|
| Orgs count | `iam_organization` | `SELECT COUNT(*) FROM iam_organization` |
| Users count | `iam_user` | `SELECT COUNT(*) FROM iam_user WHERE status = 'active'` |
| Apps count | `iam_application` | `SELECT COUNT(*) FROM iam_application WHERE status = 'active'` |
| Alerts count | `sys_infra_state` | `SELECT COUNT(*) FROM sys_infra_state WHERE sync_status = 'drift'` |
| Drift Alerts | `sys_infra_state` | `SELECT * FROM sys_infra_state WHERE sync_status != 'synced' LIMIT 5` |
| Recent Activity | `sys_audit_log` | `SELECT * FROM sys_audit_log ORDER BY created_at DESC LIMIT 10` |

---

## Etats

### Loading
```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  ░░░░░░  │  │  ░░░░░░  │  │  ░░░░░░  │  │  ░░░░░░  │
│  ░░░░░░  │  │  ░░░░░░  │  │  ░░░░░░  │  │  ░░░░░░  │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```
Skeleton loaders pour chaque card.

### Empty (nouvel environnement)
```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  👋 Welcome to TPB Vault!                                          │
│                                                                    │
│  Get started by:                                                   │
│  1. [Creating your first user]                                     │
│  2. [Registering an application]                                   │
│  3. [Setting up groups and roles]                                  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Error
Toaster notification + retry button.

---

## Interactions

| Action | Comportement |
|--------|--------------|
| Click sur card metrique | Navigue vers la vue correspondante |
| Click "View All" (Drift) | Navigue vers `/insights/drift` |
| Click "View All" (Activity) | Navigue vers `/insights/audit` |
| Click Quick Action | Ouvre modale de creation |
| Click ligne activity | Navigue vers le detail de l'entite concernee |

---

## Permissions

| Action | Permission Requise |
|--------|-------------------|
| Voir dashboard | Tout utilisateur authentifie |
| Voir toutes les orgs | `manage:*` ou superadmin |
| Quick actions | Selon l'action (create user = `manage:user`) |

---

## Edge Cases

| Cas | Comportement |
|-----|--------------|
| 0 drift alerts | Card verte "All synced ✓" |
| 0 recent activity | Message "No recent activity" |
| User sans org | Affiche uniquement son org |
| >100 drifts | Affiche "99+" avec warning |

---

## Refresh

- Auto-refresh toutes les 30 secondes
- Bouton refresh manuel dans le header
- WebSocket pour les alertes critiques (future)

