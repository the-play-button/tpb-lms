# Plan: CRUD+List Endpoint Refactor — tpb-lms

> **CE PLAN N'EST PAS ACTIONNABLE EN L'ETAT.** Il decrit la direction (quels endpoints renommer vers quelles entites) mais ne garantit pas zero regression. Avant d'executer, l'agent DOIT : (1) analyser la codebase en profondeur pour chaque rename, (2) identifier tous les consumers internes et externes, (3) verifier que le rename ne casse aucune feature existante, (4) adapter le plan si necessaire. Le plan est un guide d'intention, pas un script d'execution.

## Contexte

L'entropy check `ddd_endpoint_granularity` a detecte 4 endpoints dont le nommage ne suit pas la convention CRUD+list.
Ref: `crud_list_only_endpoint_design.md` dans tpb-cock.

**Attention** : tpb-lms utilise les noms de pipeline **deprecated** (Assert au lieu de ValidateInput) et une structure **mixte** — certains use cases sont dans des sous-dossiers (`shareContent/`, `revokeShare/`), d'autres sont des fichiers plats directement dans `backend/application/sharing/` (`sharedByMe*.ts`, `sharedWithMe*.ts`). Ce plan ne couvre PAS la migration des noms de pipeline ni la normalisation de la structure — uniquement le rename des use cases.

## Routeur

**Fichier** : `backend/index.js` (CF Worker entry point — routes inline, pas de fichier routes.ts separe)

Routes concernees (section "BYOC - Sharing") :
- `GET /api/content/shared-by-me` → `sharedByMeController`
- `GET /api/content/shared-with-me` → `sharedWithMeController`
- `DELETE /api/content/:contentRefId/share/:shareId` → `revokeShareController`
- `POST /api/content/:contentRefId/share` → `shareContentController`

## Violations detectees

| Endpoint actuel | Action | Nouveau nom | Raison |
|---|---|---|---|
| `sharedByMe` | **Rename** | `listSharedByMe` | "shared by me" = lister les contenus partages par moi. Pattern `list*`. |
| `sharedWithMe` | **Rename** | `listSharedWithMe` | "shared with me" = lister les contenus partages avec moi. Pattern `list*`. |
| `revokeShare` | **Rename** | `deleteShare` | Revoquer un partage = supprimer un partage. Pattern `delete*`. |
| `shareContent` | **Rename** | `createShare` | Partager du contenu = creer un partage. Pattern `create*`. |

---

## Etape 1 — Rename `sharedByMe` → `listSharedByMe`

### Fichiers du use case (4 fichiers plats — PAS dans un sous-dossier)

**Attention** : ces fichiers sont directement dans `backend/application/sharing/` — PAS dans un sous-dossier `sharedByMe/`.

| Fichier actuel | Nouveau nom |
|---|---|
| `backend/application/sharing/sharedByMeHandle.ts` | `backend/application/sharing/listSharedByMe/listSharedByMeHandle.ts` |
| `backend/application/sharing/sharedByMeController.ts` | `backend/application/sharing/listSharedByMe/listSharedByMeController.ts` |
| `backend/application/sharing/sharedByMeAssert.ts` | `backend/application/sharing/listSharedByMe/listSharedByMeAssert.ts` |
| `backend/application/sharing/sharedByMeExecute.ts` | `backend/application/sharing/listSharedByMe/listSharedByMeExecute.ts` |

**Action** : creer le dossier `listSharedByMe/`, deplacer + renommer les 4 fichiers, creer un `index.ts` barrel.

### Fichier routeur a mettre a jour

**Fichier** : `backend/index.js`

Modifications :
- Import : `import { sharedByMeController } from './application/sharing/sharedByMeController';`
  → `import { listSharedByMeController } from './application/sharing/listSharedByMe/index';`
- Route : `GET /api/content/shared-by-me` → handler `sharedByMeController`
  → handler `listSharedByMeController`

---

## Etape 2 — Rename `sharedWithMe` → `listSharedWithMe`

### Fichiers du use case (4 fichiers plats — PAS dans un sous-dossier)

| Fichier actuel | Nouveau nom |
|---|---|
| `backend/application/sharing/sharedWithMeHandle.ts` | `backend/application/sharing/listSharedWithMe/listSharedWithMeHandle.ts` |
| `backend/application/sharing/sharedWithMeController.ts` | `backend/application/sharing/listSharedWithMe/listSharedWithMeController.ts` |
| `backend/application/sharing/sharedWithMeAssert.ts` | `backend/application/sharing/listSharedWithMe/listSharedWithMeAssert.ts` |
| `backend/application/sharing/sharedWithMeExecute.ts` | `backend/application/sharing/listSharedWithMe/listSharedWithMeExecute.ts` |

