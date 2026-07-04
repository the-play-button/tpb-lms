# Plan 07 — Skool-parity nav leçons + sections in-course — DONE

## Ce qui a été fait

La hiérarchie courses → sections → leçons est désormais **visible et navigable**
dans la sidebar in-course (Skool course rail). Le module `stepsSidebar.js`, qui
était 100% mort (aucun export consommé hors tests, conteneur inexistant, zéro CSS),
est monté, câblé, stylé, et alimenté par des sections réelles.

### 1. Conteneur + wiring
- `index.html` : `#stepsSidebar` (nav-section, `is-empty` tant qu'aucun cours).
- `initAllUI.js` : `initStepsSidebar()` → `subscribe(courseData/signals/currentStepIndex)`
  → re-render réactif (les `setState` de `loadCourse` déclenchent le rendu, pas
  d'appel explicite).

### 2. Arbre cliquable + sections repliables
- `stepsSidebar.js` réécrit (BIG BANG) : `renderNodesTree` rend des `.section-group`
  avec header `<button>` repliable (chevron ▾/▸, aria-expanded, collapse persisté
  via Set module-level → survit aux re-renders). Leçons `.clickable` → délégation de
  clic → `navigateToStep` (dynamic import). Suppression des exports morts
  (`updateSidebarCurrentStep`, `markStepComplete`, `toggleSidebar`, `ensureSidebarContainer`).
- Accessibilité alignée sur **le gate exact de `navigateToStep`**
  (`signals.can_access_step - 1`) → une leçon marquée cliquable navigue toujours
  vraiment (pas de clamp silencieux) ; hyper-linéaire préservé.
- i18n : `sidebar.{toggleSection,stepCurrent,stepCompleted,stepLocked,stepPending}` en+fr.
- `styles/course.css` : CSS arbre (header, progress, section-group/collapsed,
  step-item states current/completed/locked/pending/clickable), design tokens.

### 3. Données réelles (démonstration ERD→UI)
- `db/migrations/007_seed_pa06_sections.mjs` : 3 SECTION nodes sur pa06-2
  (« 1. Préparation & Structure » / « 2. Rédaction du contenu » / « 3. Validation
  & Publication »), reparent les 15 leçons (3/7/5), idempotent + réversible.
  Appliqué remote. DFS backend préservé → ordre plat 1→15 intact.

### 4. Bug latent nesting corrigé at-source (exposé par le seed)
Ajouter de vraies SECTION rows a révélé que plusieurs requêtes comptaient
`lms_class` sans filtrer `node_kind` → les 3 dossiers étaient comptés comme des
steps (signals `total_steps` 18 vs 15), polluant progression / `can_access_step` /
enrollment. Corrigé :
- `SignalsService.queryCourseSteps`, `CoursesService.queryCourseStepCount`,
  `EnrollmentService.total_classes` (×2) : `AND node_kind = 'LESSON'`.
- `SignalsService.test.js` : verrouille l'exclusion (filtre SQL + count).

## Fichiers modifiés

- `frontend-on-cf-worker/index.html` — conteneur `#stepsSidebar`.
- `frontend-on-cf-worker/app/ui/stepsSidebar.js` — réécriture (arbre cliquable + collapse + init + gate).
- `frontend-on-cf-worker/app/ui/initAllUI.js` — `initStepsSidebar()`.
- `frontend-on-cf-worker/app/ui/stepsSidebar.tree.test.js` — tests (collapse markup, accessibility gate, clickable/current/locked).
- `frontend-on-cf-worker/i18n/en.json` + `fr.json` — namespace `sidebar`.
- `frontend-on-cf-worker/styles/course.css` — CSS arbre leçons/sections.
- `backend/services/signals/SignalsService.js` — filtre `node_kind='LESSON'`.
- `backend/services/signals/SignalsService.test.js` — nouveau (lock exclusion).
- `backend/services/courses/CoursesService.js` — filtre step count.
- `backend/services/enrollment/EnrollmentService.js` — filtre total_classes (×2).
- `db/migrations/007_seed_pa06_sections.mjs` — seed 3 sections pa06-2.

Commits : `31b0572` (feature) · `63483c5` (can_access iter) · `cd8e7d6` (SECTION-count fix + gate align). Déploiements : lms-viewer `96e763f9`, lms-api `dd33ae84`.

## Résultat de validation

- ✅ pa06-2 : **3 sections repliables** (« 1. Préparation & Structure », « 2. Rédaction du contenu », « 3. Validation & Publication ») avec les 15 leçons groupées, étape courante surlignée, verrouillées en 🔒 (screenshot).
- ✅ Progression **0/15** (plus 18 — SECTION exclues des steps).
- ✅ Collapse toggle : children flex→none, aria-expanded + chevron corrects, re-expand OK (live).
- ✅ Jump end-to-end (pw05-2, qui a de la progression) : clic STEP 02 → URL `step=2`, contenu + compteur « Étape 2 / 6 » + surbrillance sidebar déplacée.
- ✅ pw05-2 (plat, sans sections) : rend la liste plate sans régression (6 leçons, 0 section).
- ✅ Console : **0 erreur** sur pa06-2 ET pw05-2.
- ✅ `npx tsc --noEmit` 0 · `npm test` **167/167** (18 fichiers) · entropy `--last-status check` **RATCHET OK** (zéro ACK).
- ✅ tpb-browser : fresh + reload, 2 cours, jump + collapse (§ PLAN FRONTEND DONE).
