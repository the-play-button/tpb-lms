# Plan 10 — Entité Program (LMS) + regroupement Classroom « Maker School »

## Contexte

L'ERD tpb-lms (aligné unified.to) s'arrête à **Course → (nested) Section → Lesson**.
Il n'existe **aucun niveau au-dessus du course**. Or une classroom Skool (« Maker School »)
= un **program** qui regroupe N cours distincts (chacun avec sa cover, sa description, sa
progression). Les 12 cours Maker School sont donc uploadés à plat, mélangés aux cours TPB
(SOMs, WGE). L'utilisateur veut voir **« Maker School » comme container** + ses cours dedans.

Ce n'est **pas** qu'un souci d'interface : le modèle a besoin d'une entité **Program**.
Modèle RDD correct (universel LMS) : **Program → Course → Section → Lesson**.

## Objectif

Ajouter l'entité `Program` (grouping de courses), 100% API, et une Classroom hiérarchique :
cartes **Program** (Maker School) + cours standalone à la racine → clic Program → grille de
ses cours → clic cours → overview. Uploader les 12 cours Maker School sous le program.

## Étapes

### 1. Migration — `db/migrations/010_lms_program.mjs`
- `CREATE TABLE IF NOT EXISTS lms_program (id, name, description, media_json, is_active,
  raw_json, created_at, updated_at)` — même forme que `lms_course` (cover via media_json IMAGE).
- `ALTER TABLE lms_course ADD COLUMN program_id TEXT REFERENCES lms_program(id)` (nullable ;
  try/catch défensif comme `006_nested_sections`, re-run safe).
- Index `idx_lms_course_program ON lms_course(program_id)`.
- Update `db/schema.sql` (fresh installs) : ajouter la table + la colonne + le commentaire.

### 2. Domain + infra repo
- `backend/lms/domain/repositories/LmsProgramRepository.ts` : `ProgramRow`, `CreateProgramData`,
  `UpdateProgramPatch`, port `findById/insert/update/list`.
- `backend/lms/infrastructure/repositories/LmsProgramDatabaseRepository.ts` : D1 impl
  (mirror `LmsCourseDatabaseRepository`, INSERT OR IGNORE + partial update).
- `AuthoringContext` (+ `createAuthoringContext`) : ajouter `programRepo`.

### 3. Use case authoring `createProgram` (DDD 9-step, mirror `createCourse`)
- `backend/lms/application/programs/createProgram/` : les 9 fichiers + `index.ts`.
  Input : `{ id?, name, description?, mediaJson?, rawJson? }`. Scope `lms:program:write`.
- Route `POST /api/programs` dans `authoringRoutes`.

### 4. `updateCourse` — accepter `programId`
- `updateCourseValidateInput` : + `programId: z.string().nullable().optional()`.
- `updateCourseExecute` + `LmsCourseRepository.UpdateCoursePatch` + repo update : `program_id`.
  (rattache un cours à un program via l'API existante `PATCH /api/courses/:id`.)

### 5. Read side
- `backend/services/programs/ProgramsService.js` : `listProgramsForUser(env, lang)` →
  `[{ id, name, description, cover_image_url, course_count, course_ids }]` (cover = 1ère
  media IMAGE ; course_count via `COUNT lms_course WHERE program_id=?`).
- Handler + route `GET /api/programs`.
- `CoursesService` : `queryActiveCourses` SELECT `program_id` ; `enrichCourseSummary`
  expose `program_id` (pour le filtrage client + les cours standalone).

### 6. Import — créer le program + rattacher les cours
- `import_all.py` : flags `--program-name "Maker School"` (+ `--program-id`). Si fourni :
  `POST /api/programs` (idempotent, id déterministe `program_<slug>`), puis chaque course
  upsert passe `programId`. `import_course.import_one_course` accepte `program_id`.
- Cover du program : réutiliser une cover représentative (ex : cover du Pre-Program) OU
  `group_metadata.json` s'il porte une image de communauté (à vérifier).
- Re-run des 11 cours avec `--program-name "Maker School"`.

### 7. Frontend — Classroom hiérarchique
- State `programs` (fetch `/api/programs`) + `courses` (déjà, avec `program_id`).
- `classroom.js::renderClassroom` : rendre les **cartes Program** (cover, N cours) + les
  **cours standalone** (`program_id == null`) à la racine.
- Clic carte Program → `renderProgram(programId)` : titre du program + grille de ses cours
  (réutilise `renderCard`) + lien « ← Classroom ».
- Clic carte cours → overview existant (inchangé).
- Breadcrumb léger : Classroom → {Program} → {Course}.
- Tests `classroom.test.js` : `renderProgramCard` (cover + count), split program/standalone.

### 8. Déploiement + vérif live (§ PLAN FRONTEND DONE)
- Migration remote + deploy lms-api + lms-viewer.
- tpb-browser : racine Classroom montre une carte **« Maker School »** (cover, « 11 cours »)
  + les 2 cours TPB standalone. Clic Maker School → grille des 11 cours (covers). Clic un
  cours → overview → leçon (vidéo + texte + images). 0 erreur console, fresh + reload.

## Fichiers

- `db/migrations/010_lms_program.mjs` + `db/schema.sql`
- `backend/lms/domain/repositories/LmsProgramRepository.ts`
- `backend/lms/infrastructure/repositories/LmsProgramDatabaseRepository.ts`
- `backend/lms/application/programs/createProgram/*` (10 fichiers)
- `backend/lms/application/courses/updateCourse/{updateCourseValidateInput,updateCourseExecute}.ts`
  + `backend/lms/domain/repositories/LmsCourseRepository.ts` + repo impl
- `backend/lms/types/AuthoringContext.ts` + `backend/handlers/authoringContext.ts`
- `backend/services/programs/ProgramsService.js` + `backend/handlers/programs.js`
- `backend/services/courses/CoursesService.js`
- `backend/index.js` (routes GET /api/programs, POST /api/programs)
- `frontend-on-cf-worker/app/ui/classroom.js` (+ program landing) + `classroom.test.js`
- `frontend-on-cf-worker/app/init/initSessionData.js` (fetch programs)
- `scripts/skool-import/{import_all.py,import_course.py}`

## Critères

- Entité Program en place (migration + DDD create + course.program_id via API).
- « Maker School » regroupe les 11 cours ; cours TPB standalone à la racine.
- Classroom : Program cards → grille cours → overview. Covers rendues. 0 erreur console.
- tsc 0 · tests verts · entropy OK · idempotent.

## Risques

- **Migration ADD COLUMN** : SQLite pas d'`IF NOT EXISTS` colonne → try/catch défensif (mirror 006).
- **Cours sans program** (standalone) : `program_id NULL` → rendus à la racine (pas cachés).
- **Cover du program** : si aucune image dédiée, fallback gradient (déjà en place Plan 09).
