# Plan 09 — Mode de progression paramétrable (linear | free) — DONE

## Ce qui a été fait

La progression est désormais **paramétrable par cours** via
`lms_course.raw_json.tpb_progression_mode ∈ {linear, free}` (défaut `linear`).
`linear` = verrou hyper-linéaire (parcours d'intégration). `free` = navigation
libre style Skool. Zéro nouvelle colonne/table (colonne JSON existante, convention
`tpb_*`).

### Backend
- `_progressionMode.js` (nouveau) : `resolveProgressionMode(raw_json)` → défaut
  `linear`, valeur invalide → `linear` + `console.warn` (§ WARNINGS = SIGNAL, on
  surface le typo), jamais de throw (un typo de config ne 500 pas le cours). Export
  `PROGRESSION_MODES` + `DEFAULT_PROGRESSION_MODE`.
- `SignalsService` : lit le mode du cours (`SELECT raw_json FROM lms_course`) →
  free = tous `can_access=true` + `can_access_step=total` + skip `hasCorruptedState`
  (invariant linear-only) ; expose `progression_mode` dans le body.
- `CoursesService.getCourseForUser` : expose `progression_mode` + `can_access_step`
  mode-aware (free → total).

### Frontend (tout gate sur `courseData.progression_mode`, défaut linear)
- `navigation.nextStep` : gate complétion **uniquement** en linear.
- `navigation.prevStep` : free → `navigateToStep(stepIndex-1)` ; linear → alert (inchangé).
- `renderer` : `canProceed |= isFree` ; bouton prev activé + `window.prevStep()` en free.
- i18n `course.freeNavigation` en+fr.
- `navigateToStep` + sidebar (Plan 07) : **rien changé** — pilotés par `can_access_step`
  (= total en free), se libèrent automatiquement.

### Données
- `008_seed_progression_modes.mjs` : pa06-2 → `free` (démo Skool). pw05-2 non muté →
  reste `linear` (verrou onboarding WGE préservé par défaut). Appliqué remote.

### Bug corrigé en vérif live
- **Bouton prev onclick échappé** : j'injectais `onclick="window.prevStep()"` via
  une interpolation `safeHtml` → guillemets échappés (`onclick=&quot;…&quot;`) → la
  valeur devenait la string littérale `"window.prevStep()"` = no-op. Fix : onclick
  écrit **littéralement** dans le template (comme le bouton next) + seul `disabled`
  via interpolation.

## Fichiers modifiés

- `backend/services/courses/_progressionMode.js` (nouveau) + `_progressionMode.test.js` (nouveau).
- `backend/services/signals/SignalsService.js` — mode-aware + expose mode.
- `backend/services/signals/SignalsService.test.js` — cas linear/free.
- `backend/services/courses/CoursesService.js` — expose mode + can_access_step.
- `backend/services/courses/CoursesService.tree.test.js` — cas progression_mode.
- `frontend-on-cf-worker/app/course/navigation.js` — nextStep/prevStep mode-aware.
- `frontend-on-cf-worker/app/course/renderer.js` — canProceed + bouton prev.
- `frontend-on-cf-worker/i18n/en.json` + `fr.json` — `course.freeNavigation`.
- `db/migrations/008_seed_progression_modes.mjs` (nouveau) — pa06-2 → free.

Commits : `0f39527` (feature) · `cfc1d9b` (fix prev onclick). Déploiements : lms-api `57a87249`, lms-viewer `9501d773`.

## Résultat de validation

- ✅ **pa06-2 (free)** : **14 leçons cliquables, 0 verrouillée** (saut libre), next actif sans compléter, prev actif dès step > 1. Jump sidebar step 5 OK ; **retour arrière** via bouton prev (clic réel) step 5 → step 4 confirmé.
- ✅ **pw05-2 (linear)** : verrou **intact** — 1 seule leçon cliquable (la suivante), 4 verrouillées, prev disabled. Défaut linear préservé (non muté).
- ✅ `progression_mode` exposé dans course body + signals ; config invalide → linear + warn (pas de 500, pas de silent fallback).
- ✅ Console : **0 erreur** sur les 2 modes.
- ✅ `npx tsc --noEmit` 0 · `npm test` **180/180** (+10) · entropy `--last-status check` **RATCHET OK** (zéro ACK).
- ✅ tpb-browser : fresh + reload, free + linear vérifiés (§ PLAN FRONTEND DONE).
