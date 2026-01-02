# Phases d'Implementation

## Approche Dumb Front pour chaque Phase

Pour chaque vue/feature (Phases 4-6), on suit ce cycle :

```
1. Coder l'UI (composants de rendu)
2. Connecter aux services (pure fetch via front_*)
3. DETECTER logique business ?
   → Ajouter endpoint dans registry.ts
   → Creer handler dans _migrate_to_backend/handlers/
   → Documenter spec dans _migrate_to_backend/specs/
4. Extraire vers les tiroirs quand necessaire
5. Identifier composants reutilisables -> common/ puis tpb/
```

> **Note** : Le code des services et composants reste "final". Seul le registry change pendant la migration.

---

## Phase 0 : Extraction de l'Existant (PREALABLE)

1. **Creer `_to_refacto/`** dans `lms/core/vault-api/frontend/`
2. **Extraire le code des 3 handlers** :
   - `ui.js:dashboard` -> `_to_refacto/tokens/`
   - `ui.js:applicationsDashboard` -> `_to_refacto/applications/`
   - `cloudflareResources.js:dashboard` -> `_to_refacto/cloudflare/`
3. **Extraire TPB_STYLES** -> `_to_refacto/TPB_STYLES.css`
4. **Creer `_to_refacto/README.md`** avec le mapping complet existant -> cible

**But** : Avoir une reference claire du code existant pendant le refacto, sans toucher au backend.

---

## Phase 1 : Convention 04 + Setup

1. **Creer `04_Convention_Frontend_TPB.md`** avec :
   - Tous les concepts de la v3
   - **Philosophie Dumb Front** (NOUVEAU)
   - Philosophie "tiroirs organiques"
   - Cycle creer -> refacto -> migrer logique backend
   - Lib TPB reutilisable
   - Multi-tout architecture

2. **Init Next.js 15** dans `lms/core/vault-api/frontend/`
   - TypeScript strict
   - Tailwind 4
   - Static export pour CF Worker

3. **Installer deps** : `next-intl`, `shadcn/ui`, `lucide-react`, `sonner`

4. **Setup CF Worker** : `wrangler.toml` + `worker.ts`

5. **Setup Pattern Interception** (`_migrate_to_backend/`) :
   - Creer `_migrate_to_backend/index.ts` (export unique)
   - Creer `_migrate_to_backend/registry.ts` (PENDING_ENDPOINTS - vide au depart)
   - Creer `_migrate_to_backend/intercept.ts` (logique matching)
   - Creer `_migrate_to_backend/handlers/index.ts` (barrel)
   - Creer `_migrate_to_backend/specs/README.md` (documentation)

---

## Phase 2 : Infrastructure Multi-tout

1. Setup i18n (`i18n/`, `messages/`, `middleware.ts`)
2. Setup themes **multi-theme white-label** (`themes/`, `ThemeConfig`, tenant overrides)
3. Setup formatters (`formatters/`) - **UI formatters ONLY**
4. Creer les 5 contexts (Auth, Tenant, Theme, Locale, Account)
5. Creer services layer **dumb** (`services/client.ts`) avec pattern interception integre

---

## Phase 3 : Shell Complet

1. Header (Logo, OrgSwitcher, UserMenu, AccountSwitcher)
2. Sidebar (navigation avec permission-based visibility)
3. Breadcrumbs
4. Layout assemblant le shell
5. DebugX (composant flottant)

---

## Phase 4 : Vues Fondation (3 vues existantes portees)

**Objectif** : Porter les vues existantes vers React avec l'architecture Dumb Front.

**Process pour chaque vue** :

```
1. Coder l'UI complete (composants de rendu purs)
2. Connecter aux endpoints front_* (backend fait tri/filtre/calcul)
3. SI logique detectee dans le code existant :
   - Creer fichier dans _migrate_to_backend/
   - Documenter endpoint front_* souhaite
   - Mocker temporairement
4. Extraire vers les tiroirs quand necessaire
5. Identifier les composants reutilisables -> common/
6. Generaliser et promouvoir vers tpb/ si pertinent
```

