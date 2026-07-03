# Plan 02 — Content-authoring CRUD API (write-layer manquant)

> **Exécuté APRÈS 03 (nesting ERD)** : les endpoints classes consomment
> `parent_class_id` + `node_kind`. **AVANT 01 (rename)** : ces nouveaux endpoints
> naissent déjà conformes CRUD.

## Contexte

Validation upstream : `grep -cE "POST.*'/api/courses'|PATCH..."` = 0. Le LMS n'a
aucun endpoint create/update/delete sur `lms_course` / `lms_class`. C'est le plus
gros écart CRUD (une API sans C/U/D n'est pas CRUD) et le blocage direct pour
ingérer la classroom scrappée (12 cours, 714 modules) autrement qu'en SQL direct
(interdit, CLAUDE.md § DB). Le plan 03 (nesting) est un prérequis : `createClass`
consomme `parent_class_id` + `node_kind`.

## Objectif

Combler le trou : le LMS n'expose aucun `POST/PATCH/DELETE` sur ses entités
cœur. Résultat — (a) l'API n'est pas réellement "CRUD" (C/U/D absents), (b) on ne
peut pas ingérer la classroom Nick Saraev (12 cours, 714 modules) autrement qu'en
SQL direct (interdit). On ajoute le write-layer, en pipeline DDD 9-step, Tier 1.

## Entités concernées

- `lms_course` — cours (racine de l'arbre).
- `lms_class` — nœud d'arbre (SECTION ou LESSON après plan 03).

## Endpoints à créer (tous Tier 1)

| Méthode | Path | Use case | Entité |
|---|---|---|---|
| POST | `/api/courses` | `createCourse` | lms_course |
| PATCH | `/api/courses/:courseId` | `updateCourse` | lms_course |
| DELETE | `/api/courses/:courseId` | `deleteCourse` | lms_course (cascade classes) |
| POST | `/api/classes` | `createClass` | lms_class (`{ courseId, parentClassId?, nodeKind, name, mediaJson?, ... }`) |
| PATCH | `/api/classes/:classId` | `updateClass` | lms_class |
| DELETE | `/api/classes/:classId` | `deleteClass` | lms_class (cascade sous-arbre) |

> `create*/update*/delete*` = préfixes Tier 1 blessés → 0 ACK entropy nécessaire.
> `POST /api/classes` porte `parentClassId` (nesting) + `nodeKind`
> (`SECTION`|`LESSON`) posés par plan 03.

## Pipeline 9-step (par use case)

Structure `backend/lms/application/courses/{createCourse,updateCourse,deleteCourse}/`
et `backend/lms/application/classes/{createClass,updateClass,deleteClass}/`, un
fichier par step (`Controller`, `Handle`, `ValidateInput`, `HydrateContext`,
`ValidateContext`, `CheckPolicies`, `Execute`, `Filter`, `Track`) + `index.ts`
barrel. Modèle : copier la structure de
`backend/lms/application/cloudContent/getCloudContent/` (déjà 9-step propre) —
mais avec les noms de step **canoniques** (`ValidateInput`, pas `Assert`).

Points spécifiques :

- **ValidateInput** : Zod schema. `createCourse` = `{ name, description?, mediaJson?, categoriesJson?, isPrivate?, languagesJson? }`. `createClass` = `{ courseId, parentClassId?, nodeKind:'SECTION'|'LESSON', name, description?, mediaJson?, sysOrderIndex? }`.
- **HydrateContext** : pour `createClass`, charger le course + le parent (si `parentClassId`) pour valider l'appartenance à l'arbre.
- **ValidateContext** : invariants — un `LESSON` peut porter `mediaJson`, un `SECTION` non (folder pur) ; `parentClassId` doit référencer un `SECTION` du même `courseId` (pas de leçon-parent) ; pas de cycle (le parent ne peut pas être un descendant).
- **CheckPolicies** : scope authz `lms:course:write` / `lms:class:write` via bastion `hasScope` (PBAC literal, cf. CLAUDE.md § AUTHZ — PBAC FIRST). Pas de ReBAC.
- **Execute** : INSERT/UPDATE/DELETE via repository. `deleteCourse`/`deleteClass` = delete récursif du sous-arbre (adjacency-list → CTE récursive ou delete en cascade applicatif). Écriture idempotente si `idempotency_key` fourni.
- **Filter** : renvoyer l'entité créée/modifiée, champs scopés par actor.
- **Track** : audit fire-and-forget.

## Routes (dans `backend/index.js`)

Ajouter dans `standardRoutes` (ou un nouveau `authoringRoutes` sous scope
`lms:*:write`) :

```js
{ method: 'POST',   path: '/api/courses',            handler: createCourseController },
{ method: 'PATCH',  path: '/api/courses/:courseId',  handler: updateCourseController, params: ['courseId'] },
{ method: 'DELETE', path: '/api/courses/:courseId',  handler: deleteCourseController, params: ['courseId'] },
{ method: 'POST',   path: '/api/classes',            handler: createClassController },
{ method: 'PATCH',  path: '/api/classes/:classId',   handler: updateClassController,  params: ['classId'] },
{ method: 'DELETE', path: '/api/classes/:classId',   handler: deleteClassController,  params: ['classId'] },
```

## Repository

Étendre / créer `backend/lms/infrastructure/` avec un `LmsCourseRepository` +
`LmsClassRepository` (D1). Méthodes : `insert`, `update`, `deleteSubtree`,
`findById`, `findChildren(parentId)`. Réutiliser le pattern des repos existants
sous `backend/lms/infrastructure/`.

## Étapes

1. **Repositories** : créer `LmsCourseRepository` + `LmsClassRepository` sous
   `backend/lms/infrastructure/` (insert/update/deleteSubtree/findById/findChildren).
2. **Use-cases courses** : scaffolder `createCourse` / `updateCourse` /
   `deleteCourse` (9 fichiers step chacun, noms canoniques, barrel).
3. **Use-cases classes** : idem `createClass` / `updateClass` / `deleteClass`,
   avec ValidateContext des invariants d'arbre (SECTION sans média, parent =
   SECTION même course, pas de cycle).
4. **Routes** : ajouter les 6 routes + imports dans `backend/index.js`.
5. **Authz** : provisionner scopes `lms:course:write` / `lms:class:write` côté
   bastion (script co-localisé) ; CheckPolicies via `hasScope` PBAC.
6. **Smoke end-to-end** : create course → SECTION → LESSON, GET arbre, DELETE
   cascade.

## Fichiers

- `backend/lms/application/courses/{createCourse,updateCourse,deleteCourse}/**`
  — 3 use-cases × 9 fichiers step + barrel.
- `backend/lms/application/classes/{createClass,updateClass,deleteClass}/**`
  — 3 use-cases × 9 fichiers step + barrel.
- `backend/lms/infrastructure/` — `LmsCourseRepository` + `LmsClassRepository`
  (D1 : insert/update/deleteSubtree/findById/findChildren).
- `backend/index.js` — 6 routes + imports.
- `02-content-authoring-crud-api.plan.after.py` — sidecar assertions.

## Critères

- `npx tsc --noEmit` = 0 erreur.
- 6 dossiers use-case présents avec 9 fichiers step chacun (noms canoniques :
  `ValidateInput`, pas `Assert`).
- 6 routes présentes dans `index.js`.
- Smoke end-to-end : créer course → SECTION → LESSON imbriquée, GET l'arbre,
  DELETE course → cascade complète du sous-arbre.
- `createClass` ValidateContext refuse `nodeKind='SECTION'` + `mediaJson` non-vide,
  refuse `parentClassId` pointant une `LESSON`, refuse un cycle.

## Risques

- **Cascade delete** : `deleteSubtree` sur adjacency-list doit supprimer tout le
  sous-arbre (CTE récursive ou delete applicatif). Un delete non-récursif
  laisserait des nœuds orphelins. Mitigation : test du DELETE cascade dans le smoke.
- **Authz** : sans scope `lms:course:write` / `lms:class:write` provisionné côté
  bastion, les endpoints renverront 403. Vérifier/provisionner les scopes (script
  bastion co-localisé) avant le smoke.
- **Idempotence ingestion** : le run data d'ingestion classroom re-jouera des
  creates ; `createCourse`/`createClass` doivent accepter `idempotency_key` pour
  être re-runnable sans doublons.

## Vérification

```bash
cd Apps/the-play-button/tpb-lms
npx tsc --noEmit
# smoke end-to-end : créer un course + un SECTION + une LESSON imbriquée, GET l'arbre, DELETE le course → cascade
```

## Sidecar assertions

`02-content-authoring-crud-api.plan.after.py` :
- assert existence des 6 dossiers use-case avec les 9 fichiers step chacun.
- assert les 6 routes présentes dans `index.js`.
- assert `createClass` ValidateContext refuse `nodeKind='SECTION'` + `mediaJson`
  non-vide, et refuse `parentClassId` pointant une `LESSON`.
