# Arborescence CIBLE

> Cette arborescence represente l'etat final souhaite. On y arrive organiquement, pas en creant tout d'avance.

## Structure Complete

```
lms/core/vault-api/frontend/
├── _to_refacto/                              # Phase 0 : Code existant a porter
│   ├── README.md                             # Mapping existant -> cible
│   ├── TPB_STYLES.css
│   ├── tokens/
│   ├── applications/
│   └── cloudflare/
│
├── src/
│   ├── _migrate_to_backend/                  # Pattern Interception Centralise
│   │   ├── index.ts                          # Export unique : intercept()
│   │   ├── registry.ts                       # PENDING_ENDPOINTS
│   │   ├── intercept.ts                      # Logique matching
│   │   ├── handlers/                         # Logique temporaire par endpoint
│   │   │   └── *.ts
│   │   └── specs/                            # Documentation pour backend
│   │       └── *.spec.md
│   │
│   ├── app/
│   │   ├── [locale]/                         # next-intl routing
│   │   │   ├── layout.tsx                    # Shell avec Header/Sidebar
│   │   │   ├── page.tsx                      # Redirect vers Dashboard
│   │   │   │
│   │   │   │   # === 8 VUES IAM ===
│   │   │   │
│   │   │   ├── Dashboard/                    # Home : metriques, alertes, activity
│   │   │   │   ├── page.tsx                  # Entry (~20 lignes)
│   │   │   │   ├── Dashboard.components/     # RENDER ONLY - Se peuple au besoin
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── MetricCard.tsx
│   │   │   │   │   ├── DriftAlerts.tsx
│   │   │   │   │   ├── QuickActions.tsx
│   │   │   │   │   └── ActivityList.tsx
│   │   │   │   ├── Dashboard.logic/          # UI STATE ONLY
│   │   │   │   │   ├── index.ts
│   │   │   │   │   └── useDashboardState.ts  # loading, error, refresh
│   │   │   │   └── Dashboard.constants/
│   │   │   │
│   │   │   ├── Tokens/                       # Service tokens M2M
│   │   │   │   ├── page.tsx
│   │   │   │   ├── Tokens.components/        # RENDER ONLY
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── TokenCard.tsx
│   │   │   │   │   ├── TokensList.tsx
│   │   │   │   │   ├── GenerateTokenModal.tsx
│   │   │   │   │   └── CredentialsDisplay.tsx
│   │   │   │   ├── Tokens.logic/             # UI STATE ONLY
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── useTokensState.ts     # loading, selection, modal state
│   │   │   │   │   └── useGenerateModal.ts   # modal open/close, form state
│   │   │   │   └── Tokens.functions/         # UI FORMATTERS ONLY
│   │   │   │       ├── index.ts
│   │   │   │       └── formatTokenForDisplay.ts
│   │   │   │
│   │   │   ├── Applications/                 # OAuth clients
│   │   │   │   ├── page.tsx
│   │   │   │   ├── Applications.components/  # RENDER ONLY
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── ApplicationCard.tsx
│   │   │   │   │   ├── ApplicationsGrid.tsx
│   │   │   │   │   ├── CreateAppModal.tsx
│   │   │   │   │   ├── AppDetailsModal.tsx
│   │   │   │   │   ├── CredentialsModal.tsx
│   │   │   │   │   ├── AudiencesList.tsx
│   │   │   │   │   └── StatsCards.tsx
│   │   │   │   ├── Applications.logic/       # UI STATE ONLY
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── useAppsState.ts
│   │   │   │   │   └── useCreateModal.ts
│   │   │   │   └── Applications.constants/
│   │   │   │
│   │   │   ├── Users/                        # User management
│   │   │   │   ├── page.tsx
│   │   │   │   ├── Users.components/         # RENDER ONLY
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── UserRow.tsx
│   │   │   │   │   ├── UserDetailPanel.tsx
│   │   │   │   │   ├── EffectivePerms.tsx
│   │   │   │   │   └── CreateUserModal.tsx
│   │   │   │   └── Users.logic/              # UI STATE ONLY
│   │   │   │       ├── index.ts
│   │   │   │       └── useUsersState.ts
│   │   │   │
│   │   │   ├── Groups/                       # Group management + CF sync
│   │   │   │   ├── page.tsx
│   │   │   │   ├── Groups.components/        # RENDER ONLY
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── GroupRow.tsx
│   │   │   │   │   ├── GroupDetailPanel.tsx
│   │   │   │   │   ├── MembersList.tsx
│   │   │   │   │   └── CreateGroupModal.tsx
│   │   │   │   └── Groups.logic/             # UI STATE ONLY
│   │   │   │       ├── index.ts
│   │   │   │       └── useGroupsState.ts
│   │   │   │
│   │   │   ├── Roles/                        # RBAC definition
│   │   │   │   ├── page.tsx
│   │   │   │   ├── Roles.components/         # RENDER ONLY
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── RolesList.tsx
│   │   │   │   │   ├── RoleDetail.tsx
│   │   │   │   │   ├── PermissionsCheckbox.tsx
│   │   │   │   │   └── CreateRoleModal.tsx
│   │   │   │   └── Roles.logic/              # UI STATE ONLY
│   │   │   │       ├── index.ts
│   │   │   │       └── useRolesState.ts
│   │   │   │
│   │   │   ├── Organizations/                # Multi-tenant (superadmin)
│   │   │   │   ├── page.tsx
│   │   │   │   ├── Organizations.components/ # RENDER ONLY
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── OrgRow.tsx
│   │   │   │   │   ├── OrgDetailPanel.tsx
│   │   │   │   │   ├── StatsWidget.tsx
│   │   │   │   │   └── CreateOrgModal.tsx
│   │   │   │   └── Organizations.logic/      # UI STATE ONLY
│   │   │   │       ├── index.ts
│   │   │   │       └── useOrgsState.ts
│   │   │   │
│   │   │   ├── Matrix/                       # Permissions debug User x Scopes
│   │   │   │   ├── page.tsx
│   │   │   │   ├── Matrix.components/        # RENDER ONLY
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── MatrixGrid.tsx
│   │   │   │   │   ├── CellPopup.tsx
│   │   │   │   │   └── PathDisplay.tsx
│   │   │   │   └── Matrix.logic/             # UI STATE ONLY
│   │   │   │       ├── index.ts
│   │   │   │       └── useMatrixState.ts
│   │   │   │
│   │   │   │   # === 4 FEATURES DIFFERENCIANTES ===
│   │   │   │
│   │   │   ├── Explain/                      # "Pourquoi Access Denied" + solutions
│   │   │   │   ├── page.tsx
│   │   │   │   ├── Explain.components/       # RENDER ONLY
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── ExplainSearch.tsx
│   │   │   │   │   ├── ExplainResult.tsx
│   │   │   │   │   ├── PathDisplay.tsx
│   │   │   │   │   ├── FixOptions.tsx
│   │   │   │   │   └── ImpactPreview.tsx
│   │   │   │   └── Explain.logic/            # UI STATE ONLY
│   │   │   │       ├── index.ts
│   │   │   │       └── useExplainState.ts
│   │   │   │
│   │   │   ├── Graph/                        # Visualisation interactive IAM
│   │   │   │   ├── page.tsx
│   │   │   │   ├── Graph.components/         # RENDER ONLY
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── GraphCanvas.tsx
│   │   │   │   │   ├── NodeDetail.tsx
│   │   │   │   │   └── GraphControls.tsx
│   │   │   │   └── Graph.logic/              # UI STATE ONLY
│   │   │   │       ├── index.ts
│   │   │   │       └── useGraphState.ts
│   │   │   │
│   │   │   ├── Drift/                        # Sync proactive Vault <-> CF
│   │   │   │   ├── page.tsx
│   │   │   │   ├── Drift.components/         # RENDER ONLY
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── AudiencesList.tsx
│   │   │   │   │   ├── DriftDetail.tsx
│   │   │   │   │   ├── SyncActions.tsx
│   │   │   │   │   └── DriftComparison.tsx
│   │   │   │   └── Drift.logic/              # UI STATE ONLY
│   │   │   │       ├── index.ts
│   │   │   │       └── useDriftState.ts
│   │   │   │
│   │   │   └── WhatIf/                       # Preview impact changements
│   │   │       ├── page.tsx
│   │   │       ├── WhatIf.components/        # RENDER ONLY
│   │   │       │   ├── index.ts
│   │   │       │   ├── ActionSelector.tsx
│   │   │       │   ├── SimulationPreview.tsx
│   │   │       │   ├── ImpactList.tsx
│   │   │       │   └── Warnings.tsx
│   │   │       └── WhatIf.logic/             # UI STATE ONLY
│   │   │           ├── index.ts
│   │   │           └── useWhatIfState.ts
│   │   │
│   │   └── globals.css                       # Design tokens TPB
│   │
│   ├── components/
│   │   ├── ui/                               # shadcn/ui (ne pas modifier)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ...
│   │   │
│   │   ├── common/                           # Partages entre pages (etape 1 refacto)
│   │   │   ├── index.ts
│   │   │   ├── EmptyState/
│   │   │   │   ├── index.ts
│   │   │   │   └── EmptyState.tsx
│   │   │   ├── ErrorState/
│   │   │   │   ├── index.ts
│   │   │   │   └── ErrorState.tsx
│   │   │   ├── LoadingState/
│   │   │   │   ├── index.ts
│   │   │   │   └── LoadingState.tsx
│   │   │   └── ConfirmModal/
│   │   │       ├── index.ts
│   │   │       └── ConfirmModal.tsx
│   │   │
│   │   ├── tpb/                              # LIB TPB REUTILISABLE (etape 2 refacto)
│   │   │   ├── index.ts                      # Barrel export
│   │   │   │
│   │   │   ├── DataTable/                    # Table generique
│   │   │   │   ├── index.ts
│   │   │   │   ├── DataTable.tsx
│   │   │   │   ├── DataTable.types.ts
│   │   │   │   └── DataTable.test.tsx
│   │   │   │
│   │   │   ├── DetailSidePanel/              # Panel lateral detail entity
│   │   │   │   ├── index.ts
│   │   │   │   ├── DetailSidePanel.tsx
│   │   │   │   └── DetailSidePanel.types.ts
│   │   │   │
│   │   │   ├── StatusBadge/                  # Badge avec couleur selon status
│   │   │   │   ├── index.ts
│   │   │   │   └── StatusBadge.tsx
│   │   │   │
│   │   │   ├── SyncStatusBadge/              # Badge sync (synced/drift/error)
│   │   │   │   ├── index.ts
│   │   │   │   └── SyncStatusBadge.tsx
│   │   │   │
│   │   │   ├── CopyBlock/                    # Code block avec bouton copy
│   │   │   │   ├── index.ts
│   │   │   │   └── CopyBlock.tsx
│   │   │   │
│   │   │   ├── StatsCard/                    # Card metrique avec label + valeur
│   │   │   │   ├── index.ts
│   │   │   │   └── StatsCard.tsx
│   │   │   │
│   │   │   ├── ActionDropdown/               # Dropdown actions par row
│   │   │   │   ├── index.ts
│   │   │   │   └── ActionDropdown.tsx
│   │   │   │
│   │   │   ├── SearchInput/                  # Input recherche avec debounce
│   │   │   │   ├── index.ts
│   │   │   │   └── SearchInput.tsx
│   │   │   │
│   │   │   └── FilterBar/                    # Barre de filtres combinables
│   │   │       ├── index.ts
│   │   │       └── FilterBar.tsx
│   │   │
│   │   └── shell/                            # Layout components
│   │       ├── index.ts
│   │       │
│   │       ├── Header/
│   │       │   ├── index.ts
│   │       │   ├── Header.tsx
│   │       │   ├── Logo.tsx
│   │       │   └── UserMenu.tsx
│   │       │
│   │       ├── Sidebar/
│   │       │   ├── index.ts
│   │       │   ├── Sidebar.tsx
│   │       │   ├── NavItem.tsx
│   │       │   └── NavGroup.tsx
│   │       │
│   │       ├── Breadcrumbs/
│   │       │   ├── index.ts
│   │       │   └── Breadcrumbs.tsx
│   │       │
│   │       ├── OrgSwitcher/
│   │       │   ├── index.ts
│   │       │   └── OrgSwitcher.tsx
│   │       │
│   │       ├── AccountSwitcher/
│   │       │   ├── index.ts
│   │       │   └── AccountSwitcher.tsx
│   │       │
│   │       └── DebugX/                       # Troubleshooting user-side
│   │           ├── index.ts
│   │           ├── DebugX.tsx
│   │           └── useDebugCollector.ts
│   │
│   ├── contexts/                             # Providers globaux
│   │   ├── index.ts                          # Barrel export
│   │   │
│   │   ├── Auth/
│   │   │   ├── index.ts
│   │   │   ├── AuthContext.tsx
│   │   │   ├── AuthProvider.tsx
│   │   │   └── useAuth.ts
│   │   │
│   │   ├── Tenant/
│   │   │   ├── index.ts
│   │   │   ├── TenantContext.tsx
│   │   │   ├── TenantProvider.tsx
│   │   │   └── useTenant.ts
│   │   │
│   │   ├── Theme/
│   │   │   ├── index.ts
│   │   │   ├── ThemeContext.tsx
│   │   │   ├── ThemeProvider.tsx
│   │   │   └── useTheme.ts
│   │   │
│   │   ├── Locale/
│   │   │   ├── index.ts
│   │   │   ├── LocaleContext.tsx
│   │   │   ├── LocaleProvider.tsx
│   │   │   └── useLocale.ts
│   │   │
│   │   └── Account/                          # Multi-compte
│   │       ├── index.ts
│   │       ├── AccountContext.tsx
│   │       ├── AccountProvider.tsx
│   │       └── useAccount.ts
│   │
│   ├── services/                             # PURE FETCH WRAPPERS - aucune logique
│   │   ├── index.ts                          # Barrel export
│   │   ├── client.ts                         # fetch wrapper avec auth
│   │   │
│   │   ├── tokens.ts                         # /front_iam/service-tokens
│   │   ├── applications.ts                   # /front_iam/applications
│   │   ├── users.ts                          # /front_iam/users
│   │   ├── groups.ts                         # /front_iam/groups
│   │   ├── roles.ts                          # /front_iam/roles
│   │   ├── organizations.ts                  # /front_iam/organizations
│   │   │
│   │   ├── drift.ts                          # /front_iam/drift
│   │   ├── explain.ts                        # /front_iam/explain
│   │   ├── graph.ts                          # /front_iam/graph
│   │   ├── simulate.ts                       # /front_iam/simulate
│   │   └── dashboard.ts                      # /front_iam/dashboard/stats
│   │
│   ├── i18n/
│   │   ├── config.ts
│   │   ├── request.ts
│   │   └── messages/
│   │       ├── en.json
│   │       └── fr.json
│   │
│   ├── themes/                               # Multi-theme white-label ready
│   │   ├── index.ts                          # Barrel + getCurrentTheme()
│   │   ├── types.ts                          # ThemeConfig interface
│   │   ├── default.ts                        # TPB dark theme
│   │   ├── light.ts                          # TPB light variant
│   │   ├── tenant/                           # White-label per tenant
│   │   │   ├── index.ts                      # Registry
│   │   │   └── [slug].ts                     # Ex: acme.ts
│   │   └── applyTheme.ts                     # Injecte CSS vars
│   │
│   ├── formatters/                           # UI FORMATTERS ONLY - Intl API wrappers
│   │   ├── index.ts
│   │   ├── date.ts                           # formatDate(), formatRelative()
│   │   ├── number.ts                         # formatNumber(), formatPercent()
│   │   └── currency.ts                       # formatCurrency()
│   │
│   ├── loaders/                              # App initialization
│   │   ├── index.ts
│   │   └── appLoader.ts
│   │
│   ├── lib/
│   │   ├── utils.ts                          # cn(), etc.
│   │   └── api-error.ts
│   │
│   ├── hooks/                                # Hooks globaux - UI STATE ONLY
│   │   ├── index.ts
│   │   ├── useStoreState.ts                  # Global UI state pattern
│   │   └── useDebounce.ts                    # Pour search input
│   │
│   ├── types/
│   │   ├── index.ts
│   │   ├── api.ts                            # Types API responses
│   │   ├── user.ts
│   │   ├── application.ts
│   │   ├── group.ts
│   │   ├── role.ts
│   │   ├── token.ts
│   │   └── organization.ts
│   │
│   └── constants/
│       ├── index.ts
│       ├── routes.ts
│       ├── permissions.ts
│       └── statuses.ts
│
├── public/
│   ├── favicon.ico
│   └── logo.svg
│
├── middleware.ts                             # Locale detection
├── wrangler.toml                             # CF Worker config (PAS Pages)
├── worker.ts                                 # Entry point Worker
├── next.config.ts                            # output: 'export'
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## _migrate_to_backend/ (Pattern Interception Centralise)

Dossier pour capturer la logique business identifiee pendant le developpement.
Utilise un pattern d'interception centralise pour transition smooth vers backend.

```
src/_migrate_to_backend/
├── index.ts                                  # Export unique : intercept()
├── registry.ts                               # PENDING_ENDPOINTS - liste des shims actifs
├── intercept.ts                              # Logique d'interception + path matching
├── handlers/                                 # Logique temporaire par endpoint
│   ├── index.ts                              # Barrel export
│   ├── effective-permissions.ts              # Calcul perms effectives (en attente backend)
│   ├── drift-comparison.ts                   # Diff Vault vs CF (en attente backend)
│   └── users-enrichment.ts                   # Enrichissement users (en attente backend)
└── specs/                                    # Documentation pour backend
    ├── README.md                             # Vue d'ensemble
    ├── effective-permissions.spec.md         # Spec endpoint souhaite
    └── drift-comparison.spec.md              # Spec endpoint souhaite