### 4.1 Tokens (porter + enrichir)
- **Source** : `ui.js:dashboard` (L484-743)
- **Specs** : `views/tokens.md`
- **Existant a porter** :
  - Liste "Mes tokens" avec status
  - Generate token modal (name input)
  - Credentials display (one-time, copy buttons)
  - Revoke action avec confirmation
  - Format .env copy
- **Enrichissements** :
  - Tabs "My Tokens" / "All Tokens" (admin)
  - Filtres : User, Status, App
  - Bulk actions : Revoke selected
  - Token types : Personal vs Application
- **Endpoints `front_*`** :
  - `GET /front_iam/service-tokens` (avec pagination, filtre server-side)
  - `POST /front_iam/service-tokens`
  - `DELETE /front_iam/service-tokens/:id`
- **Logique a migrer** : Aucune attendue (CRUD simple)

### 4.2 Applications (porter + enrichir)
- **Source** : `ui.js:applicationsDashboard` (L744-1173)
- **Specs** : `views/applications.md`
- **Existant a porter** :
  - Stats cards (total, actives, ressources)
  - Grid applications avec cards (namespace, scopes, status)
  - Create modal (name, scopes checkboxes, contact)
  - Credentials modal (one-time show)
  - Details modal (roles, permissions crees)
  - Rotate credentials, Revocation
- **Enrichissements** :
  - Audiences section avec sync status (`sys_infra_state`)
  - Authorized Groups section (qui a acces)
  - Sync Now button per audience
  - Filtres : Org, Status
- **Endpoints `front_*`** :
  - `GET /front_iam/applications` (avec stats, sync status inclus)
  - `GET /front_iam/applications/:id` (avec audiences, authorized groups)
  - `POST /front_iam/applications`
  - `POST /front_iam/applications/:id/rotate-credentials`
- **Logique a migrer possible** :
  - `_migrate_to_backend/app-stats-aggregation.ts` si stats calculees cote front

### 4.3 Cloudflare/Infrastructure (porter, puis fusionner)
- **Source** : `cloudflareResources.js:dashboard` (L433-884)
- **Note** : Cette vue sera fusionnee avec Drift Detection (Phase 6.3)
- **Existant a porter** :
  - Stats cards (Access apps, Workers, Pages, Deployments)
  - CF Access apps list
  - Workers list avec bindings
  - Pages list avec deployments
  - Expandable details
- **Decision architecture** :
  - CF Access -> fusionner dans Drift Detection
  - Workers/Pages -> deplacer vers Settings > Infrastructure
- **Endpoints `front_*`** :
  - `GET /front_iam/cloudflare/resources` (stats pre-agregees)
  - `GET /front_iam/cloudflare/resources/:type`

---

## Phase 5 : IAM Core (5 vues)

**Objectif** : Completer le coeur IAM enterprise avec approche Dumb Front.

### 5.1 Dashboard
- **Specs** : `views/dashboard.md`
- **Elements** : 4 metric cards (Orgs, Users, Apps, Alerts), Drift Alerts widget, Quick Actions, Recent Activity
- **States** : Loading (skeleton), Empty (onboarding), Error
- **Refresh** : Auto 30s + manual
- **Endpoints `front_*`** :
  - `GET /front_iam/dashboard/stats` (pre-agrege par backend)
  - `GET /front_iam/dashboard/drift-alerts`
  - `GET /front_iam/dashboard/activity`
- **Logique a migrer** : Aucune (backend pre-agrege tout)

