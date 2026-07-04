# Plan 10 — Cohérence enrollment / progression (CTA overview progression-driven)

## Contexte

Incohérence observée live : pw05-2 a **17% de progression** mais l'overview affiche
CTA **« S'inscrire au cours »**. Diagnostic read-only :

- **L'enrollment ne gate RIEN** : aucune référence dans les handlers `courses` /
  `signals` ; `loadCourse` charge n'importe quel cours sans enrollment ; la
  Classroom (Plan 08) et « Mon Parcours » listent **tous** les cours (via `/courses`),
  pas seulement les enrollés.
- **La progression est indépendante** : créée via `lms_event` → vue `v_user_progress`.
  Aucune création d'enrollment sur progression.
- **L'enrollment n'est utilisé QUE dans `overview.js`** (`renderEnrollmentButton` +
  warning cap max-3 + abandon). C'est une curation optionnelle, déconnectée de l'accès.

→ Un utilisateur peut avoir de la progression sans enrollment (accès deep-link ou
ancien auto-load). Le CTA branche sur `isEnrolled` au lieu de la **progression réelle**,
d'où « S'inscrire » sur un cours à 17%.

## Objectif

Découpler le **CTA principal** de l'overview de l'enrollment : le bouton principal
reflète la **progression réelle** (Commencer / Continuer / Revoir) et fait toujours
`loadCourse` (qui marche indépendamment de l'enrollment). L'enrollment
(inscription / abandon / cap) devient une **action secondaire optionnelle**,
plus jamais le CTA principal trompeur.

Note produit (hors scope de ce plan, à trancher séparément) : l'enrollment est
quasi-vestigial (gate rien, absent des listes). Faut-il le supprimer, l'auto-gérer
(auto-enroll à l'engagement), ou le garder comme curation optionnelle ? Ce plan ne
tranche PAS — il rend juste le CTA honnête. La décision « avenir de l'enrollment »
reste à l'utilisateur.

## Étapes

### 1. CTA principal progression-driven
`overview.js` :
- Calculer depuis `course.progress` (déjà dans le body `/courses/:id` :
  `completed_steps`, `total_steps`) :
  - `completed_steps >= total_steps && total_steps > 0` → **Revoir** (`course.review`).
  - `completed_steps > 0` → **Continuer (X%)** (`course.continue`).
  - sinon → **Commencer** (`course.start`).
- Le CTA principal `data-action="open"` → `loadCourse(courseId)` (toujours, sans
  dépendre de l'enrollment).
- Retirer la branche « `isEnrolled ? Continuer : S'inscrire` » du bouton principal.

### 2. Enrollment démoté en secondaire (optionnel, préservé — pas de revert)
- Garder les actions enroll / abandon comme **boutons secondaires** sous le CTA
  principal (§ INTERDICTION DE REVERT : on ne supprime pas la feature, on la démote).
  - Non-enrollé + `can_enroll` → petit lien secondaire « Ajouter à mes cours actifs »
    (`course.addToActive`) → `apiPost('/enrollments')` (sans forcer loadCourse — le
    CTA principal s'en charge).
  - Enrollé → « Retirer de mes cours actifs » (`course.removeFromActive`) → abandon.
  - Warning cap max-3 conservé (inchangé).
- Les handlers `setupOverviewHandlers` : ajouter `data-action="open"` → loadCourse ;
  garder enroll/abandon mais sans redirection dure (rafraîchir l'overview).

### 3. i18n
`course.addToActive`, `course.removeFromActive` en+fr. Réutiliser `course.{start,continue,review}` (Plan 08).

### 4. Tests + déploiement + vérif live
- Test overview CTA logic (progress → label + action) si extractible en fonction pure.
- tsc 0 · npm test vert · entropy RATCHET OK.
- tpb-browser : pw05-2 (17%) → CTA **« Continuer (17%) »** → clic → entre dans le cours.
  pa06-2 (0%) → **« Commencer »** → entre. Actions enroll/abandon secondaires présentes.
  0 erreur console.

## Fichiers

- `frontend-on-cf-worker/app/course/overview.js` — CTA principal progression-driven + enroll démoté.
- `frontend-on-cf-worker/i18n/en.json` + `fr.json` — `course.{addToActive,removeFromActive}`.
- Test associé si fonction pure extractible.

## Critères

- CTA principal reflète la progression (Commencer/Continuer/Revoir), plus jamais « S'inscrire » trompeur sur un cours entamé.
- Clic CTA principal → `loadCourse` (marche sans enrollment).
- Enroll / abandon préservés en secondaire (pas de revert de la feature).
- pw05-2 (17%) → « Continuer (17%) » live ; pa06-2 (0%) → « Commencer ».
- tsc 0 · tests verts · entropy RATCHET OK · 0 erreur console.

## Risques

- **Ne pas supprimer l'enrollment** (§ INTERDICTION DE REVERT) — on le démote, on le
  garde fonctionnel en secondaire. La suppression éventuelle est une décision produit
  séparée.
- **`course.progress` dans le body overview** : `showCourseOverview` fetch `/courses/:id`
  sans `?lang=`... corrigé Plan 08 (avec `?lang=`). Le body porte `progress`
  (completed_steps/total_steps). Vérifier la présence ; sinon dériver via `/signals/:id`
  (déjà fetché ? non — overview fetch courses + enrollments). Si `progress` absent du
  body `/courses/:id`, ajouter un fetch `/signals/:id` léger (comme la Classroom Plan 08).
- **Pas de décision produit unilatérale** sur l'avenir de l'enrollment — ce plan
  se limite à rendre le CTA honnête.
