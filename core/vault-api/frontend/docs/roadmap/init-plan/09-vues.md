# Inventaire des Vues & Features

## 8 Vues IAM

| # | Vue | Description | Endpoints | Composants cles |
|---|-----|-------------|-----------|-----------------|
| 1 | **Dashboard** | Home : metriques, alertes drift, activity | Counts + `sys_audit_log` | `MetricCard`, `DriftAlert`, `ActivityList` |
| 2 | **Tokens** | Service tokens M2M, self-service + admin | `GET/POST/DELETE /iam/service-tokens` | `TokenCard`, `GenerateModal`, `CredentialsDisplay` |
| 3 | **Applications** | OAuth clients, audiences, sync status | `GET/POST/PATCH/DELETE /iam/applications` | `AppCard`, `CreateModal`, `AudiencesList`, `SyncButton` |
| 4 | **Users** | Liste + detail side panel, effective perms | `GET/POST/PATCH/DELETE /iam/users` | `UserRow`, `UserDetailPanel`, `EffectivePerms` |
| 5 | **Groups** | Liste + detail, sync CF Access | `GET/POST/PATCH/DELETE /iam/groups` | `GroupRow`, `GroupDetailPanel`, `MembersList`, `DriftBadge` |
| 6 | **Roles** | Master-detail, permissions assignment | `GET/POST/PATCH/DELETE /iam/roles` | `RolesList`, `RoleDetail`, `PermissionsCheckbox` |
| 7 | **Organizations** | Multi-tenant (superadmin only) | `GET/POST/PATCH/DELETE /iam/organizations` | `OrgRow`, `OrgDetailPanel`, `StatsWidget` |
| 8 | **Matrix** | Permissions debug User x Scopes | `POST /iam/effective-permissions` | `MatrixGrid`, `CellPopup`, `PathDisplay` |

---

## 4 Features Differenciantes

| # | Feature | Pain Point Resolu | Endpoints | Valeur Enterprise |
|---|---------|-------------------|-----------|-------------------|
| 1 | **Explain Mode** | "Access Denied" sans contexte | `POST /iam/explain`, `/explain/fix` | Fin tickets support IAM |
| 2 | **Drift Detection** | Sync CF = boite noire | `GET/POST /iam/drift`, `/drift/sync` | Zero surprise en prod |
| 3 | **Access Graph** | Puzzle mental IAM | `GET /iam/graph/user/:id`, `/graph/scope/:scope` | Audit visuel instantane |
| 4 | **What-If** | Changements sans filet | `POST /iam/simulate` | Zero regression IAM |

---

## Composants Reutilisables (identifies)

Ces composants apparaitront dans `common/` puis seront promus vers `tpb/` :

| Composant | Utilise dans | Description |
|-----------|--------------|-------------|
| `DataTable` | Users, Groups, Tokens, Apps, Orgs | Table avec tri, filtre, pagination, selection |
| `DetailSidePanel` | Users, Groups, Apps | Panel lateral pour detail entity |
| `StatusBadge` | Partout | Badge avec couleur selon status |
| `SyncStatusBadge` | Groups, Apps, Drift | Badge sync (synced/drift/error) |
| `EmptyState` | Toutes les listes | Etat vide avec CTA |
| `ConfirmModal` | Actions destructives | Modal de confirmation |
| `CopyBlock` | Tokens, Apps | Code block avec bouton copy |
| `StatsCard` | Dashboard, Apps, CF | Card metrique avec label + valeur |
| `ActionDropdown` | Tables | Dropdown actions par row |
| `SearchInput` | Toutes les listes | Input recherche avec debounce |
| `FilterBar` | Listes complexes | Barre de filtres combinables |
| `Breadcrumbs` | Shell | Navigation hierarchique |
| `OrgSwitcher` | Header | Dropdown switch organisation |
| `AccountSwitcher` | Header | Dropdown switch compte (multi-compte) |

---

## Navigation Enterprise Complete

```
Nav: [Dashboard] [Identity] [Access] [Insights] [Settings]
                    |           |         |          |
                    +- Users    +- Apps   +- Graph   +- Organizations
                    +- Groups   +- Tokens +- What-If    
                    +- Roles    +- Matrix +- Explain
                                          +- Drift
```

---

## Routes Completes

```
/                              -> Redirect vers /dashboard
/dashboard                     -> Dashboard (metriques, alertes, activity)

/identity/users                -> Liste users
/identity/users/:id            -> Detail user (side panel)
/identity/groups               -> Liste groups  
/identity/groups/:id           -> Detail group
/identity/roles                -> Roles & Permissions (master-detail)

/access/applications           -> Liste apps OAuth
/access/applications/:id       -> Detail app
/access/tokens                 -> Service tokens (my tokens + admin view)
/access/matrix                 -> Permissions Matrix (User x Scope)

/insights/graph                -> Access Graph (visualisation interactive)
/insights/what-if              -> What-If Simulator
/insights/audit                -> Audit Stories (future)
/insights/drift                -> Drift Detection

/explain?user=X&scope=Y        -> Explain Mode (deep link)

/settings/organizations        -> Gestion orgs (superadmin only)
```