**Action** : creer le dossier `listSharedWithMe/`, deplacer + renommer les 4 fichiers, creer un `index.ts` barrel.

### Fichier routeur a mettre a jour

**Fichier** : `backend/index.js`

Modifications :
- Import : `import { sharedWithMeController } from './application/sharing/sharedWithMeController';`
  → `import { listSharedWithMeController } from './application/sharing/listSharedWithMe/index';`
- Route : `GET /api/content/shared-with-me` → handler `sharedWithMeController`
  → handler `listSharedWithMeController`

---

## Etape 3 — Rename `revokeShare` → `deleteShare`

### Fichiers du use case (7 fichiers dans un sous-dossier)

Dossier : `backend/application/sharing/revokeShare/`

| Fichier actuel | Nouveau nom |
|---|---|
| `revokeShareHandle.ts` | `deleteShareHandle.ts` |
| `revokeShareController.ts` | `deleteShareController.ts` |
| `revokeShareAssert.ts` | `deleteShareAssert.ts` |
| `revokeShareValidateInput.ts` | `deleteShareValidateInput.ts` |
| `revokeShareHydrateContext.ts` | `deleteShareHydrateContext.ts` |
| `revokeShareCheckPolicies.ts` | `deleteShareCheckPolicies.ts` |
| `revokeShareExecute.ts` | `deleteShareExecute.ts` |

Renommer le dossier : `revokeShare/` → `deleteShare/`

**Note** : ce use case a DEUX fichiers de validation d'input (`revokeShareAssert.ts` ET `revokeShareValidateInput.ts`). C'est une inconsistance deprecated. Le rename conserve les deux fichiers — la normalisation des noms de pipeline est un plan separe.

### Fichier routeur a mettre a jour

**Fichier** : `backend/index.js`

Modifications :
- Import : `import { revokeShareController } from './application/sharing/revokeShare/revokeShareController';`
  → `import { deleteShareController } from './application/sharing/deleteShare/deleteShareController';`
- Route : `DELETE /api/content/:contentRefId/share/:shareId` → handler `revokeShareController`
  → handler `deleteShareController`

---

## Etape 4 — Rename `shareContent` → `createShare`

### Fichiers du use case (8 fichiers dans un sous-dossier)

Dossier : `backend/application/sharing/shareContent/`

| Fichier actuel | Nouveau nom |
|---|---|
| `shareContentHandle.ts` | `createShareHandle.ts` |
| `shareContentController.ts` | `createShareController.ts` |
| `shareContentAssert.ts` | `createShareAssert.ts` |
| `shareContentValidateInput.ts` | `createShareValidateInput.ts` |
| `shareContentHydrateContext.ts` | `createShareHydrateContext.ts` |
| `shareContentCheckPolicies.ts` | `createShareCheckPolicies.ts` |
| `shareContentExecute.ts` | `createShareExecute.ts` |
| `shareContentFilter.ts` | `createShareFilter.ts` |

Renommer le dossier : `shareContent/` → `createShare/`

**Note** : meme inconsistance que `revokeShare` — a la fois `Assert` et `ValidateInput`. Le rename conserve les deux.

### Fichier routeur a mettre a jour

**Fichier** : `backend/index.js`

Modifications :
- Import : `import { shareContentController } from './application/sharing/shareContent/shareContentController';`
  → `import { createShareController } from './application/sharing/createShare/createShareController';`
- Route : `POST /api/content/:contentRefId/share` → handler `shareContentController`
  → handler `createShareController`

---

## Verification finale

```bash
npx tsc --noEmit  # zero erreurs TypeScript
python3 -m tpb_sdk.entropy --path . --format lint | grep ddd_endpoint_granularity  # 0 violations
```

## Fichiers modifies (resume)

| Fichier | Type de modification |
|---|---|
| `backend/application/sharing/sharedByMe*.ts` (4 fichiers plats) | Deplacer + rename → `listSharedByMe/` (nouveau dossier) |
| `backend/application/sharing/sharedWithMe*.ts` (4 fichiers plats) | Deplacer + rename → `listSharedWithMe/` (nouveau dossier) |
| `backend/application/sharing/revokeShare/` (7 fichiers) | Rename → `deleteShare/` |
| `backend/application/sharing/shareContent/` (8 fichiers) | Rename → `createShare/` |
| `backend/index.js` | 4 imports + 4 handlers rename |

## Notes

- **Structure mixte** : `sharedByMe` et `sharedWithMe` sont des fichiers plats — le plan les reorganise en sous-dossiers (normalisation structurelle).
- **Pipeline deprecated** : tous les use cases utilisent `Assert` au lieu de `ValidateInput`. Le rename conserve le nom deprecated — la migration pipeline est un chantier separe.
- **Pas de consumers cross-repo** : tous les appels sont internes a tpb-lms.
