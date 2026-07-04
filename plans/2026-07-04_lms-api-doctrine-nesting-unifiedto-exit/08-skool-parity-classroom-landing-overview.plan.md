# Plan 08 — Skool-parity : landing « Classroom » + aperçu cours

## Contexte

Suite du Plan 07. Une fois la nav in-course (leçons+sections) montée, il reste le
2e pan du modèle Skool : l'**entrée Classroom**.

État actuel (tpb-browser) : la racine `/` tombe **directement dans le cours 1 / step 1**.
Il n'y a ni grille de cours (Classroom), ni page d'aperçu quand on choisit un cours.
`renderCourseOverview` + `showCourseOverview` (dans `app/course/overview.js`) existent
mais **ne sont jamais appelés** (code non câblé, `.course-overview` = 0 règle CSS).

Skool :
- **Classroom** = grille de cartes cours (cover, titre, description courte, barre de
  progression « X% », CTA Continuer/Commencer).
- **Course page** = aperçu (description + liste modules/leçons) puis la leçon.

**Objectif** : câbler `renderCourseOverview` comme landing cours, ajouter une vraie
grille « Classroom » à la racine (et via un retour « ← Tous les cours »), styler,
et brancher les CTA sur `loadCourse`.

## Étapes

### 1. Landing Classroom (grille de cartes)
- `app/ui/courseList.js` (ou nouveau `app/ui/classroom.js`) : `renderClassroom()`
  qui rend dans `#somViewer` une grille `.course-grid` de `.course-card` — une par
  cours enrollé : cover (fallback gradient si absent), titre, description courte
  (`course.description` tronquée), progress % (depuis `signals`/enrollment),
  bouton `Continuer` (si commencé) / `Commencer`.
- Boot : à la racine (aucun `?som=`), au lieu de `loadCourse(courses[0])`, appeler
  `renderClassroom()` (`bootSequence.js`). Si `?som=<id>` présent → comportement
  actuel (ouvre le cours).

### 2. Aperçu cours (course overview)
- Clic sur une carte → `showCourseOverview(courseId)` (déjà écrit) qui rend
  l'aperçu (description + liste des sections/leçons via `course.nodes`) + CTA
  « Commencer / Continuer » → `loadCourse(courseId)`.
- Ajuster `renderCourseOverview` pour lister les **sections+leçons** (consommer
  `course.nodes[]` si présent, sinon `classes`) — réutiliser la logique d'arbre du
  Plan 07 (extraire un helper partagé `renderLessonOutline(nodes|classes)` pour ne
  pas dupliquer — § SSOT).

### 3. Retour « ← Tous les cours »
- Header du `#stepsSidebar` (Plan 07) : ajouter un lien/bouton « ← Tous les cours »
  → `renderClassroom()` (revient à la grille). i18n `nav.allCourses`.

### 4. CSS
`styles/course.css` : `.course-grid` (grid responsive), `.course-card`
(cover/gradient, hover, progress bar, CTA), `.course-overview` (header cover +
titre + description + outline liste), états loading. Aligné design tokens.

### 5. i18n
Clés : `classroom.title`, `course.start`, `course.continue`, `course.progressPct`,
`nav.allCourses`, `course.lessonsCount` — en + fr. Aucun libellé FR en dur.

### 6. Tests + déploiement + vérif live
- Tests : `renderClassroom` produit N cartes ; clic carte → showCourseOverview ;
  CTA → loadCourse. tsc 0 · npm test vert · entropy RATCHET OK.
- Déployer lms-viewer. tpb-browser :
  - Racine `/` → grille Classroom (2 cartes, progress, CTA).
  - Clic carte → aperçu cours (description + liste sections/leçons).
  - CTA → entre dans le cours (leçon + arbre Plan 07 visible).
  - « ← Tous les cours » → revient à la grille.
  - Fresh + reload, 0 erreur console.

## Fichiers

- `frontend-on-cf-worker/app/ui/classroom.js` (nouveau) — `renderClassroom` + `initClassroom`.
- `frontend-on-cf-worker/app/course/overview.js` — outline sections/leçons via helper partagé.
- `frontend-on-cf-worker/app/course/renderLessonOutline.js` (nouveau) — helper SSOT arbre (partagé Plan 07 sidebar + overview).
- `frontend-on-cf-worker/app/init/bootSequence.js` — racine → `renderClassroom` (pas d'auto-loadCourse).
- `frontend-on-cf-worker/app/ui/stepsSidebar.js` — bouton « ← Tous les cours ».
- `frontend-on-cf-worker/i18n/en.json` + `fr.json` — clés classroom/overview.
- `frontend-on-cf-worker/styles/course.css` — CSS classroom + overview.
- Tests associés.

## Critères

- Racine = grille Classroom (cartes cours avec progression + CTA), plus de drop direct step 1.
- Clic carte → aperçu cours (description + outline sections/leçons).
- CTA → `loadCourse` → leçon + arbre in-course (Plan 07).
- « ← Tous les cours » → retour grille.
- 0 libellé FR hardcodé ; tout via `t()`.
- tsc 0 · npm test vert · entropy RATCHET OK.
- tpb-browser : fresh + reload, 0 erreur console, parcours complet Classroom → cours → leçon.

## Risques

- **Cover images** : les cours n'ont pas forcément de cover → fallback gradient
  déterministe (hash du courseId) pour éviter des cartes vides. Pas de dépendance
  image externe.
- **Progress %** : dérivé de `signals.steps` (complétés / total). Si `signals` pas
  encore chargé pour un cours non ouvert, afficher 0% (fetch enrollment léger par
  carte, ou lazy au survol) — décider au plus simple : fetch enrollment par cours
  au render classroom (N petits appels, N=2 aujourd'hui). Fail loud si l'API casse
  (§ ALWAYS FAIL HARD) mais carte rendue à 0%.
- **Régression deep-link** : `?som=<id>` doit continuer d'ouvrir directement le
  cours (ne pas forcer la grille) — garder la branche existante dans bootSequence.
- **Helper partagé `renderLessonOutline`** : extrait pour éviter la duplication
  entre sidebar (Plan 07) et overview — à faire proprement (§ SSOT), pas 2 copies.
