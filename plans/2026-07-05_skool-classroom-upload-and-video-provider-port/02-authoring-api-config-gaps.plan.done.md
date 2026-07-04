# Plan 02 — Gaps config de l'authoring API — DONE (2026-07-05)

## Résultat

L'authoring API accepte désormais, via create + update, courses + classes, les
champs `progressionMode` / `rawJson` / `contentMd` / `stepType` — tous optionnels
(zéro régression). Le smoke end-to-end via le PAT `app_lms` est **vert**.

## Ce qui a été fait

### Backend (commit `1990b98`)

- **`createCourseValidateInput.ts`** : + `progressionMode: z.enum(PROGRESSION_MODES)` +
  `rawJson: z.record(z.string(), z.unknown())`. Import du SSOT `domain/ProgressionMode.ts`
  (créé ce plan : `PROGRESSION_MODES = ['linear','free']`).
- **`createCourseExecute.ts`** : rawJson persisté = merge
  `{ ...input.rawJson, ...(progressionMode ? {tpb_progression_mode} : {}), tpb_created_by }`
  — le créateur stampé **en dernier** (ne peut être écrasé, § actor stamping).
- **`updateCourseValidateInput.ts`** : idem (progressionMode + rawJson).
- **`updateCourseExecute.ts`** : **read-modify-write merge** — lit le raw_json existant,
  merge, réécrit. Ne touche raw_json que si progressionMode/rawJson fournis (sinon inchangé).
- **`createClassValidateInput.ts`** + **`updateClassValidateInput.ts`** : + `contentMd` +
  `stepType` + `rawJson`.
- **`createClassExecute.ts`** + **`updateClassExecute.ts`** : `contentMd`/`stepType` routés
  vers `raw_json.tpb_content_md` / `raw_json.tpb_step_type` (merge). update = read-modify-write.

### Décision d'exécution — content routé vers raw_json, PAS les colonnes dépréciées

Le plan disait « persister contentMd (colonne content_md), stepType (colonne step_type) ».
**Divergence assumée** : les colonnes `content_md` / `step_type` de `lms_class` sont marquées
DEPRECATED dans `db/schema.sql`, et le **read path ne les lit jamais** — `CoursesService.enrichClass`
mappe `raw.tpb_content_md` / `raw.tpb_step_type` depuis `raw_json`. Écrire les colonnes aurait
produit de la donnée morte (§ ALWAYS FAIL HARD — no dead write path). Les deux champs sont donc
routés vers `raw_json`, l'unique SSOT que le viewer consomme. Un seul chemin (§ BIG BANG).

### Tests (commit `1990b98`)

- Nouveau `backend/lms/application/classes/authoring.rawjson-merge.test.ts` (6 specs) :
  createCourse merge + creator-not-overwritable ; updateCourse read-modify-write preserve keys +
  untouched-when-absent ; createClass content→raw_json (pas de colonnes) ; updateClass merge.
- `npx tsc -p backend/tsconfig.json` → 0. `npx vitest run` → 193/193. entropy RATCHET OK.

### Blocker rencontré + fix at-source — SDK hasScope wildcard (commit `0e9a671`)

Le smoke a révélé un **403 FORBIDDEN systématique** sur les endpoints authoring, malgré le PAT
`app_lms` qui porte `lms:*`. Root cause diagnostiquée (via route debug `/api/whoami` temporaire,
retirée avant le deploy final) : le SDK **pinné `^8.1.0`** embarquait un `hasScope` **exact-match
uniquement** (pas d'expansion `ns:*`), donc `hasScope(['lms:*'], 'lms:course:write')` → `false`.
La validation bastion des scopes de token exact-matche aussi (le grant de scopes littéraux au token
a été rejeté « exceeds app allowed »), confirmant que le wildcard `lms:*` était non-fonctionnel des
deux côtés.

**Fix at-source, debt-reducing** : bump `@the-play-button/tpb-sdk-js` `8.1.0 → 15.17.0` (latest,
cross-portfolio), dont le `hasScope` restaure l'expansion prefix-wildcard. Mesuré empiriquement
avant commit : install propre, `tsc` 0, 193 tests verts, entropy OK. Aucune modification de scope
bastion nécessaire (le token gardait `lms:*`, désormais expansé au runtime). Aucune mutation
bastion n'a été appliquée (les 2 tentatives de grant ont échoué en 400, état inchangé).

## Smoke end-to-end (PAT `app_lms`, auto-cleanup)

`POST /api/courses {name, progressionMode:'free', rawJson:{tpb_intro_url}}` → 201 · `GET` →
`progression_mode:'free'` · `POST /api/classes {courseId, LESSON, contentMd, stepType}` → 201 ·
la leçon apparaît dans le course-detail avec `content_md:'# Hello from smoke'` + `step_type:'CONTENT'`
· `PATCH /api/courses {rawJson}` → 200, `progression_mode` survit au merge · DELETE class + course.
**Tous les checks passent.** Script : `/tmp/lms_smoke_plan02.py` (crée + supprime ses propres rows).

## Déploiement

`lms-api` déployé (Version ID `baf59f92-1d42-49ad-bf43-13e7775e9dbd`) avec SDK 15.17.0, route debug
retirée.

## Notes / dette signalée (non-bloquante)

- **3 lockfiles** cohabitent dans `tpb-lms/` (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`) —
  dette pré-existante. `npm install` a mis à jour package-lock + yarn.lock ; `pnpm-lock.yaml` reste
  stale. Le deploy bundle depuis `node_modules` (15.17.0 correct). À rationaliser dans une passe dédiée.
- Le token `app_lms` sert d'identité runtime du Worker ET de PAT authoring pour l'upload « app externe ».
  Une séparation (token authoring dédié) serait plus propre à terme mais non requise pour le POC.

## Fichiers touchés

- `backend/lms/domain/ProgressionMode.ts` (nouveau)
- `backend/lms/application/courses/createCourse/{createCourseValidateInput,createCourseExecute}.ts`
- `backend/lms/application/courses/updateCourse/{updateCourseValidateInput,updateCourseExecute}.ts`
- `backend/lms/application/classes/createClass/{createClassValidateInput,createClassExecute}.ts`
- `backend/lms/application/classes/updateClass/{updateClassValidateInput,updateClassExecute}.ts`
- `backend/lms/application/classes/authoring.rawjson-merge.test.ts` (nouveau)
- `package.json` + lockfiles (SDK bump)

Commits : `1990b98` (authoring fields) + `0e9a671` (SDK bump).
