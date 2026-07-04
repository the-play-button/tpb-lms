# Plan 08 — Skool-parity : landing Classroom + aperçu cours — DONE

## Ce qui a été fait

L'entrée Classroom (2e pan du modèle Skool) est câblée : la racine montre une
grille de cartes cours, chaque carte ouvre un aperçu (description + programme
sections/leçons + CTA), et un retour « ← Tous les cours » ramène à la grille.

### 1. Landing Classroom (grille)
- `app/ui/classroom.js` (nouveau) : `renderClassroom()` rend une `.course-grid`
  de `.course-card` dans `#somViewer` (cover dégradé déterministe par hash du
  courseId, titre, description, barre de progression, CTA Commencer/Continuer/Revoir).
  Progression réelle : la liste `/courses` ne porte que `{videos_completed,
  quizzes_passed}` (pas de total) → fetch `/signals/:id` par cours en parallèle →
  `course_progress.percent` exact. `initClassroom()` : délégation clic carte →
  `showCourseOverview` + refresh sur changement de `courses`.
- `bootSequence.js` : racine (aucun `?som`) → `renderClassroom()` (plus de
  drop direct dans le cours 1). Deep-link `?som=<id>&step=N` inchangé.
- `initAllUI.js` : `initClassroom()`.

### 2. Aperçu cours (course overview)
- `overview.js` : `renderCourseOverview` (déjà écrit, jamais monté) enrichi d'un
  **programme** `renderCourseOutline` (arbre SECTION→LESSON, ou liste plate).
  `showCourseOverview` fetch le cours avec `?lang=` → titre localisé cohérent
  avec la carte (était toujours EN). CTA « Commencer/Continuer/S'inscrire » →
  `loadCourse` (même chemin que le deep-link).

### 3. Retour « ← Tous les cours »
- `stepsSidebar.js` : bouton `.back-to-classroom` dans le header + handler
  (dynamic import `renderClassroom`).

### 4. CSS + i18n
- `styles/course.css` : `.classroom`, `.course-grid`, `.course-card` (cover, hover,
  progress, CTA), `.course-outline` (programme). Design tokens.
- i18n : `classroom.title`, `course.{start,continue,review,curriculum}`,
  `nav.allCourses` en+fr.

### Bugs corrigés en cours de vérif live (§ PLAN FRONTEND DONE)
- **Subscription args** : `subscribe()` passe `(value, oldValue)` →
  `renderStepsSidebar(value)` recevait `courseData` comme `options` ; destructurer
  un `courseData=null` (retour Classroom) throw → subscriber marqué cassé → l'arbre
  ne se vidait pas. Fix : `subscribe('courseData', () => renderStepsSidebar())`
  (+ signals, currentStepIndex). Le retour Classroom vide/masque bien la sidebar.
- **Double-échappement carte** : la description était un `safeHtml` imbriqué non
  `raw()`-wrappé dans le template parent → `<span>` littéral affiché sur les cartes.
  Fix : `raw(safeHtml\`<span…>${desc}</span>\`)` (description déjà échappée en interne).

## Fichiers modifiés

- `frontend-on-cf-worker/app/ui/classroom.js` (nouveau) — grille + renderCard + init + progress fetch.
- `frontend-on-cf-worker/app/ui/classroom.test.js` (nouveau) — renderCard (states + desc).
- `frontend-on-cf-worker/app/course/overview.js` — `renderCourseOutline` + `?lang=`.
- `frontend-on-cf-worker/app/init/bootSequence.js` — racine → `renderClassroom`.
- `frontend-on-cf-worker/app/ui/initAllUI.js` — `initClassroom()`.
- `frontend-on-cf-worker/app/ui/stepsSidebar.js` — bouton retour + fix subscriptions.
- `frontend-on-cf-worker/i18n/en.json` + `fr.json` — classroom/course/nav.
- `frontend-on-cf-worker/styles/course.css` — CSS classroom + card + outline.

Commits : `35888c2` (feature) · `07e67be` (progress réel + lang) · `ac41c02` (fix subscriptions) · `f5ae833` (fix desc escape). Déploiement lms-viewer `ad572d25`.

## Résultat de validation

- ✅ Racine `/` → **grille Classroom** : 2 cartes (cover dégradé + play), descriptions **propres** (plus de `<span>` littéral), progression réelle (pa06-2 0% « Commencer », pw05-2 17% « Continuer »), sidebar leçons masquée (screenshot).
- ✅ Clic carte → **aperçu cours** : titre FR (lang fix), programme (pa06-2 : 3 sections + 15 leçons ; pw05-2 : 6 leçons plates), CTA.
- ✅ « ← Tous les cours » depuis un cours → retour grille + **sidebar leçons vidée/masquée** (display:none, is-empty).
- ✅ Deep-link `?som=pa06-2&step=1` → cours + arbre in-course (Plan 07) inchangé.
- ✅ Console : **0 erreur** (classroom, overview, cours, retour).
- ✅ `npx tsc --noEmit` 0 · `npm test` **170/170** (19 fichiers) · entropy `--last-status check` **RATCHET OK** (zéro ACK).
- ✅ tpb-browser : fresh + reload, parcours Classroom → carte → overview → retour (§ PLAN FRONTEND DONE).
