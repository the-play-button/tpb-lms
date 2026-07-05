# Plan 12 — Ordre des cours : `lms_course.sys_order_index` — DONE (2026-07-05)

## Résultat

L'ordre Skool est respecté : sidebar « Maker School » + program landing affichent
Pre-Program → Resource Library → Automation Tutorials → Month 1…6 → Building Wealth →
Building a Brand (**bonus en fin**). Vérifié live. 199 tests, entropy OK.

## Diagnostic (réponse)

- **Extraction OK** : `course_trees.json` préserve l'ordre Skool (bonus à la fin). Le
  mockup HTML rendait dans cet ordre.
- **Gap ERD** : `lms_course` n'avait **pas** de `sys_order_index` (seul `lms_class` en avait) →
  `CoursesService` triait `ORDER BY name ASC` → alphabétique → ordre perdu.

## Ce qui a été fait

- **Migration `011_lms_course_order.mjs`** : `lms_course.sys_order_index` + index (idempotent).
  `schema.sql` maj.
- **Repo** : `CourseRow.sys_order_index`, `CreateCourseData/UpdateCoursePatch.sysOrderIndex`,
  insert + update SQL.
- **Authoring** : `createCourse` + `updateCourse` ValidateInput/Execute acceptent `sysOrderIndex`.
- **Read** : `queryActiveCourses` → `ORDER BY sys_order_index ASC, name ASC`.
- **Import** : `import_all` passe `sysOrderIndex` = position dans `course_trees.json` (1-based)
  à chaque course. Re-set ciblé des 11 cours Maker (1..11) via PATCH.

## Vérif live (§ PLAN FRONTEND DONE)

- `/api/courses` : Maker courses dans l'ordre Skool (Pre-Program … Building a Brand).
- Sidebar « Maker School » + program landing : **même ordre** (le frontend suit l'ordre API,
  aucun changement front nécessaire). **0 erreur console**.

### Gates
- `npx tsc -p backend/tsconfig.json` 0 · `npx vitest run` 199/199 · entropy RATCHET OK.
  Migration remote + lms-api déployés. Idempotent.

## Fichiers

- `db/migrations/011_lms_course_order.mjs` + `db/schema.sql`
- `backend/lms/domain/repositories/LmsCourseRepository.ts` + repo impl
- `backend/lms/application/courses/{createCourse,updateCourse}/{…ValidateInput,…Execute}.ts`
- `backend/services/courses/CoursesService.js`
- `scripts/skool-import/{import_all,import_course}.py`

## Note

Le champ `sys_order_index` est générique (comme sur `lms_class`) → tout futur cours/import
peut ordonner ses cours. Les cours standalone (SOMs, WGE) gardent l'index 0 (groupe séparé,
sans impact).
