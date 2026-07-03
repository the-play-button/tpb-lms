## Ce qui a été fait

Ajout du **write-layer manquant** : le LMS expose désormais create/update/delete
sur `lms_course` + `lms_class` (Tier 1 CRUD, pipeline DDD 9-step). L'API est
réellement CRUD, et la classroom est ingérable via API (plus de SQL direct).

- **Repositories D1** (`backend/lms/infrastructure/repositories/`) :
  - `LmsCourseRepository` — `findById` / `insert` (idempotent `INSERT OR IGNORE`) /
    `update` (patch dynamique) / `delete`.
  - `LmsClassRepository` — idem + `findByCourse`, `collectSubtreeIds` +
    `deleteSubtree` (CTE récursive adjacency-list), `deleteByCourse`.
- **`AuthoringContext`** (`backend/lms/types/`) + **`createAuthoringContext`**
  bridge (`backend/handlers/`) — contexte lean (db + actor + repos). Authz **PBAC
  `hasScope`** sur `actor.scopes` (pas de ReBAC delegated — cf. CLAUDE.md § AUTHZ
  PBAC FIRST → zéro roundtrip bastion, zéro authz_policy à seeder).
- **6 use-cases** (60 fichiers) sous `backend/lms/application/{courses,classes}/`,
  générés par un script déterministe (S+), chacun avec ses 9 steps + index :
  `createCourse`, `updateCourse`, `deleteCourse`, `createClass`, `updateClass`,
  `deleteClass`.
  - **Invariants d'arbre** (`createClass`/`updateClass` ValidateContext) : SECTION
    sans média, parent = SECTION du même course (pas de LESSON-parent, pas de
    cross-course), pas de cycle (via `collectSubtreeIds`).
  - `deleteCourse` cascade les classes (`deleteByCourse`) ; `deleteClass` cascade
    le sous-arbre (`deleteSubtree`).
  - Idempotence ré-ingestion : `id` optionnel dans le body → `INSERT OR IGNORE`.
  - Actor stampé dans `raw_json.tpb_created_by` (pas de changement ERD).
- **6 routes** `POST/PATCH/DELETE /api/courses` + `/api/classes` câblées dans
  `backend/index.js` (`authoringRoutes` + `registerRoutes`).
- **`_shared/httpStatus.ts`** — mapping error→status partagé.
- **`authoring.invariants.test.ts`** — 8 tests vitest (invariants + cycle + gate).

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `backend/lms/infrastructure/repositories/LmsCourseRepository.ts` | **créé** |
| `backend/lms/infrastructure/repositories/LmsClassRepository.ts` | **créé** (deleteSubtree CTE) |
| `backend/lms/types/AuthoringContext.ts` | **créé** |
| `backend/handlers/authoringContext.ts` | **créé** — bridge |
| `backend/lms/application/_shared/httpStatus.ts` | **créé** |
| `backend/lms/application/{courses,classes}/*/` | **créés** — 6 use-cases × 10 fichiers |
| `backend/lms/application/classes/authoring.invariants.test.ts` | **créé** — 8 tests |
| `backend/index.js` | 6 imports + `authoringRoutes` + registration |
| `02-...plan.after.py` | **créé** — sidecar |

## Résultat de validation

- ✅ `npx tsc --noEmit` : **0 erreur** (tout le projet, y compris les 60 fichiers).
- ✅ Recursive-CTE subtree collection validée sur D1 locale (sec1 → sec1a → les1).
- ✅ Vitest `authoring.invariants.test.ts` : **8/8 pass** (SECTION+media rejet,
  LESSON-parent rejet, cross-course rejet, move légal, cycle rejet, hasScope gate).
- ✅ Sidecar `02-...plan.after.py` : **all pass** (60 fichiers step présents, 6 routes
  câblées, invariants + PBAC hasScope + cascade présents).

## Notes / suivi

- **Scopes bastion** : `lms:course:write` + `lms:class:write` doivent être accordés
  à l'app bastion LMS (op bastion co-localisée) pour que les PAT/JWT porteurs
  puissent écrire. C'est une opération infra de déploiement, hors périmètre code de
  cette initiative.
- **Smoke HTTP end-to-end** (wrangler dev + auth réelle) non exécuté ici : nécessite
  le worker en runtime + un JWT. Les couches (SQL, invariants, gate) sont validées
  isolément ; le smoke live se fera au déploiement.