```

### Fonctionnement

1. **registry.ts** : Liste les endpoints pas encore implementes backend
2. **intercept.ts** : Verifie si un appel doit etre intercepte
3. **handlers/** : Contient la logique temporaire (sera supprimee)
4. **specs/** : Documente ce que le backend doit implementer

### registry.ts

```typescript
import { effectivePermissions } from './handlers/effective-permissions';
import { driftComparison } from './handlers/drift-comparison';

export type Handler = (params: any, pathParams: Record<string, string>) => Promise<any>;

// LISTE DES ENDPOINTS PAS ENCORE IMPLEMENTES BACKEND
// Supprimer une ligne = utiliser le backend
export const PENDING_ENDPOINTS: Record<string, Handler> = {
  'GET /front_iam/users/:id/effective-permissions': effectivePermissions,
  'GET /front_iam/groups/:id/drift': driftComparison,
};
```

### intercept.ts

```typescript
import { PENDING_ENDPOINTS } from './registry';

export async function intercept(
  method: string, 
  path: string, 
  params?: any
): Promise<{ handled: boolean; data?: any }> {
  
  for (const [pattern, handler] of Object.entries(PENDING_ENDPOINTS)) {
    const [m, p] = pattern.split(' ');
    if (m !== method) continue;
    
    const match = matchPath(p, path);
    if (match) {
      console.warn(`[SHIM] ${method} ${path} → local handler`);
      const data = await handler(params, match.params);
      return { handled: true, data };
    }
  }
  
  return { handled: false };
}

