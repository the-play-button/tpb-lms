# Plan 02 — Gaps config de l'authoring API (backend) : progression_mode / intro / content_md via API

## Contexte

L'authoring CRUD (Plan 02 de l'initiative précédente) crée cours + classes via API,
mais `createCourseExecute` / `createClassExecute` **hardcodent** `rawJson =
{ tpb_created_by }`. Conséquence : impossible via API de setter :
- `tpb_progression_mode` sur le cours (nav `free` — que veut Maker School !).
- `tpb_intro_url` / `tpb_intro_ref_id` (intro de cours).
- `tpb_step_type` + `content_md` sur une classe (texte inline optionnel).

Aujourd'hui je devrais mettre `progression_mode` en SQL → casse le « 100% API ».
Ce plan ferme les 3 gaps pour un upload **pur API**.

## Objectif

Rendre settables via l'authoring API (create + update, courses + classes) :
`rawJson` (merge, pas overwrite), `progressionMode` (course, validé linear|free),
`contentMd` (class). Sans casser l'existant (tous optionnels).

## Étapes

### 1. createCourse — accepter rawJson + progressionMode
- `createCourseValidateInput.ts` : ajouter `rawJson: z.record(z.string(), z.unknown()).optional()`
  + `progressionMode: z.enum(PROGRESSION_MODES).optional()` (import depuis
  `services/courses/_progressionMode.js`).
- `createCourseExecute.ts` : construire le rawJson persisté = merge
  `{ tpb_created_by, ...(input.rawJson ?? {}), ...(input.progressionMode ? { tpb_progression_mode: input.progressionMode } : {}) }`.
  (le créateur reste toujours stampé § actor stamping).

### 2. updateCourse — idem (PATCH)
- `updateCourseValidateInput.ts` : + `rawJson?` + `progressionMode?`.
- `updateCourseExecute.ts` : si fourni, `json_set`/merge sur le rawJson existant
  (lire l'actuel → merge → écrire), ne PAS écraser les autres clés. Le repo
  `updateCourse` doit supporter un update partiel de raw_json.

### 3. createClass — accepter rawJson + contentMd + stepType
- `createClassValidateInput.ts` : + `contentMd: z.string().optional()` +
  `stepType: z.string().optional()` + `rawJson: z.record(...).optional()`.
- `createClassExecute.ts` : persister `contentMd` (colonne `content_md`), `stepType`
  (colonne `step_type`), et rawJson mergé `{ tpb_created_by, ...(input.rawJson), ...(stepType ? {tpb_step_type} : {}) }`.
- Repo `LmsClassDatabaseRepository.insert` : étendre l'INSERT pour inclure
  `content_md` + `step_type` (colonnes existantes du schéma).

### 4. updateClass — idem (PATCH)
- `updateClassValidateInput.ts` + `updateClassExecute.ts` + repo : content_md / step_type / rawJson merge.

### 5. Contrat + rétro-compat
- Tous les nouveaux champs **optionnels** → zéro régression sur les callers existants.
- Filter (step 8) : exposer `progression_mode` déjà fait (Plan 09 précédente) ; vérifier
  que le body create/update retourne les champs settés (pour confirmation caller).

### 6. Tests
- `createCourse` : progressionMode='free' → row.raw_json contient tpb_progression_mode + tpb_created_by (merge, pas overwrite).
- `updateCourse` : merge partiel (ne perd pas les clés existantes).
- `createClass` : contentMd + stepType persistés ; rawJson mergé.
- `npx tsc` 0 · `npm test` vert · entropy RATCHET OK.

### 7. Déploiement + smoke API
Déployer lms-api. Smoke via `BastionClient` (PAT authoring) :
- `POST /api/courses {name, progressionMode:'free'}` → GET course → `progression_mode:'free'`.
- `POST /api/classes {courseId, nodeKind:'LESSON', name, contentMd:'# hi'}` → la classe a content_md.
- Idempotence + scopes vérifiés.

## Fichiers

- `backend/lms/application/courses/createCourse/{createCourseValidateInput,createCourseExecute}.ts`
- `backend/lms/application/courses/updateCourse/{updateCourseValidateInput,updateCourseExecute}.ts`
- `backend/lms/application/classes/createClass/{createClassValidateInput,createClassExecute}.ts`
- `backend/lms/application/classes/updateClass/{updateClassValidateInput,updateClassExecute}.ts`
- `backend/lms/infrastructure/repositories/LmsClassDatabaseRepository.ts` (+ content_md, step_type dans insert/update)
- `backend/lms/infrastructure/repositories/LmsCourseDatabaseRepository.ts` (rawJson merge sur update)
- `backend/lms/domain/repositories/{LmsCourseRepository,LmsClassRepository}.ts` (types)
- tests associés.

## Critères

- `progressionMode` settable via POST/PATCH courses (validé linear|free).
- `contentMd` + `stepType` + `rawJson` settables via POST/PATCH classes.
- rawJson = **merge** (préserve tpb_created_by + clés existantes), jamais overwrite.
- Tous champs optionnels → zéro régression.
- tsc 0 · tests verts · entropy RATCHET OK · smoke API OK.

## Risques

- **Merge raw_json sur update** : lire-modifier-écrire → veiller à ne pas perdre de clés
  (test dédié). Utiliser `json_set` D1 si possible, sinon read+merge+write dans l'Execute.
- **Sécurité rawJson libre** : `z.record(string, unknown)` accepte du JSON arbitraire.
  OK (c'est du contenu authoring sous scope `lms:*:write`), mais ne PAS permettre
  d'écraser `tpb_created_by` (le merge remet toujours le créateur en dernier).
- **content_md volumineux** : les leçons Maker School peuvent être longues. D1 TEXT
  supporte, mais préférer le pattern DOCUMENT-media-URL (GitHub) pour le gros contenu ;
  `content_md` reste dispo pour l'inline court. Décision d'usage au Plan 03.
