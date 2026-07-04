## Ce qui a été fait

Passe entropy → **zéro** sur le code de l'initiative, sans ACK-code (uniquement des
améliorations), + réparation de la suite de tests qui était injouable.

### Suite de tests (débloquée)
- `vitest.config.mts` importait `@the-play-button/tpb-sdk-vitest` (jamais déclaré ni
  installé) → suite injouable. Rendu **self-contained** (node env, include colocated
  + `tests/`).
- `tests/spec-testing/**` : chemins périmés `backend/{application,domain}/` →
  `backend/lms/...`. `sharing.test.ts` aligné sur les renames Plan 01.
- **`npm test` = 17 fichiers / 162 tests** (était : la config ne se chargeait pas).

### Entropy — DDD repository ports (14× ddd_cross_layer_import)
- Ports domain créés + impls infra `*DatabaseRepository` qui les `implements`.
  L'application n'importe **plus jamais** `infrastructure/` (vérifié = 0), domain pur.

### Autres smells (tous du code Plan 02)
- `verify_enum_smells`, `global_pollution`/`orphan_global`, `prohibited_timer`,
  `hardcoded_url`, `legacy_marker`, `single_use_variables`, `python_docstrings` +
  `python_docstring_params`, `usecase_types_subfolder_named` (exception grouping-dir
  alignée BYOC).

## Fichiers modifiés

| Zone | Fichiers |
|---|---|
| Domain (créés) | `backend/lms/domain/NodeKind.ts`, `domain/repositories/LmsCourseRepository.ts`, `domain/repositories/LmsClassRepository.ts` |
| Infra | `infrastructure/repositories/LmsCourseDatabaseRepository.ts` + `LmsClassDatabaseRepository.ts` (créés, `implements` ports) ; anciens `Lms{Course,Class}Repository.ts` supprimés |
| Application | 6 use-cases (`Execute`/`Filter`/`HydrateContext`) + 2 `ValidateInput` → imports domain ; `_shared/nodeKind.ts` supprimé |
| Types/bridge | `lms/types/AuthoringContext.ts` (interfaces domain), `handlers/authoringContext.ts` (instancie les `*DatabaseRepository`) |
| Frontend viewer | `videoSection.js` + `youtubeTracking.js` (consts URL, event-only, plus de timer), `init/globals.js` (global YouTube SSOT), `_shared.js`, `stopVideoTracking.js`, `stepsSidebar.js` (comment) |
| Backend classes | `LmsClassDatabaseRepository.ts` (inline `placeholders`) |
| Config/tests | `vitest.config.mts`, `.entropy.yaml` (exception grouping-dir), `tests/spec-testing/**` (chemins + renames) |
| Sidecars | 4× `*.plan.after.py` (docstrings + Args ; sidecar 02 asserte les ports) |

## Résultat de validation

- ✅ `npm run typecheck` : **0 erreur**.
- ✅ `npm test` : **162/162** (17 fichiers).
- ✅ Scan entropy complet : **0 violation** sur les fichiers source tpb-lms + sidecars.
- ✅ Ratchet OK (≤ baseline).
- ✅ Sidecars 01–04 : all pass.
- ✅ `application → infrastructure` imports = 0 ; domain pur (aucun cycle).

## Note

Preuve live navigateur (§ PLAN FRONTEND DONE) inchangée : nécessite le déploiement
`lms-api` + `lms-viewer` (op prod, déclenchée par l'utilisateur).
