# Plan 11 — Refonte UX : sidebar program-aware + fix CSS — DONE (2026-07-05)

## Résultat

Sidebar « Mon Parcours » **program-aware** (sections repliables : Maker School → ses 11
cours + cours standalone) et cartes de grille **alignées** (CTA en bas). Vérifié live
(screenshot). 199 tests, entropy OK. Commit `<plan11>`.

## Ce qui a été fait

### 1. Fix CSS cartes (`styles/course.css`)
- `.course-card-body { flex: 1; }` → les bodies s'étirent, cartes d'une rangée alignées.
- `.course-card-cta { margin-top: auto; padding-top: … }` → CTA pinné en bas. Fini le
  grand vide sous la carte « Maker School » (title + « 11 cours ») ; les 3 cartes de la
  1ère rangée font désormais **321px** (mesuré live).

### 2. Sidebar program-aware (`app/ui/courseList.js`)
- Refactor : `buildCourseListHtml(courses, programs, currentCourse, collapsed)` **pure**
  (exportée, testée) ; `renderCourseList` la wire au DOM.
- Groupe les cours par `program_id` → **sections repliables** par program (header : caret +
  nom + pill count ; `<ul class="nav-sublist">` des cours nestés) ; cours standalone plats
  en dessous. Un program sans cours est skippé.
- État replié persistant (module `Set`) → survit aux re-render (progress change).
- Toggle collapse : listener délégué wiré une fois (`dataset.programToggleWired`) sur
  `[data-program-toggle]`. Le clic cours `a[data-som-id]` → `loadCourse` reste géré par
  `eventListeners.js` (inchangé).
- `subscribe('programs', renderCourseList)` ajouté.

### 3. CSS sidebar (`styles/course.css`)
- `.nav-program-header` (bouton pleine largeur, uppercase, hover), `.nav-program-caret`
  (rotation -90° en collapsed), `.nav-program-count` (pill), `.nav-sublist` (indent +
  bordure gauche), `.nav-program.collapsed .nav-sublist { display:none }`.

## Vérif live (§ PLAN FRONTEND DONE)

- Sidebar : section **« MAKER SCHOOL » (11)** avec 11 cours nestés + 2 standalone
  (SOMs, WGE). Clic header → **replie/déplie** (sublist hidden ↔ visible, caret tourne).
  Clic cours nesté (« Automation Tutorials ») → **ouvre le cours**.
- Grille : cartes **alignées** (heights 321/321/321), CTA en bas.
- **0 erreur console**, fresh + reload.

### Gates
- `npx vitest run` 199/199 (dont 3 `buildCourseListHtml`) · entropy RATCHET OK. lms-viewer déployé.

## Fichiers

- `frontend-on-cf-worker/styles/course.css`
- `frontend-on-cf-worker/app/ui/courseList.js` + `courseList.test.js` (nouveau)

## Notes / follow-ups possibles (non-bloquants)

- **Ordre des cours** dans un program = alphabétique (API `name ASC`) — pas l'ordre
  pédagogique (Pre-Program → Month 1…). Nécessiterait un champ `order` sur le course.
- **Description du program** : la carte « Maker School » n'a pas de description (petit vide
  au milieu, CTA aligné en bas). L'ajouter demanderait un `updateProgram` (le program n'a
  que `createProgram` aujourd'hui). Optionnel.
