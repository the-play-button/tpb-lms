# Backend Views & Pattern Interception

> Documentation des vues SQL necessaires pour les endpoints `front_*` et du pattern d'interception pour transition smooth.

---

## Schema ERD Resume

```
iam_organization
└── iam_user
      └── iam_user_group ──→ iam_group
                                └── iam_group_role ──→ iam_role
                                                          └── iam_role_permission ──→ iam_permission
```

**Tables additionnelles** : `iam_service_token`, `sys_audit_log`, `connection`, `sys_secret_ref`

---

## Vues SQL pour Endpoints `front_*`

Le backend doit exposer des endpoints dedies au frontend (`front_*`) qui s'appuient sur ces vues SQL pre-calculees.

| Vue SQL | Description | Calculs inclus |
|---------|-------------|----------------|
| `view_front_users` | Liste users enrichie | groups_count, tokens_count |
| `view_front_user_detail` | User complet | + effective_permissions (recursive CTE) |
| `view_front_groups` | Liste groups enrichie | members_count, roles_count, drift_status |
| `view_front_dashboard_stats` | Aggregations globales | COUNT sur toutes tables |
| `view_front_effective_permissions` | User → Permissions | Recursive CTE via group/role |
| `view_front_drift` | Vault vs CF Access | expected[], actual[], missing[], extra[] |
| `view_front_matrix` | Users x Scopes | granted boolean per cell |

---

## Exemples SQL

### view_front_users

```sql
CREATE VIEW view_front_users AS
SELECT 
  u.id,
  u.email,
  u.display_name,
  u.user_type,
  u.status,
  u.organization_id,
  u.created_at,
  u.updated_at,
  (SELECT COUNT(*) FROM iam_user_group ug WHERE ug.user_id = u.id) as groups_count,
  (SELECT COUNT(*) FROM iam_service_token t 
   WHERE t.subject_email = u.email AND t.revoked_at IS NULL) as tokens_count
FROM iam_user u;
```

### view_front_effective_permissions (Recursive CTE)

```sql
CREATE VIEW view_front_effective_permissions AS
SELECT DISTINCT 
  u.id as user_id,
  u.email,
  p.id as permission_id,
  p.action,
  p.resource,
  g.id as via_group_id,
  g.name as via_group_name,
  r.id as via_role_id,
  r.name as via_role_name
FROM iam_user u
JOIN iam_user_group ug ON u.id = ug.user_id
JOIN iam_group g ON ug.group_id = g.id
JOIN iam_group_role gr ON g.id = gr.group_id
JOIN iam_role r ON gr.role_id = r.id
JOIN iam_role_permission rp ON r.id = rp.role_id
JOIN iam_permission p ON rp.permission_id = p.id;
```

### view_front_groups

```sql
CREATE VIEW view_front_groups AS
SELECT 
  g.id,
  g.name,
  g.type,
  g.organization_id,
  g.description,
  g.is_active,
  g.created_at,
  (SELECT COUNT(*) FROM iam_user_group ug WHERE ug.group_id = g.id) as members_count,
  (SELECT COUNT(*) FROM iam_group_role gr WHERE gr.group_id = g.id) as roles_count
  -- drift_status calcule dynamiquement via comparison CF Access
FROM iam_group g;
```

### view_front_dashboard_stats

```sql
CREATE VIEW view_front_dashboard_stats AS
SELECT 
  (SELECT COUNT(*) FROM iam_organization) as orgs_count,
  (SELECT COUNT(*) FROM iam_user WHERE status = 'active') as users_count,
  (SELECT COUNT(*) FROM connection WHERE integration_type = 'integrations') as apps_count,
  0 as drift_alerts  -- Calcule dynamiquement
FROM (SELECT 1);  -- Single row
```

---

## Mapping Vues → Endpoints `front_*`

| Endpoint | Vue SQL source | Notes |
|----------|----------------|-------|
| `GET /front_iam/users` | view_front_users | + pagination, filtre, tri server-side |
| `GET /front_iam/users/:id` | view_front_user_detail | Avec groups, tokens inclus |
| `GET /front_iam/users/:id/effective-permissions` | view_front_effective_permissions | Perms calculees avec path |
| `GET /front_iam/groups` | view_front_groups | + pagination, filtre server-side |
| `GET /front_iam/groups/:id/drift` | view_front_drift | Comparaison pre-calculee |
| `GET /front_iam/dashboard/stats` | view_front_dashboard_stats | Stats pre-agregees |
| `GET /front_iam/matrix` | view_front_matrix | Cache 5min recommande |