function matchPath(pattern: string, path: string): { params: Record<string, string> } | null {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');
  if (patternParts.length !== pathParts.length) return null;
  
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return { params };
}
```

### Process de Migration

```
1. Endpoint backend pas pret ?
   → Ajouter dans PENDING_ENDPOINTS (registry.ts)
   → Creer handler dans handlers/
   → Creer spec dans specs/

2. Backend implemente l'endpoint avec la vue SQL

3. Supprimer la ligne dans PENDING_ENDPOINTS
   → Le handler n'est plus appele
   → apiClient appelle directement le backend

4. (Optionnel) Supprimer le fichier handler
```

### Avantages

- **Code frontend final** : Les services appellent toujours les memes endpoints `front_*`
- **Zero legacy** : Pas de code temporaire disperse dans le frontend
- **Transition atomique** : Supprimer une ligne = basculer vers backend
- **Debug facile** : Console.warn indique quand un shim est utilise

---

## Role des Dossiers (Dumb Front)

### `Page.components/` - RENDER ONLY

Composants de presentation pure. Aucune logique, juste du JSX.

```typescript
// OK
export const UserRow = ({ user, onSelect }: Props) => (
  <tr onClick={() => onSelect(user.id)}>
    <td>{user.name}</td>
    <td><StatusBadge status={user.status} /></td>
  </tr>
);

