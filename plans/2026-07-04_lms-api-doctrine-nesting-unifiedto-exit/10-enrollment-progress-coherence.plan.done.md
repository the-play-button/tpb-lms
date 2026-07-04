# Plan 10 — Cohérence enrollment / progression — DONE

## Ce qui a été fait

Le CTA principal de l'overview reflète désormais la **progression réelle** au lieu
de l'enrollment (qui ne gate rien). Fini le « S'inscrire » trompeur sur un cours
déjà entamé.

### CTA principal progression-driven
- `overview.js` : `renderPrimaryCta(course)` (nouveau, exporté + testé) calcule le
  label depuis `course.progress` (`completed_steps`/`total_steps`) :
  - complété → **Revoir** (`course.review`)
  - entamé → **Continuer (X%)** (`course.continue`)
  - vierge → **Commencer** (`course.start`)
  - `data-action="open"` → `loadCourse` (marche indépendamment de l'enrollment).

### Enrollment démoté en secondaire (préservé — § interdiction de revert)
- `renderEnrollmentSecondary` : action optionnelle « Ajouter / Retirer de mes cours
  actifs » (`course.addToActive` / `removeFromActive`), plus jamais le CTA principal.
- `setupOverviewHandlers` : `open` → loadCourse ; enroll/abandon **rafraîchissent
  l'overview** (`showCourseOverview`) au lieu de rediriger dur. Warning cap max-3 conservé.

### Question produit laissée ouverte
L'enrollment reste quasi-vestigial (gate rien, absent des listes). Ce plan rend
juste le CTA honnête sans trancher son avenir (garder / auto-enroll / supprimer)
— décision produit à l'utilisateur.

## Fichiers modifiés

- `frontend-on-cf-worker/app/course/overview.js` — `renderPrimaryCta` + `renderEnrollmentSecondary` + handlers.
- `frontend-on-cf-worker/app/course/overview.test.js` (nouveau) — renderPrimaryCta states.
- `frontend-on-cf-worker/i18n/en.json` + `fr.json` — `course.{addToActive,removeFromActive}`.

Commit : `6d2e880`. Déploiement lms-viewer `e02d5e7c`.

## Résultat de validation

- ✅ Overview pw05-2 (17%) : CTA principal **« Continuer (17%) »** (était « S'inscrire au cours »), `hasSInscrire: false`.
- ✅ CTA principal → `loadCourse` : clic entre dans le cours (step 2, sans enrollment).
- ✅ Enrollment démoté : secondaire **« Ajouter à mes cours actifs »** présent (feature préservée, pas de revert).
- ✅ Console : **0 erreur**.
- ✅ `npx tsc --noEmit` 0 · `npm test` **184/184** (+4) · entropy `--last-status check` **RATCHET OK** (zéro ACK).
- ✅ tpb-browser : Classroom → carte → overview CTA progression-driven → ouvre le cours (§ PLAN FRONTEND DONE).
