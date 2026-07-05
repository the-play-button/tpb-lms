# DONE — Sidebar = un seul arbre, scopé au programme courant

Exécuté 2026-07-05. Commit feat `f…` (voir `git log`), déployé sur `lms-viewer`.

## Ce qui a été fait
- **`index.html`** : les 2 nav-sections empilées (`#stepsSidebar` + `#somList` « Mon Parcours »)
  remplacées par **un seul** `#courseTree`.
- **`app/state.js`** : nouvel état `currentProgram`.
- **`app/ui/sidebar.js`** (NOUVEAU) : orchestre l'arbre unique selon le scope
  (`buildSidebarTreeHtml` pur + `renderSidebarTree` + `initSidebar`).
- **`app/ui/stepsSidebar.js`** : refactoré — exporte `buildLessonCtx`, `renderCourseLessons`,
  `toggleSection` (rendu leçons réutilisé sous le cours déplié) ; `renderStepsSidebar` +
  `initStepsSidebar` supprimés.
- **`app/ui/initAllUI.js`** : `initSidebar`/`renderSidebarTree` au lieu de courseList+stepsSidebar.
- **`app/init/eventListeners.js`** : handler `#somList` retiré (+ import mort `loadCourse`).
- **`app/ui/classroom.js`** + **`app/course/loader.js`** : `setState('currentProgram', …)`.
- **`app/ui/courseList.js`** + `courseList.test.js` : **supprimés** (→ `/tmp/recovery_2026-07-05_lms-sidebar-redesign/`).
- **`app/ui/sidebar.test.js`** (NOUVEAU) : 4 tests sur les 3 scopes.
- **CSS** (`base.css` déjà posée + `course.css` + `layout.css`) : styles `.tree-*` ; styles morts
  `#somList .nav-program*`, `.nav-list*`, `.steps-sidebar .sidebar-*` retirés.
- **i18n** : `nav.allPrograms` + `sidebar.programs` (fr + en).

## Vérifié (tpb-browser, session réelle)
1. Racine → picker « PROGRAMMES » : MAKER SCHOOL / TPB SALES ACADEMY en lignes repliées + 2 cours
   standalone. Zéro leçon. ✅
2. Clic « TPB Sales Academy » → sidebar = **uniquement** ses 5 cours (+ `← Tous les programmes`),
   aucun autre programme ; covers de cours affichés dans la grille. ✅
3. Clic cours « 2 — Outbound Mastery » → cours **déplié inline** (section Nick Saraev → 8 leçons,
   Part 7 = ▶), les 4 autres cours en lignes repliées. ✅
4. `← Tous les programmes` → retour picker. ✅
5. Deep-link reload `?som=course_mc_3` → rescope auto sur TPB Sales Academy, cours 3 déplié. ✅
6. **0 erreur console** sur tous les écrans. `vitest run frontend-on-cf-worker/` = 30/30. ✅
