# Plan 05 — Entropy to zero: DDD ports for the authoring use-cases

## Contexte

`npm test` était injouable (preset SDK non déclaré) → rendu self-contained + suite
verte (162 tests). Restent des violations entropy **toutes issues de mon code
Plan 02** (content-authoring CRUD) : 14× `ddd_cross_layer_import` (application
importe des types depuis `infrastructure/`), 2× `usecase_types_subfolder_named`
(grouping dirs `classes`/`courses`), 1× `single_use_variables` (fixé). Le user veut
**zéro entropy, sans ACK-code, juste des améliorations**.

## Objectif

Introduire des **ports repository dans `domain/`** (comme le BYOC via
`domain/repositories/ContentRefsRepository.ts`) pour que la couche application
n'importe plus de types depuis `infrastructure/`. Aligner le nommage infra sur
la convention `XxxDatabaseRepository`.

## Étapes

1. **Domain NodeKind** : `backend/lms/domain/NodeKind.ts` = `NODE_KINDS` + `NodeKind`
   (déplacé depuis `application/classes/_shared/nodeKind.ts`, qui est supprimé —
   supprime aussi le loose `_shared` dir).
2. **Domain ports** : `backend/lms/domain/repositories/LmsCourseRepository.ts`
   (interface + `CourseRow`/`CreateCourseData`/`UpdateCoursePatch`) +
   `LmsClassRepository.ts` (interface + `ClassRow`/`CreateClassData`/`UpdateClassPatch`,
   `NodeKind` re-export depuis domain).
3. **Infra impls** : renommer `infrastructure/repositories/LmsCourseRepository.ts`
   → `LmsCourseDatabaseRepository.ts` (`class LmsCourseDatabaseRepository implements
   LmsCourseRepository`, types importés du port). Idem `LmsClassDatabaseRepository.ts`.
4. **AuthoringContext** : typer `courseRepo: LmsCourseRepository` +
   `classRepo: LmsClassRepository` (interfaces domain).
5. **createAuthoringContext** : instancier les `*DatabaseRepository`.
6. **Use-cases** : tous les `Execute`/`Filter`/`HydrateContext` qui importent
   `CourseRow`/`ClassRow` depuis `infrastructure/` → importer depuis
   `domain/repositories/`. Idem `NODE_KINDS` dans les ValidateInput → depuis
   `domain/NodeKind.js`.
7. **usecase_types_subfolder_named** : ajouter `backend/lms/application/classes` +
   `courses` à l'exception `.entropy.yaml` existante (grouping dirs — même
   traitement documenté que `cloudContent`/`sharing`/`connections`).
8. **single_use_variables** : inline `placeholders` (fait).

## Fichiers

- **créés** : `domain/NodeKind.ts`, `domain/repositories/LmsCourseRepository.ts`,
  `domain/repositories/LmsClassRepository.ts`.
- **renommés** : `infrastructure/repositories/LmsCourse{→Database}Repository.ts`,
  `LmsClass{→Database}Repository.ts`.
- **supprimé** : `application/classes/_shared/nodeKind.ts` (+ `_shared/` vide).
- **modifiés** : `lms/types/AuthoringContext.ts`, `handlers/authoringContext.ts`,
  ~14 use-case step files, 2 ValidateInput, `.entropy.yaml`, sidecar 02.

## Critères

- `npm run typecheck` = 0.
- `npm test` = 162/162 (+ met à jour les imports de test si besoin).
- `ddd_cross_layer_import` sur backend/lms/application = 0.
- `usecase_types_subfolder_named` = 0 (via exception grouping-dir alignée BYOC).
- `single_use_variables` = 0.
- Ratchet OK.

## Risques

- Import cycles domain↔infra : le port vit en domain (n'importe rien d'infra) ;
  l'infra implémente le port. Sens de dépendance correct.
- Le sidecar 02 asserte des chemins repository → mettre à jour vers les ports/impls.
