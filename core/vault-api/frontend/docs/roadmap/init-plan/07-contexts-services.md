# Contexts & Services

## Contexts Hierarchy

```
RootLayout
└── NextIntlClientProvider (i18n)
    └── ThemeContextProvider (CSS vars per-tenant, white-label)
        └── AuthContextProvider (CF Access user)
            └── TenantContextProvider (org_id, permissions)
                └── AccountContextProvider (multi-compte)
                    └── Shell (Header + Sidebar)
                        └── Pages
```

---

## 5 Contexts

| Context | Role | Donnees |
|---------|------|---------|
| **Auth** | Authentification CF Access | user, isAuthenticated, logout |
| **Tenant** | Organisation courante | org_id, org_name, permissions |
| **Theme** | Theme visuel (white-label) | theme: ThemeConfig, setTheme |
| **Locale** | Langue/locale | locale, setLocale |
| **Account** | Multi-compte | accounts[], currentAccount, switchAccount |

---

## Services : Pure Fetch Wrappers (Dumb Front)

> **CRUCIAL** : Les services sont des **wrappers fetch PURS**. Ils ne contiennent **AUCUNE logique**.
> Tout le travail (tri, filtre, calcul, agregation) est fait par le backend.

### Client de base (avec Pattern Interception)

Le client integre le pattern d'interception pour permettre une transition smooth vers le backend.
Le code du client est **final** - il ne change jamais pendant la migration.

