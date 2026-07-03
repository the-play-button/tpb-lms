## Ce qui a été fait

Extension de `lms_class` en arbre **adjacency-list de profondeur arbitraire**,
appliquant le pattern déjà blessé dans le même schema (`kms_space.parent_space_id`,
`kms_page.parent_page_id`, `hris_group.parent_id`).

- **Migration `006_nested_sections.sql`** : `ALTER TABLE lms_class ADD COLUMN
  parent_class_id TEXT REFERENCES lms_class(id)` + `ADD COLUMN node_kind TEXT NOT
  NULL DEFAULT 'LESSON'` (`SECTION`|`LESSON`) + `CREATE INDEX idx_lms_class_parent
  (parent_class_id, sys_order_index)`. Les 2 colonnes vivent dans la migration (pas
  dans le CREATE TABLE de `schema.sql`) car SQLite n'a pas d'`ADD COLUMN IF NOT
  EXISTS` et le repo traite déjà les migrations comme la couche d'évolution (cf.
  `lms_content_ref` de 005, absent de schema.sql).
- **`schema.sql`** : bloc commentaire de `lms_class` documente l'arbre + retrait du
  soft-label `tpb_section`.
- **`schema.erd.md`** : `lms_class` montre `parent_class_id`/`node_kind` + relation
  self `lms_class ||--o| lms_class : "parent"`.
- **`006_backfill_sections.mjs`** : promeut les labels legacy `raw_json.tpb_section`
  en vrais nœuds SECTION, re-parente les leçons, strip le label. Idempotent (SECTION
  id déterministe `sec_<course>_<slug>`, `INSERT OR IGNORE`, `json_remove`).
- **`CoursesService.getCourseForUser`** : réécrit pour construire l'arbre
  (`buildAdjacency` → `flattenLessonsDFS` → `enrichLessonSequence` →
  `buildDisplayTree`). Renvoie `nodes[]` (arbre SECTION/LESSON nesté) + `classes`
  (leaves LESSON en ordre DFS pour la progression séquentielle). `queryCourseClasses`
  SELECT + `parent_class_id`, `node_kind`. Dead code `processClasses()` supprimé.
- **`CoursesService.tree.test.js`** : 4 tests vitest (arbre nesté, ordre DFS,
  pas de fuite SECTION dans classes, 404-shape).

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `db/migrations/006_nested_sections.sql` | **créé** — ALTER 2 colonnes + index |
| `db/migrations/006_backfill_sections.mjs` | **créé** — backfill idempotent tpb_section → SECTION |
| `db/schema.sql` | commentaire lms_class : arbre documenté, tpb_section retiré |
| `schema.erd.md` | lms_class + colonnes tree + self-relation |
| `backend/services/courses/CoursesService.js` | arbre (nodes[] + classes DFS), SELECT étendu, processClasses supprimé |
| `backend/services/courses/CoursesService.tree.test.js` | **créé** — 4 tests arbre |
| `03-...plan.after.py` | **créé** — sidecar assertions |

## Résultat de validation

- ✅ `schema.sql` + migrations `001..006` appliquées sur D1 locale fraîche : **6/6 verts, 0 erreur**.
- ✅ Colonnes `parent_class_id` + `node_kind` + index `idx_lms_class_parent` présents (pragma).
- ✅ Insertion arbre 3 niveaux (course → SECTION → SECTION → LESSON) : OK.
- ✅ Backfill : promote 2 SECTION + reparent 3 leçons + strip tpb_section ; 2e run = no-op (idempotent).
- ✅ `node --check CoursesService.js` : SYNTAX OK.
- ✅ Vitest `CoursesService.tree.test.js` : **4/4 pass**.
- ✅ Sidecar `03-...plan.after.py` : **all pass**.

## Note

Le backfill (`006_backfill_sections.mjs`) est validé sur D1 locale. Son run sur la D1
remote (données legacy éventuelles) est une opération data à lancer au déploiement
via `node db/migrations/006_backfill_sections.mjs --remote` — hors périmètre code de
cette initiative (aucune donnée classroom n'est encore poussée). La migration SQL 006
elle-même s'applique en remote via le pipeline `db:migrate:remote` habituel.
