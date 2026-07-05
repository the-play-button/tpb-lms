# Plan 12 — Ordre des cours : `lms_course.sys_order_index`

## Contexte

L'ordre des cours dans un program ne respecte pas la classroom Skool d'origine (les bonus
devraient être en fin). **Diagnostic** :
- **Extraction OK** : `course_trees.json` préserve l'ordre Skool (Pre-Program → Resource
  Library → Automation Tutorials → Month 1-6 → Building Wealth → Building a Brand → Life
  Optimization). Le mockup HTML rendait dans cet ordre.
- **Gap ERD** : `lms_course` n'a **pas** de champ d'ordre (seul `lms_class` a
  `sys_order_index`). `CoursesService.queryActiveCourses` trie `ORDER BY name ASC` →
  alphabétique → l'ordre pédagogique est perdu.

Fix : ajouter `sys_order_index` à `lms_course` (miroir de `lms_class`), le setter à l'import
depuis la position dans l'arbre, trier l'API dessus.

## Étapes

### 1. Migration `011_lms_course_order.mjs` + schema.sql
- `ALTER TABLE lms_course ADD COLUMN sys_order_index INTEGER DEFAULT 0` (try/catch défensif).
- Index `idx_lms_course_order ON lms_course(sys_order_index)`.
- `db/schema.sql` : ajouter la colonne + index.

### 2. Repo + domain
- `CourseRow` : + `sys_order_index: number`.
- `CreateCourseData` : + `sysOrderIndex?: number`. `UpdateCoursePatch` : + `sysOrderIndex?`.
- `LmsCourseDatabaseRepository` : insert SQL + update SQL gèrent `sys_order_index`.

### 3. Authoring API
- `createCourse` + `updateCourse` ValidateInput : + `sysOrderIndex: z.number().int().optional()`.
- `createCourseExecute` + `updateCourseExecute` : passent `sysOrderIndex` au repo.

### 4. Read — tri
- `CoursesService.queryActiveCourses` : `SELECT … sys_order_index …` +
  `ORDER BY sys_order_index ASC, name ASC` → l'ordre Skool prime, name en tie-break.

### 5. Import
- `import_all.py` : passe `sys_order_index` = position dans `course_trees.json` (1-based)
  à `import_one_course` → course upsert body `sysOrderIndex`.
- Re-set l'ordre des 11 cours Maker existants via PATCH ciblé (comme program_id).

### 6. Déploiement + vérif live (§ PLAN FRONTEND DONE)
- Migration remote + deploy lms-api.
- tpb-browser : dans « Maker School » (sidebar + program landing) l'ordre est
  **Pre-Program → Resource Library → Automation Tutorials → Month 1…6 → Building Wealth →
  Building a Brand** (bonus en fin). 0 erreur console.

## Fichiers

- `db/migrations/011_lms_course_order.mjs` + `db/schema.sql`
- `backend/lms/domain/repositories/LmsCourseRepository.ts` + repo impl
- `backend/lms/application/courses/{createCourse,updateCourse}/{…ValidateInput,…Execute}.ts`
- `backend/services/courses/CoursesService.js`
- `scripts/skool-import/{import_all,import_course}.py`

## Critères

- `sys_order_index` sur lms_course ; API triée dessus ; import le set depuis l'arbre.
- Ordre Skool respecté (bonus en fin) dans sidebar + program landing.
- tsc 0 · tests verts · entropy OK · idempotent · 0 erreur console.

## Risques

- **Migration ADD COLUMN** : try/catch défensif (mirror 010).
- **Cours standalone** (SOMs, WGE) : `sys_order_index` défaut 0 → triés avant, mais dans un
  groupe séparé (pas d'impact visuel).