### 5.2 Users
- **Specs** : `views/users.md`
- **Liste** : DataTable avec search, filtres (Org, Status, Type), bulk actions, pagination
- **Detail (side panel)** : Info, Groups membership, Effective permissions, Service tokens, Actions (Suspend, Delete)
- **Create modal** : Email, Display Name, Org, Type (human/service), Add to Groups
- **Links** : -> Matrix, -> Explain Mode
- **Endpoints `front_*`** :
  - `GET /front_iam/users` (pagination, filtre server-side)
  - `GET /front_iam/users/:id` (avec groups, tokens inclus)
  - `GET /front_iam/users/:id/effective-permissions` (calcul backend)
- **Logique a migrer probable** :
  - `_migrate_to_backend/effective-permissions-calc.ts` si calcul existe dans code existant

### 5.3 Groups
- **Specs** : `views/groups.md`
- **Liste** : Name, Org, Type, Members count, Roles count, CF Sync status
- **Detail (side panel)** : Info, CF Sync status (avec drift details), Roles, Members, Permissions via roles, Actions
- **Create modal** : Name, Org, Type (team/department/custom), Description, Assign Roles
- **Drift Alert** : Inline dans detail si drift detecte (Vault vs CF Access)
- **Endpoints `front_*`** :
  - `GET /front_iam/groups` (avec members count, drift status)
  - `GET /front_iam/groups/:id` (avec drift details inclus)
  - `GET /front_iam/groups/:id/drift` (comparaison pre-calculee par backend)
  - `POST /front_iam/groups/:id/sync`
- **Logique a migrer probable** :
  - `_migrate_to_backend/drift-comparison.ts` si diff existe cote front

### 5.4 Roles
- **Specs** : `views/roles.md`
- **Layout** : Master-detail (liste gauche, detail droite)
- **Detail** : Description, Permissions checklist, Groups with this role, System role badge
- **Create modal** : Name, Description, Scope (org or global)
- **Add permission modal** : Checklist de toutes les permissions disponibles
- **NL Integration** : Auto-generated description depuis permissions (future)
- **Endpoints `front_*`** :
  - `GET /front_iam/roles` (avec groups count)
  - `GET /front_iam/roles/:id` (avec permissions, groups)
- **Logique a migrer** : Aucune attendue

### 5.5 Organizations
- **Specs** : `views/organizations.md`
- **Permission** : Superadmin only
- **Liste** : Name, Slug, Users count, Apps count, Status
- **Detail** : Settings (ID, Slug, CF Account), Stats, Applications list, Recent Users
- **Create modal** : Name, Slug (auto-generated), CF Account ID
- **Actions** : Suspend, Delete (only if 0 users)
- **Endpoints `front_*`** :
  - `GET /front_iam/organizations` (avec counts)
  - `GET /front_iam/organizations/:id` (avec stats, apps, users)
- **Logique a migrer** : Aucune attendue

---

## Phase 6 : Features Differenciantes Enterprise

**Objectif** : Ce qui fait de TPB Vault une solution enterprise unique.

**Ces features reposent FORTEMENT sur le backend** - le frontend ne fait qu'afficher.

### 6.1 Permissions Matrix
- **Specs** : `views/matrix.md`
- **Layout** : Grid User (rows) x Scope (columns), dot granted / circle not granted
- **Click cell granted** : Popup avec source (User -> Group -> Role -> Permission path)
- **Click cell not granted** : Popup "Why not granted" + fix options (-> Explain Mode)
- **Filtres** : Org, App (filter columns by namespace)
- **Performance** : Cache 5min, pagination rows, scroll horizontal columns
- **Integration** : Links vers User/Group/Role, link vers Explain Mode
- **Endpoints `front_*`** :
  - `GET /front_iam/matrix` (pagination, cache par backend)
  - `GET /front_iam/matrix/cell/:userId/:scope` (path pre-calcule)
- **Logique frontend** : ZERO - tout calcule par backend

