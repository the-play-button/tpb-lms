# Mapping Vues Existantes <-> Spec

Ce document mappe les vues UI existantes (dans `backend/handlers/`) avec les specs de la nouvelle architecture.

---

## Vue d'ensemble

| Route Existante | Fichier | Spec Target | Fit |
|-----------------|---------|-------------|-----|
| `/` | `ui.js:landingPage` | - | Landing page, garder tel quel |
| `/dashboard` | `ui.js:dashboard` | `views/tokens.md` | ✅ Excellent |
| `/applications/dashboard` | `ui.js:applicationsDashboard` | `views/applications.md` | ✅ Bon |
| `/cloudflare/dashboard` | `cloudflareResources.js:dashboard` | `features/drift-detection.md` | 🔄 A fusionner |

---

## 1. Tokens Dashboard (`/dashboard`)

### Existant
```
ui.js:dashboard
├── Generer un token (POST /iam/service-tokens)
├── Liste "Mes tokens" (GET /iam/service-tokens)
├── Revoquer (DELETE /iam/service-tokens/:id)
└── Copie .env format
```

### Correspondance Spec (`views/tokens.md`)
- ✅ Self-service generation
- ✅ Liste avec etats (actif/revoque)
- ✅ Revocation
- ✅ Format .devcontainer/.env
- ⚠️ **A ajouter** : Onglet "All Tokens" (admin only)
- ⚠️ **A ajouter** : Filtres (User, Status, App)
- ⚠️ **A ajouter** : Bulk actions

### Actions requises
1. Ajouter tabs "My Tokens" / "All Tokens"
2. Ajouter filtres dans vue admin
3. Pas de refonte majeure necessaire

---

## 2. Applications Dashboard (`/applications/dashboard`)

### Existant
```
ui.js:applicationsDashboard
├── Stats (total, actives, ressources)
├── Grid applications avec cards
├── Create modal (name, scopes, contact)
├── Credentials modal (one-time show)
├── Details modal (roles, permissions crees)
├── Rotation credentials
└── Revocation
```

### Correspondance Spec (`views/applications.md`)
- ✅ Stats overview
- ✅ Cards avec namespace, scopes, status
- ✅ Create avec scopes checkboxes
- ✅ Rotation credentials
- ✅ Details modal
- ⚠️ **A ajouter** : Audiences avec sync status
- ⚠️ **A ajouter** : Authorized Groups section
- ⚠️ **A ajouter** : Sync CF button
- ⚠️ **A ajouter** : Filtres (Org, Status)

### Actions requises
1. Ajouter section "Audiences" dans detail
2. Ajouter affichage sync status (sys_infra_state)
3. Ajouter bouton "Sync Now"
4. Ajouter section "Authorized Groups"
5. Ajouter filtres en haut de liste

---

## 3. Cloudflare Dashboard (`/cloudflare/dashboard`)

### Existant
```
cloudflareResources.js:dashboard
├── Stats (Access apps, Workers, Pages, Deployments)
├── Section CF Access (apps list)
├── Section Workers (list avec bindings)
├── Section Pages (list avec deployments)
└── Details expandables pour chaque ressource
```

### Position dans nouvelle Spec
Cette vue est **hors IAM strict** - c'est de la visibility infrastructure.

**Options** :
1. **Option A** : Garder separee sous "Settings > Infrastructure"
2. **Option B** : Fusionner dans `features/drift-detection.md`

### Recommandation : Option B (Fusion)

La section "CF Access" de cette vue devrait etre fusionnee avec Drift Detection :
- Garder les stats CF Access
- Ajouter le drift status a chaque groupe
- Ajouter les boutons "Sync Now"

Les sections Workers/Pages sont utiles mais pas IAM :
- Deplacer vers "Settings > Infrastructure" ou supprimer

---

## Navigation Actuelle vs Spec

### Actuelle
```
Nav: [Tokens] [Applications] [Cloudflare] [user] [Logout]
```

### Spec (`01-navigation.md`)
```
Nav: [Dashboard] [Identity] [Access] [Insights] [Settings] [user] [Logout]
              │         │         │          │
              ├ Users   ├ Apps    ├ Graph    └ Organizations
              ├ Groups  ├ Tokens  ├ What-If    Infrastructure
              └ Roles   └ Matrix  ├ Audit
                                  └ Drift
```

### Migration suggérée

Phase 1 (minimal) :
- Renommer "Tokens" → Garder sous /dashboard temporairement
- Garder "Applications" tel quel
- Integrer "Cloudflare" dans future vue Drift

Phase 2 (full spec) :
- Implementer la nouvelle navigation complete
- Migrer Tokens vers /access/tokens
- Migrer Applications vers /access/applications
- Creer les vues manquantes (Users, Groups, Roles, etc.)

---

## Design System - Coherence

### TPB_STYLES existants (a conserver)
```css
:root {
  --background: #0A0A0A;
  --foreground: #FAFAFA;
  --card: #171717;
  --border: #262626;
  --muted: #A3A3A3;
  --accent: #FFD700;      /* Gold - TPB brand */
  --brand-blue: #0057FF;
  --brand-purple: #6A00F4;
  --destructive: #EF4444;
  --success: #22C55E;
}
```

### Fonts (a conserver)
- **Headings** : Space Grotesk (600-700)
- **Body** : Inter (400-600)
- **Code** : JetBrains Mono

### Composants existants (a reutiliser)
- `.btn`, `.btn-primary`, `.btn-accent`, `.btn-ghost`, `.btn-destructive`
- `.card`
- `.badge`, `.badge-success`, `.badge-warning`, `.badge-info`
- `.spinner`
- `.code-block`, `.copy-btn`
- `.modal`, `.modal-content`
- `.form-group`, `.form-hint`

---

## Resume des Actions

### Quick Wins (existant + delta)
1. **Tokens** : Ajouter vue admin "All Tokens"
2. **Applications** : Ajouter Audiences + Sync Status
3. **Cloudflare** : Fusionner CF Access avec Drift Detection

### Nouvelles Vues Requises
- Dashboard (home avec metriques)
- Users (liste + detail)
- Groups (liste + detail + sync)
- Roles & Permissions
- Permissions Matrix
- Audit Stories
- Features differenciantes (Explain, Graph, What-If, etc.)

### Pas de Refonte Majeure
Les vues existantes sont bien faites et peuvent etre enrichies incrementalement.
Le Design System TPB est coherent et doit etre reutilise.

