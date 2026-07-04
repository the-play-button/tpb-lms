# Plan 07 — Skool-parity : navigation leçons + sections in-course (rendre la hiérarchie VISIBLE)

## Contexte

Question utilisateur 2026-07-04 : *« la notion de courses / modules / sections, je
la vois pas dans l'UI »*. Diagnostic empirique (tpb-browser) :

- **Cours** : visibles mais minimalistes — liste texte dans `#somList` (« Mon Parcours »).
- **Modules / sections** : **INVISIBLES**. `renderNodesTree`/`renderStepsSidebar`
  (construits au Plan 03 pour l'arbre SECTION→LESSON) sont **du code mort** :
  référencés uniquement dans les tests, jamais montés. Leur conteneur cible
  `#stepsSidebar` **n'existe pas** dans `index.html`. Zéro CSS
  (`.steps-list`/`.step-item`/`.section-header` → 0 règle).
- **Leçons** : **INVISIBLES en tant que liste**. Dans un cours on navigue
  UNIQUEMENT via prev/next + « Étape N/15 ». Impossible de voir toutes les leçons
  ni de sauter à l'une d'elles.
- **Données plates** : les 2 cours (`pa06-2`, `pw05-2`) n'ont aucune row
  `node_kind='SECTION'` — donc même une fois l'arbre monté, il rendrait plat.

`navigateToStep(stepIndex)` existe déjà dans `navigation.js` (le jump est possible).
La migration `006_nested_sections.sql` a déjà ajouté `parent_class_id` + `node_kind`.
Le backend `CoursesService.getCourseForUser` construit déjà `course.nodes[]` (arbre).

**Objectif de ce plan** : monter l'arbre leçons+sections dans la sidebar in-course
(Skool « course page left rail »), le rendre cliquable (jump), le styler, et
**seeder des sections réelles sur pa06-2** pour que la hiérarchie soit démontrée
end-to-end (ERD → API → UI).

Hors scope (→ Plan 08) : landing « Classroom » (grille de cartes cours) + page
d'aperçu cours. Ici on se concentre sur la nav in-course.

## Étapes

### 1. Layout — conteneur `#stepsSidebar`
`frontend-on-cf-worker/index.html` : dans `nav.lms-sidebar`, ajouter une
`nav-section` avec `<div id="stepsSidebar"></div>` **au-dessus** de « Mon Parcours ».
Elle affiche l'arbre du cours courant (titre + progress + sections + leçons).
« Mon Parcours » (`#somList`) reste = switcher inter-cours (Plan 08 le fera évoluer
en retour Classroom). Header de section masqué tant qu'aucun cours n'est chargé
(`#stepsSidebar` vide → `display:none` via classe `.is-empty`).

### 2. Wiring — monter `renderStepsSidebar` sur chargement + progression
- `app/course/loader.js` : après `setState('courseData', course)` +
  `setState('signals', signals)` + `setState('currentStepIndex', ...)`, appeler
  `renderStepsSidebar()`.
- `app/ui/initAllUI.js` : ajouter `initStepsSidebar()` qui `subscribe('currentStepIndex', renderStepsSidebar)` + `subscribe('signals', renderStepsSidebar)` (re-render sur navigation + complétion).
- Exporter `initStepsSidebar` depuis `app/ui/stepsSidebar.js`.

### 3. Leçons cliquables (jump) — Skool laisse cliquer les leçons accessibles
`app/ui/stepsSidebar.js::renderLessonItem` : ajouter `data-step="${index}"` (déjà
présent) + une classe `clickable` quand `!isLocked`. Câbler un listener délégué
(dans `initStepsSidebar`) : clic sur `.step-item.clickable` → `navigateToStep(Number(el.dataset.step))`.
Les leçons `locked` (index > currentStepIndex+1) restent non-cliquables (curseur
`not-allowed`, pas de handler). Retirer la mention docstring « Non-clickable for
hyper-linear progression » (devenue fausse) → remplacer par la règle réelle
(accessibles cliquables, verrouillées non).

### 4. Sections repliables + i18n
- `renderNodesTree` : les `.section-header` deviennent des `<button>` toggle qui
  collapse/expand les enfants (état local via classe `.collapsed` sur le groupe).
  Utiliser un wrapper `.section-group` autour du header + enfants pour cibler le
  collapse. Défaut : expand.
- Router les libellés fixes (« sidebar-title » = titre cours ; le compteur
  `${completedSteps.size}/${n}`) — pas de libellé FR en dur ; le titre vient de la
  donnée. Rien à traduire de neuf ici hormis un éventuel aria-label toggle
  (`course.toggleSection`, clé ajoutée en+fr).

### 5. CSS — `styles/course.css` (ou `components.css`)
Ajouter les règles manquantes, alignées sur le design tokens existants
(`var(--bg-card)`, `var(--border)`, `var(--text-primary)`, `var(--radius-md)`) :
- `.sidebar-header` / `.sidebar-title` / `.sidebar-progress` / `.progress-text` / `.progress-bar-mini` / `.progress-fill`.
- `.steps-list` (colonne, gap).
- `.section-group` / `.section-header` (button, indent par `padding-left` inline déjà géré, chevron ▸/▾ via `.collapsed`).
- `.step-item` + états `.current` (accent), `.completed` (✓ vert), `.locked` (dim + 🔒 + `cursor:not-allowed`), `.pending`, `.clickable` (hover).
- `.step-status` / `.step-name` / `.step-type-icon`.

### 6. Données — seeder des sections réelles sur pa06-2 (démonstration ERD)
`db/migrations/007_seed_pa06_sections.mjs` (idempotent, réversible) : créer 3 rows
`lms_class` `node_kind='SECTION'` pour le cours pa06-2 (ex. « 1. Préparation »,
« 2. Rédaction », « 3. Validation & Publication ») + assigner `parent_class_id`
aux 15 leçons existantes selon leur `order_index` (bornes à déterminer en lisant
les noms de steps). N'altère PAS le contenu des leçons — seulement le regroupement
(réversible : `parent_class_id=NULL` + delete des 3 SECTION rows). Appliquer sur
lms-db remote. Vérifier via l'API que `course.nodes[]` reflète l'arbre.

### 7. Tests
- `app/ui/stepsSidebar.tree.test.js` : étendre — clic sur leçon accessible →
  `navigateToStep` appelé avec le bon index ; leçon locked → pas d'appel ; collapse
  toggle cache/montre les enfants.
- `npx tsc --noEmit` 0 · `npm test` vert · `node --check` sur les JS modifiés · entropy `--last-status check` RATCHET OK.

### 8. Déploiement + vérification live (§ PLAN FRONTEND DONE)
Déployer lms-viewer (frontend). Via tpb-browser sur pa06-2 :
- La sidebar affiche l'arbre : 3 sections repliables, chacune avec ses leçons.
- Clic sur une leçon accessible → saute à cette étape (contenu change).
- Leçon verrouillée non-cliquable.
- État courant/complété visible (▶ / ✓ / 🔒).
- Fresh load + reload, **0 erreur console**.
- Vérifier pw05-2 (flat, pas de sections) → rend la liste plate sans casser.

## Fichiers

- `frontend-on-cf-worker/index.html` — conteneur `#stepsSidebar` dans `nav.lms-sidebar`.
- `frontend-on-cf-worker/app/course/loader.js` — appel `renderStepsSidebar()` post-load.
- `frontend-on-cf-worker/app/ui/initAllUI.js` — `initStepsSidebar()` (subscribe + click delegation).
- `frontend-on-cf-worker/app/ui/stepsSidebar.js` — export `initStepsSidebar`, leçons cliquables, sections repliables, docstring corrigée.
- `frontend-on-cf-worker/i18n/en.json` + `fr.json` — `course.toggleSection` (aria).
- `frontend-on-cf-worker/styles/course.css` — CSS lesson tree + sections.
- `frontend-on-cf-worker/app/ui/stepsSidebar.tree.test.js` — tests jump + collapse.
- `db/migrations/007_seed_pa06_sections.mjs` — seed 3 SECTION nodes sur pa06-2 (idempotent, réversible).

## Critères

- `#stepsSidebar` monté ; l'arbre leçons+sections du cours courant est visible.
- pa06-2 affiche 3 sections repliables avec ses 15 leçons regroupées (données réelles seedées).
- Clic sur leçon accessible → `navigateToStep` → contenu change ; leçon verrouillée non-cliquable.
- États ▶/✓/🔒 corrects ; progression `x/n` juste.
- pw05-2 (plat) rend la liste sans régression.
- 0 libellé FR hardcodé neuf ; toggle a un aria-label i18n.
- tsc 0 · npm test vert · entropy RATCHET OK.
- tpb-browser : fresh + reload, 0 erreur console, sur les 2 cours.

## Risques

- **Seed sections pa06-2** = regroupement de démonstration (bornes de sections
  choisies d'après l'ordre des steps). Réversible (parent_class_id=NULL + delete
  SECTION rows). Ne touche pas le contenu des leçons. Si l'utilisateur veut un
  autre découpage, il ré-édite — le point ici est de démontrer la capacité ERD→UI.
- **Collapse state** : local (classe CSS), non persisté — acceptable (Skool ne
  persiste pas non plus le collapse par leçon). Pas de `setTimeout` (§ doctrine) —
  toggle synchrone sur clic.
- **Jump vs progression linéaire** : on autorise le clic sur les leçons
  accessibles (≤ currentStepIndex+1), on garde le lock au-delà — cohérent avec le
  gating existant `navigateToStep` (qui borne déjà `can_access_step`).
- `renderStepsSidebar` lit `getState('courseData')` — s'assurer qu'il est appelé
  APRÈS `setState('courseData')` dans loader.js (ordre garanti étape 2).