```typescript
// services/client.ts - CODE FINAL (ne change jamais)
import { intercept } from '@/_migrate_to_backend';

const API_BASE = process.env.NEXT_PUBLIC_VAULT_API_URL;

export const apiClient = {
  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    // 1. Verifier si shim actif pour cet endpoint
    const shimmed = await intercept('GET', path, params);
    if (shimmed.handled) return shimmed.data as T;
    
    // 2. Sinon, appel backend normal
    const url = new URL(`${API_BASE}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => 
        url.searchParams.set(k, String(v))
      );
    }
    const res = await fetch(url.toString(), {
      credentials: 'include',  // CF Access cookies
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new ApiError(res);
    return res.json();
  },

  async post<T>(path: string, data: unknown): Promise<T> {
    // 1. Verifier si shim actif
    const shimmed = await intercept('POST', path, data);
    if (shimmed.handled) return shimmed.data as T;
    
    // 2. Sinon, appel backend normal
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new ApiError(res);
    return res.json();
  },

  async patch<T>(path: string, data: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new ApiError(res);
    return res.json();
  },

  async delete(path: string): Promise<void> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new ApiError(res);
  },

  // rawGet pour les handlers (bypass intercept - evite boucle infinie)
  async rawGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const url = new URL(`${API_BASE}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => 
        url.searchParams.set(k, String(v))
      );
    }
    const res = await fetch(url.toString(), {
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new ApiError(res);
    return res.json();
  },
};
```

---

## Pattern Interception : Comment ca marche

Le pattern permet de simuler des endpoints `front_*` non encore implementes par le backend.

### Flux d'execution

```
apiClient.get('/front_iam/users/123/effective-permissions')
    │
    ▼
intercept('GET', path) ───► registry.ts : PENDING_ENDPOINTS
    │                              │
    │                              ▼
    │                        endpoint dans registry ?
    │                              │
    │              ┌───────────────┴───────────────┐
    │              │                               │
    │             OUI                             NON
    │              │                               │
    │              ▼                               ▼
    │    handler local                    { handled: false }
    │    (handlers/*.ts)                          │
    │              │                               │
    │              ▼                               │
    │    { handled: true, data }                   │
    │              │                               │
    └──────────────┴───────────────────────────────┘
                   │
                   ▼
            retour au service
```

### Utilisation dans les handlers

Les handlers peuvent utiliser `rawGet` pour appeler le backend sans passer par l'interception :

```typescript
// _migrate_to_backend/handlers/effective-permissions.ts
import { apiClient } from '@/services/client';

export async function effectivePermissions(
  params: any, 
  pathParams: { id: string }
): Promise<{ permissions: string[]; paths: any[] }> {
  // Utiliser rawGet pour eviter boucle infinie
  const [userGroups, groupRoles, rolePerms] = await Promise.all([
    apiClient.rawGet('/iam/user-groups', { user_id: pathParams.id }),
    apiClient.rawGet('/iam/group-roles'),
    apiClient.rawGet('/iam/role-permissions'),
  ]);
  
  // Calcul temporaire (a migrer vers SQL view)
  const permissions = calculateEffectivePermissions(userGroups, groupRoles, rolePerms);
  
  return { permissions, paths: [] };
}
```

### Documentation complete

Voir [03-backend-views.md](./03-backend-views.md) pour le detail complet du pattern et les vues SQL a implementer.

---

## Convention Endpoints `front_*`

Le backend exposeRA des endpoints dedies au frontend avec prefix `front_`. Ces endpoints :
- Font le tri/filtre cote serveur
- Incluent la pagination
- Pre-calculent les donnees derivees
- Renvoient des donnees pret-a-afficher

| Endpoint standard | Endpoint `front_*` | Difference |
|-------------------|---------------------|------------|
| `/iam/users` | `/front_iam/users` | + pagination, + tri, + filtre server-side |
| `/iam/users/:id` | `/front_iam/users/:id` | + effective permissions incluses |
| `/iam/groups/:id` | `/front_iam/groups/:id` | + drift status, + members count |
| - | `/front_iam/dashboard/stats` | Stats pre-agregees |
| - | `/front_iam/users/:id/effective-permissions` | Perms calculees par backend |
| - | `/front_iam/groups/:id/drift` | Comparison pre-calculee |

---

## Services par Domaine (Dumb Version)

### users.ts

```typescript
// services/users.ts - PURE FETCH, AUCUNE LOGIQUE

import { apiClient } from './client';
import type { User, ListParams, CreateUserDTO } from '@/types';

export const usersService = {
  // Backend fait pagination + tri + filtre
  list: (params: ListParams) => 
    apiClient.get<{ data: User[]; total: number }>('/front_iam/users', params),

  // Backend inclut effective permissions
  getById: (id: string) => 
    apiClient.get<User & { effectivePermissions: string[] }>(`/front_iam/users/${id}`),

  // Backend calcule les permissions effectives
  getEffectivePermissions: (id: string) =>
    apiClient.get<{ permissions: string[]; path: PermissionPath[] }>(
      `/front_iam/users/${id}/effective-permissions`
    ),

  create: (data: CreateUserDTO) => 
    apiClient.post<User>('/front_iam/users', data),

  update: (id: string, data: Partial<CreateUserDTO>) => 
    apiClient.patch<User>(`/front_iam/users/${id}`, data),

  delete: (id: string) => 
    apiClient.delete(`/front_iam/users/${id}`),
};
```

### groups.ts

```typescript
// services/groups.ts - PURE FETCH, AUCUNE LOGIQUE

export const groupsService = {
  list: (params: ListParams) => 
    apiClient.get<{ data: Group[]; total: number }>('/front_iam/groups', params),

  // Backend inclut drift status + members count
  getById: (id: string) => 
    apiClient.get<Group & { driftStatus: DriftStatus; membersCount: number }>(
      `/front_iam/groups/${id}`
    ),

  // Backend fait la comparaison Vault vs CF
  getDrift: (id: string) =>
    apiClient.get<{ expected: string[]; actual: string[]; missing: string[]; extra: string[] }>(
      `/front_iam/groups/${id}/drift`
    ),

  create: (data: CreateGroupDTO) => 
    apiClient.post<Group>('/front_iam/groups', data),

  syncToCF: (id: string) => 
    apiClient.post<{ success: boolean }>(`/front_iam/groups/${id}/sync`, {}),
};
```

### dashboard.ts

```typescript
// services/dashboard.ts - PURE FETCH, AUCUNE LOGIQUE

export const dashboardService = {
  // Backend pre-agrege toutes les stats
  getStats: () =>
    apiClient.get<{
      orgsCount: number;
      usersCount: number;
      appsCount: number;
      driftAlerts: number;
    }>('/front_iam/dashboard/stats'),

  // Backend pre-formate les alertes
  getDriftAlerts: () =>
    apiClient.get<DriftAlert[]>('/front_iam/dashboard/drift-alerts'),

  // Backend pre-formate l'activite
  getRecentActivity: (limit: number = 10) =>
    apiClient.get<ActivityItem[]>('/front_iam/dashboard/activity', { limit }),
};
```

### explain.ts

```typescript
// services/explain.ts - PURE FETCH, AUCUNE LOGIQUE

export const explainService = {
  // Backend fait TOUTE l'analyse
  explain: (userId: string, scope: string) =>
    apiClient.post<{
      granted: boolean;
      reason: string;
      path?: PermissionPath[];
      fixOptions?: FixOption[];
    }>('/front_iam/explain', { userId, scope }),

  // Backend execute le fix
  applyFix: (fixId: string) =>
    apiClient.post<{ success: boolean; affected: number }>(
      '/front_iam/explain/fix',
      { fixId }
    ),
};
```

---

## Tableau Recapitulatif Services

| Service | Endpoints `front_*` |
|---------|---------------------|
| `tokens.ts` | `/front_iam/service-tokens` |
| `applications.ts` | `/front_iam/applications` |
| `users.ts` | `/front_iam/users`, `/front_iam/users/:id/effective-permissions` |
| `groups.ts` | `/front_iam/groups`, `/front_iam/groups/:id/drift` |
| `roles.ts` | `/front_iam/roles` |
| `organizations.ts` | `/front_iam/organizations` |
| `dashboard.ts` | `/front_iam/dashboard/stats`, `/dashboard/activity` |
| `drift.ts` | `/front_iam/drift`, `/drift/check`, `/drift/sync` |
| `explain.ts` | `/front_iam/explain`, `/explain/fix` |
| `graph.ts` | `/front_iam/graph/user/:id`, `/graph/scope/:scope` |
| `simulate.ts` | `/front_iam/simulate` |

---

## Ce que les Services NE FONT PAS

```typescript
// INTERDIT - Logique apres fetch
export const usersService = {
  list: async () => {
    const users = await apiClient.get('/iam/users');
    // NON! Le backend doit faire ca
    return users.filter(u => u.active).sort((a, b) => a.name.localeCompare(b.name));
  },

  // NON! Le backend doit faire ca
  getActiveUsers: async () => {
    const users = await apiClient.get('/iam/users');
    return users.filter(u => u.status === 'active');
  },

  // NON! Le backend doit faire ca
  searchUsers: async (query: string) => {
    const users = await apiClient.get('/iam/users');
    return users.filter(u => 
      u.name.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase())
    );
  },
};
```

Si on detecte ce genre de logique pendant le dev :

1. **Ajouter l'endpoint** dans `_migrate_to_backend/registry.ts`
2. **Creer le handler** dans `_migrate_to_backend/handlers/`
3. **Documenter la spec** dans `_migrate_to_backend/specs/`
4. **Quand backend pret** : supprimer la ligne dans `registry.ts`

> **Important** : Le code des services reste inchange. Seul le registry change.