// INTERDIT - logique dans le composant
export const UserRow = ({ user }) => {
  const isActive = user.lastLogin > Date.now() - 30 * 24 * 60 * 60 * 1000; // NON!
  // ...
};
```

### `Page.logic/` - UI STATE ONLY

Hooks pour l'etat UI : loading, error, selection, modals, form state.

```typescript
// OK - Pure UI state
export const useUsersState = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  // ...
};

// INTERDIT - Transformation de donnees
export const useUsersState = () => {
  const { data } = useQuery(...);
  const filteredUsers = data.filter(u => u.active); // NON! Backend fait ca
  const sortedUsers = data.sort((a, b) => ...);     // NON! Backend fait ca
};
```

### `Page.functions/` - UI FORMATTERS ONLY

Fonctions de formatage pour l'affichage uniquement.

```typescript
// OK - Formatage display
export const truncateEmail = (email: string) => 
  email.length > 20 ? email.slice(0, 17) + '...' : email;

// INTERDIT - Calcul business
export const calculateScore = (user: User) => { /* NON! */ };
export const filterByPermission = (users: User[], perm: string) => { /* NON! */ };
```

### `services/` - PURE FETCH WRAPPERS

Aucune logique, juste des appels fetch. Le backend fait TOUT le travail.

```typescript
// OK - Pure fetch
export const usersService = {
  list: (params: ListParams) => 
    apiClient.get('/front_iam/users', { params }),
  
  getById: (id: string) => 
    apiClient.get(`/front_iam/users/${id}`),
  
  create: (data: CreateUserDTO) => 
    apiClient.post('/front_iam/users', data),
};

// INTERDIT - Logique apres fetch
export const usersService = {
  list: async () => {
    const users = await apiClient.get('/iam/users');
    return users.filter(u => u.active).sort(...); // NON!
  },
};
```

---

## Rappel : Approche Organique

Cette arborescence est un **GUIDE**. On n'y arrive pas en creant tous les dossiers d'avance :

1. **On code l'UI** dans `page.tsx` ou un composant simple
2. **On extrait** vers `.components/`, `.logic/`, `.functions/` quand necessaire
3. **On identifie** les composants reutilisables -> `common/`
4. **On promeut** les composants stables et generiques -> `tpb/`
5. **Logique business detectee ?** -> `_migrate_to_backend/` + mock endpoint

Les dossiers se creent **au fil du besoin**, pas avant.
