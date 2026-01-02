# Phase 0 : Extraction de l'Existant

> Approche pragmatique : Avant de coder, on extrait le code existant des handlers backend dans un dossier `_to_refacto/` qui servira de reference pendant le refacto.

---

## Structure `_to_refacto/`

```
lms/core/vault-api/frontend/
├── _to_refacto/                              # CODE EXISTANT A PORTER
│   ├── README.md                             # Mapping existant -> cible
│   ├── TPB_STYLES.css                        # Extraction des CSS variables
│   ├── tokens/
│   │   ├── dashboard.html                    # HTML extrait de ui.js:dashboard
│   │   └── dashboard.js                      # JS extrait (loadTokens, generateToken, etc.)
│   ├── applications/
│   │   ├── dashboard.html                    # HTML extrait de ui.js:applicationsDashboard
│   │   └── dashboard.js                      # JS extrait (loadApplications, createApp, etc.)
│   └── cloudflare/
│       ├── dashboard.html                    # HTML extrait de cloudflareResources.js:dashboard
│       └── dashboard.js                      # JS extrait (loadAllData, renderStats, etc.)
└── src/                                      # NOUVEAU CODE REACT
```

---

## Fichiers Sources a Extraire

| Source Backend | Extraire vers | Cible finale |
|----------------|---------------|--------------|
| `backend/handlers/ui.js:dashboard` (L484-743) | `_to_refacto/tokens/` | `src/app/[locale]/Tokens/` |
| `backend/handlers/ui.js:applicationsDashboard` (L744-1173) | `_to_refacto/applications/` | `src/app/[locale]/Applications/` |
| `backend/handlers/cloudflareResources.js:dashboard` (L433-884) | `_to_refacto/cloudflare/` | `src/app/[locale]/Cloudflare/` |
| `backend/handlers/ui.js:TPB_STYLES` (L16-410) | `_to_refacto/TPB_STYLES.css` | `src/app/globals.css` + `src/themes/` |

---

## Mapping Vues Existantes

### Vue 1 : Tokens

| Existant | Cible |
|----------|-------|
| `ui.js:dashboard` (L484-743) | `src/app/[locale]/Tokens/` |
| `loadTokens()` | `Tokens.logic/useTokensList.ts` |
| `generateToken()` | `Tokens.logic/useGenerateToken.ts` |
| `revokeToken()` | inline dans `useTokensList.ts` |
| `copyEnvFile()` | `Tokens.functions/formatTokenForEnv.ts` |
| Token card HTML | `Tokens.components/TokenCard.tsx` |
| Generate modal HTML | `Tokens.components/GenerateTokenModal.tsx` |

**Endpoints backend** : `GET/POST/DELETE /iam/service-tokens`

### Vue 2 : Applications

| Existant | Cible |
|----------|-------|
| `ui.js:applicationsDashboard` (L744-1173) | `src/app/[locale]/Applications/` |
| `loadApplications()` | `Applications.logic/useApplicationsList.ts` |
| `createApplication()` | `Applications.logic/useCreateApp.ts` |
| `rotateCredentials()` | `Applications.logic/useRotateCredentials.ts` |
| `revokeApp()` | inline ou separate hook |
| Stats cards HTML | `Applications.components/StatsCards.tsx` |
| App card HTML | `Applications.components/ApplicationCard.tsx` |
| Create modal HTML | `Applications.components/CreateAppModal.tsx` |
| Details modal HTML | `Applications.components/AppDetailsModal.tsx` |

**Endpoints backend** : `GET/POST/PATCH/DELETE /iam/applications`, `/rotate-credentials`

### Vue 3 : Cloudflare

| Existant | Cible |
|----------|-------|
| `cloudflareResources.js:dashboard` (L433-884) | `src/app/[locale]/Cloudflare/` |
| `loadAllData()` | `Cloudflare.logic/useCloudflareResources.ts` |
| `renderStats()` | `Cloudflare.components/StatsCards.tsx` |
| `renderAccessApps()` | `Cloudflare.components/AccessAppsList.tsx` |
| `renderWorkers()` | `Cloudflare.components/WorkersList.tsx` |
| `renderPages()` | `Cloudflare.components/PagesList.tsx` |
| Expandable details | `Cloudflare.components/ResourceDetails.tsx` |

**Endpoints backend** : `GET /cloudflare/resources`, `/resources/:type`, `/resources/:type/:id`

---

## Contenu README.md (_to_refacto/)

Le README.md dans `_to_refacto/` contient :

- Mapping Existant -> Cible pour chaque vue
- Fonctions JS a porter en React (avec nom cible)
- Composants HTML a porter (avec nom cible)
- Design System TPB (mapping CSS -> shadcn)