---

## Pattern Interception (Transition Smooth)

### Probleme

Le backend n'implemente pas encore tous les endpoints `front_*`. Le frontend doit pouvoir :
1. Appeler les endpoints `front_*` comme si ils existaient
2. Utiliser un shim local temporaire si l'endpoint n'est pas pret
3. Basculer automatiquement vers le backend quand il est pret (juste supprimer une ligne)

### Solution : Interception Centralisee

Le pattern est inspire de MSW (Mock Service Worker) mais plus simple.

**Principe** :
- Le `apiClient` verifie d'abord si l'endpoint est dans le registry des "pending endpoints"
- Si oui → execute le handler local
- Si non → appel backend normal

### Structure `_migrate_to_backend/`

```
src/_migrate_to_backend/
├── index.ts              # Export unique : intercept()
├── registry.ts           # PENDING_ENDPOINTS - liste des shims actifs
├── intercept.ts          # Logique d'interception + path matching
├── handlers/             # Logique temporaire par endpoint
│   ├── index.ts
│   ├── effective-permissions.ts
│   ├── drift-comparison.ts
│   └── users-enrichment.ts
└── specs/                # Documentation pour backend
    ├── effective-permissions.spec.md
    └── drift-comparison.spec.md
```

### Code Pattern

```typescript
// _migrate_to_backend/registry.ts
import { effectivePermissions } from './handlers/effective-permissions';
import { driftComparison } from './handlers/drift-comparison';

export type Handler = (params: any, pathParams: Record<string, string>) => Promise<any>;

// LISTE DES ENDPOINTS PAS ENCORE IMPLEMENTES BACKEND
// Supprimer une ligne = utiliser le backend
export const PENDING_ENDPOINTS: Record<string, Handler> = {
  'GET /front_iam/users/:id/effective-permissions': effectivePermissions,
  'GET /front_iam/groups/:id/drift': driftComparison,
  // Ajouter ici au besoin, retirer quand backend pret
};
```

```typescript
// _migrate_to_backend/intercept.ts
import { PENDING_ENDPOINTS, Handler } from './registry';

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

### Integration dans client.ts

Voir [07-contexts-services.md](./07-contexts-services.md) pour l'implementation complete.

### Process de Migration

```
1. Dev frontend : endpoint backend pas pret
   → Ajouter dans PENDING_ENDPOINTS
   → Creer handler dans handlers/
   → Creer spec dans specs/

2. Backend implemente l'endpoint avec la vue SQL

3. Supprimer la ligne dans PENDING_ENDPOINTS
   → Le handler n'est plus appele
   → apiClient appelle directement le backend

4. (Optionnel) Supprimer le fichier handler si plus utile
```

### Avantages

- **Code frontend final** : Les services appellent toujours les memes endpoints `front_*`
- **Zero legacy** : Pas de code temporaire disperse dans le frontend
- **Transition atomique** : Supprimer une ligne = basculer vers backend
- **Documentation incluse** : Les specs/ documentent ce que le backend doit implementer
- **Debug facile** : Console.warn indique quand un shim est utilise

---

## Checklist Backend

Endpoints `front_*` a implementer (par ordre de priorite) :

| Endpoint | Vue SQL | Phase |
|----------|---------|-------|
| `GET /front_iam/dashboard/stats` | view_front_dashboard_stats | Phase 5.1 |
| `GET /front_iam/users` | view_front_users | Phase 5.2 |
| `GET /front_iam/users/:id` | view_front_user_detail | Phase 5.2 |
| `GET /front_iam/users/:id/effective-permissions` | view_front_effective_permissions | Phase 5.2 |
| `GET /front_iam/groups` | view_front_groups | Phase 5.3 |
| `GET /front_iam/groups/:id/drift` | view_front_drift | Phase 5.3 |
| `POST /front_iam/explain` | - | Phase 6.2 |
| `GET /front_iam/matrix` | view_front_matrix | Phase 6.1 |