### 6.2 Explain Mode
- **Specs** : `features/explain-mode.md`
- **Pain Point** : "Access Denied" sans contexte
- **Global Search** : "Why can't [user] access [scope]?"
- **Result DENIED** : Raison precise + Fix options (Add to group, Assign role, Create custom role)
- **Result GRANTED** : Path display (User -> Group -> Role -> Permission)
- **Fix Options** : Boutons "Do it" qui executent l'action
- **Impact Preview** : "Affects X users"
- **Integration** : Global search bar, User detail, Matrix cells
- **Endpoints `front_*`** :
  - `POST /front_iam/explain` (analyse complete par backend)
  - `POST /front_iam/explain/fix` (execution par backend)
- **Logique frontend** : ZERO - le backend fait toute l'analyse

### 6.3 Drift Detection
- **Specs** : `features/drift-detection.md`
- **Pain Point** : Sync CF Access = boite noire
- **Dashboard** : Liste audiences avec status (synced/drift/error)
- **Drift Detail** : Expected (Vault) vs Actual (CF), Missing/Extra members
- **Actions** : Sync Now, Fix All, Retry (error)
- **Header Badge** : Alert count, dropdown quick view
- **Auto-check** : Every 15min (cron), trigger on member change
- **Endpoints `front_*`** :
  - `GET /front_iam/drift` (liste audiences avec status)
  - `GET /front_iam/drift/:audienceId` (detail avec diff pre-calcule)
  - `POST /front_iam/drift/check` (trigger check)
  - `POST /front_iam/drift/sync` (execute sync)
- **Logique frontend** : ZERO - le backend fait la comparaison

### 6.4 Access Graph
- **Specs** : `features/access-graph.md`
- **Pain Point** : Puzzle mental pour comprendre relations IAM
- **Layout** : Force-directed graph (D3.js ou Cytoscape)
- **Nodes** : User (circle), Group (square), Role (diamond), Permission (dot)
- **Edges** : member_of, has_role, grants
- **Modes** : User->Scopes, Scope->Users, Group->Members
- **Interactions** : Click node -> detail panel, hover -> highlight connections, highlight path to scope
- **Endpoints `front_*`** :
  - `GET /front_iam/graph/user/:id` (nodes + edges pre-calcules)
  - `GET /front_iam/graph/scope/:scope`
  - `GET /front_iam/graph/group/:id`
- **Logique frontend** : Rendu D3/Cytoscape SEULEMENT - donnees pre-formatees

### 6.5 What-If Simulator
- **Specs** : `features/what-if.md`
- **Pain Point** : Changements IAM sans filet
- **Actions simulables** : Add/Remove user from group, Assign/Remove role to group, Add permission to role, Delete user
- **Preview** : Permissions gained/lost, Users affected, Warnings (superadmin grant, many users)
- **Apply** : Execute action reelle apres preview
- **Integration** : Standalone page, declenchement auto avant actions sensibles, depuis Explain Mode et Matrix
- **Endpoints `front_*`** :
  - `POST /front_iam/simulate` (simulation complete par backend)
  - `POST /front_iam/simulate/apply` (execute action reelle)
- **Logique frontend** : ZERO - simulation entierement backend

---

## Phase 7 : Polish Enterprise

**Objectif** : Completude et robustesse enterprise.

- Audit Stories (logs narratifs) - `GET /front_iam/audit/stories`
- Performance optimization (pagination deja server-side, virtualisation UI si besoin)
- Security hardening (CSP, rate limiting UI)
- Accessibility (WCAG AA)
- Documentation utilisateur in-app
- Cleanup `_migrate_to_backend/` - tous les fichiers doivent etre migres

---

## Checklist _migrate_to_backend/

A la fin de chaque phase, verifier que le dossier `_migrate_to_backend/` est traite :

| Phase | Fichiers potentiels | Status |
|-------|---------------------|--------|
| Phase 4 | `app-stats-aggregation.ts` | A verifier |
| Phase 5 | `effective-permissions-calc.ts`, `drift-comparison.ts` | A verifier |
| Phase 6 | Aucun attendu (features backend-heavy) | - |
| Phase 7 | Vider le dossier | A faire |
