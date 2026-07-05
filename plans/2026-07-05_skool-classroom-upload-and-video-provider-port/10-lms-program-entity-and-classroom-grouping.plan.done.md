# Plan 10 — Entité Program (LMS) + regroupement Classroom — DONE (2026-07-05)

## Résultat

L'ERD tpb-lms a désormais le niveau **Program** au-dessus du course (Program → Course →
Section → Lesson). « Maker School » regroupe ses 11 cours ; la page d'accueil Classroom
affiche la carte **Maker School (11 cours)** + les 2 cours TPB standalone. Clic Maker
School → grille de ses 11 cours → clic cours → overview. Vérifié live (screenshot).

## Diagnostic (réponse à la question)

Ce **n'était pas qu'un souci d'interface** : l'ERD (aligné unified.to) s'arrêtait à
Course → Section → Lesson. « ERD complet » valait pour l'arbre Course/Section/Lesson
(bien nested), mais **aucun niveau Program** n'existait. Une classroom Skool = un program
multi-cours → il fallait ajouter l'entité.

## Ce qui a été fait

### Backend — entité Program (DDD)
- **Migration `010_lms_program.mjs`** : table `lms_program` + `lms_course.program_id`
  (FK nullable, `NULL` = standalone) + index. Idempotent (ADD COLUMN guardé). `schema.sql` maj.
- **Domain/infra** : `LmsProgramRepository` (port) + `LmsProgramDatabaseRepository` (D1).
  `AuthoringContext` (+ `createAuthoringContext`) gagnent `programRepo`.
- **Use case `createProgram`** (9-step DDD, mirror `createCourse`) + route `POST /api/programs`
  (scope `lms:program:write`).
- **`updateCourse`** accepte `programId` (ValidateInput + Execute + `UpdateCoursePatch` +
  repo `program_id`) → rattache un cours à un program via l'API existante.

### Backend — read
- `ProgramsService.listProgramsForUser` (id, name, description, `cover_image_url`,
  `course_count`) + handler + route `GET /api/programs`.
- `CoursesService` : `queryActiveCourses` SELECT `program_id` + `enrichCourseSummary`
  expose `program_id` (filtrage client + cours standalone).

### Import
- `import_all.py --program-name "Maker School"` : crée le program (cover = 1ère cover de
  cours) + passe `programId` à chaque course. `import_one_course` accepte `program_id`.
- Exécution : program `program_maker-school` créé (201) + **11 cours attachés** (PATCH 200).
  Vérif API : `/api/programs` → Maker School, `course_count: 11` ; `/api/courses` →
  11 grouped + 2 standalone (SOMs, WGE).

### Frontend — Classroom hiérarchique
- `initSessionData` fetch `/api/programs` → state `programs` (non-bloquant).
- `classroom.js` : racine = cartes **Program** (`renderProgramCard`, cover + « N cours »)
  + cours standalone (`program_id == null`). Clic program → `renderProgram(id)` (grille de
  ses cours + lien « ← Classroom »). Clic cours → overview inchangé.
- Deep-link `?program=<id>` restauré au boot (`bootSequence`) → program landing.
- i18n `classroom.courses` (fr « cours » / en « courses »).

## Vérif live (§ PLAN FRONTEND DONE)

- Racine : **carte Maker School (cover « START HERE. », « 11 cours → »)** + 2 cours TPB
  standalone (SOMs 0%, WGE 17%).
- Clic Maker School → `?program=program_maker-school`, titre « Maker School », **11 cartes
  cours toutes avec cover**, lien back, aucun program imbriqué.
- Clic un cours (Month 4) → overview « Month 4 ». Back → racine.
- Deep-link `?program=…` au reload → restaure le program landing (11 cours).
- **0 erreur console** partout.

### Gates
- `npx tsc -p backend/tsconfig.json` 0 · `npx vitest run` 196/196 (dont program card) ·
  entropy RATCHET OK. Migration remote + lms-api + lms-viewer déployés. Idempotent.

## Fichiers

- `db/migrations/010_lms_program.mjs` + `db/schema.sql`
- `backend/lms/domain/repositories/{LmsProgramRepository,LmsCourseRepository}.ts`
- `backend/lms/infrastructure/repositories/{LmsProgramDatabaseRepository,LmsCourseDatabaseRepository}.ts`
- `backend/lms/application/programs/createProgram/*` (10 fichiers)
- `backend/lms/application/courses/updateCourse/{updateCourseValidateInput,updateCourseExecute}.ts`
- `backend/lms/types/AuthoringContext.ts` + `backend/handlers/authoringContext.ts`
- `backend/services/programs/ProgramsService.js` + `backend/handlers/programs.js`
- `backend/services/courses/CoursesService.js` + `backend/index.js`
- `frontend-on-cf-worker/app/ui/classroom.js` + `classroom.test.js`
- `frontend-on-cf-worker/app/init/{initSessionData,bootSequence}.js` + `i18n/{en,fr}.json`
- `scripts/skool-import/{import_all,import_course}.py`

## Note / follow-up possible (non-bloquant)

La sidebar « MON PARCOURS » liste encore les 11 cours Maker à plat (composant `courseList.js`,
distinct de la page d'accueil demandée). La page d'accueil, elle, groupe désormais sous
Maker School. Grouper aussi la sidebar par program serait un petit ajout ortho — à faire si
souhaité.
