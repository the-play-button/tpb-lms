# TPB Vault IAM Console - Overview

## Positionnement Produit

### Ce que vault-api EST

- **Authorization Server OAuth 2.0 LIKE** 
- Gestion coarse-grained : qui peut acceder a quelle app avec quels scopes
- Multi-tenant (Organizations)
- RBAC standard (Roles, Permissions)
- Sync infrastructure (Cloudflare Access)

### Ce que vault-api N'EST PAS

- Un systeme de permissions fine-grained metier
- Un moteur ReBAC (relations entre entites metier)
- Un resource server (qui est cote app, pas cote IAM)

---

## Inspirations Marche

| Solution | Points Forts | A Eviter |
|----------|--------------|----------|
| Auth0 Dashboard | Simple, bon onboarding | Cauchemar a scale |
| Okta Admin Console | Complet, enterprise | 15+ onglets, labyrinthe |
| AWS IAM Console | Puissant, granulaire | Policies JSON illisibles |
| Cloudflare Zero Trust | Edge-native, rapide | UI limitee |
| Azure AD | Integration Microsoft | Terminologie opaque |

---

## Pain Points Universels (a resoudre)

1. **Aucune solution ne repond a "Montre-moi TOUT ce que peut faire cet utilisateur"**
2. **Pas d'explication des refus d'acces** - juste "Access Denied"
3. **Sync infrastructure = boite noire** - drift invisible
4. **Audit = logs techniques** - pas comprehensibles par un humain
5. **Pas de preview avant changement** - pas de filet de securite

---

## Differenciateurs TPB Vault (6 Features)

| Feature | Probleme Marche | Solution TPB |
|---------|-----------------|--------------|
| **Explain Mode** | "Access Denied" sans contexte | Explique POURQUOI + propose solutions |
| **Access Graph** | Puzzle mental pour comprendre | Visualisation interactive des chemins |
| **Drift Detection** | Sync = fire & forget | Detection proactive des ecarts |
| **Audit Stories** | Logs JSON techniques | Narration humaine + revert possible |
| **What-If Simulator** | Yolo, pas de preview | Simulation avant application |
| **NL Policies** | JSON cryptique | Langage naturel bidirectionnel |

---

## Architecture Globale

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TPB VAULT IAM CONSOLE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  IDENTITY           ACCESS              INSIGHTS                    │
│  ─────────          ──────              ────────                    │
│  • Users            • Applications      • Access Graph              │
│  • Groups           • Service Tokens    • What-If Simulator         │
│  • Roles            • Permissions       • Audit Stories             │
│                       Matrix            • Drift Detection           │
│                                                                     │
│  DIFFERENCIATEURS (transverses)                                     │
│  ─────────────────────────────                                      │
│  🔍 Explain Mode (global search)                                    │
│  📝 Natural Language Policies (dans Roles)                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Ce qui N'est PAS dans ce plan

- **Heritages de permissions** → cote apps (cf. prototype DECK)
- **Tree view d'entites metier** → cote apps
- **Logique commerciale/billing** → autre domaine
- **Fine-grained ReBAC** → cote apps
- **UI de gestion des secrets** → deja existante

---

## Schema DB Existant (Zero Extension)

Le schema actuel couvre tous les besoins IAM :

```
iam_organization (tenants)
    └── iam_user (identites)
            └── iam_user_group (membership)
    └── iam_group (teams)
            └── iam_group_role (role assignment)
    └── iam_role (RBAC)
            └── iam_role_permission
    └── iam_permission (action:resource)
    └── iam_application (OAuth clients)
            └── sys_infra_state (sync CF)
    └── iam_service_token (M2M)

sys_audit_log (audit trail)
```

Voir [schema-mapping](./views/README.md) pour le mapping detaille par vue.

