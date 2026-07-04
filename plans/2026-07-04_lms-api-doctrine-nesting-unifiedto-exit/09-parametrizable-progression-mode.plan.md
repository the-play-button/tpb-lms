# Plan 09 — Mode de progression paramétrable par cours (linear | free)

## Contexte

Question utilisateur 2026-07-04 : le verrou hyper-linéaire actuel est **voulu**
pour un parcours d'intégration (forcer l'ordre). Mais pour un cours type Skool, il
veut la **navigation libre**. Aujourd'hui le mode est **hardcodé linéaire partout**,
pas paramétrable. → Extension : un `progression_mode` par cours.

### Diagnostic — où vit le verrou linéaire (chaîne complète)

**Backend** :
- `SignalsService.fetchCourseSignals` : `can_access_step = min(currentStep+1, len)`,
  `can_access = sys_order_index <= currentStep+1` par step, `hasCorruptedState`
  (reset si un step complété a un suivant non-accessible).
- `CoursesService.getCourseForUser` : `progress.can_access_step = min(currentStepIndex+1, len)`.

**Frontend** :
- `navigateToStep` : clamp à `can_access_step - 1`.
- `nextStep` : `alert("Vous devez compléter…")` si step non complété.
- `prevStep` : `alert("Progression linéaire : impossible de revenir")` — **bloqué dur**.
- `renderCurrentStep` : `canProceed = isContentStep || stepCompleted` (bouton next disabled) + bouton **prev toujours `disabled`**.
- `stepsSidebar` (Plan 07) : `maxAccessibleIndex = can_access_step - 1`.

**Stockage config** : `lms_course.raw_json` (colonne JSON free-form existante,
convention `tpb_*` déjà utilisée pour `tpb_step_type` etc.). Pas de nouvelle colonne.

**Point clé** : `can_access_step` pilote déjà `navigateToStep` + la sidebar. Si en
mode `free` le backend renvoie `can_access_step = total`, ces deux surfaces se
libèrent **automatiquement**. Restent à gérer explicitement : `nextStep`,
`prevStep`, `canProceed`, bouton prev (gates de complétion indépendants).

## Objectif

Ajouter `raw_json.tpb_progression_mode ∈ {'linear','free'}` (défaut `'linear'`).
`'linear'` = comportement actuel (onboarding). `'free'` = Skool (toutes leçons
accessibles, saut libre, retour arrière, pas de gate complétion). Démontrer sur
un cours réel.

## Étapes

### 1. Backend — helper résolution du mode
`backend/services/courses/_progressionMode.js` (nouveau) :
`resolveProgressionMode(rawJsonString)` → parse `raw_json`, lit `tpb_progression_mode`,
valide ∈ {`linear`,`free`}. Invalide/absent → `'linear'` + `log.warn` si présent-mais-invalide
(§ WARNINGS = SIGNAL : on ne masque pas un typo de config, on le surface). Export
const `PROGRESSION_MODES`.

### 2. Backend — SignalsService respecte le mode
- `queryCourseSteps` : joindre / requêter `lms_course.raw_json` (ou une petite
  requête `SELECT raw_json FROM lms_course WHERE id=?`) pour obtenir le mode.
- En mode `free` : `can_access_step = steps.length` + `can_access = true` pour tous
  + **skip `hasCorruptedState`** (l'invariant d'ordre linéaire ne s'applique pas).
- Exposer `progression_mode` dans le body signals.
- En mode `linear` : inchangé.

### 3. Backend — CoursesService expose le mode + can_access_step mode-aware
- `getCourseForUser` : lire le mode (via le helper), l'exposer dans `body.progression_mode`,
  et `progress.can_access_step = mode==='free' ? total : min(currentStepIndex+1, total)`.

### 4. Frontend — consommer `progression_mode`
- `courseData.progression_mode` (défaut `'linear'` si absent) disponible via getState.
- `navigation.js nextStep` : garder l'alert de complétion **uniquement** si
  `mode === 'linear'`.
- `navigation.js prevStep` : si `mode === 'free'` → `navigateToStep(stepIndex - 1)` ;
  sinon → alert linéaire (comportement actuel).
- `renderer.js renderCurrentStep` :
  - `canProceed = isContentStep || stepCompleted || mode === 'free'`.
  - Bouton prev : `disabled` sauf si (`mode === 'free'` && `stepIndex > 0`), avec
    `onclick="window.prevStep()"` + title i18n adapté.
- `navigateToStep` + sidebar : **rien à changer** (pilotés par `can_access_step`,
  déjà = total en free).
- i18n : `course.freeNavigation` (title bouton prev en free) en+fr.

### 5. Données — démontrer les 2 modes
- `db/migrations/008_seed_progression_modes.mjs` (idempotent) : set
  `raw_json.tpb_progression_mode='free'` sur **pa06-2** (cours de connaissance,
  style Skool) ; laisser **pw05-2** en `linear` (parcours d'intégration WGE, verrou
  voulu — pas de mutation = défaut linear). Appliqué remote.

### 6. Tests
- `_progressionMode.test.js` : linear par défaut, free reconnu, invalide → linear+warn.
- `SignalsService.test.js` : mode free → `can_access_step = total`, tous `can_access`,
  pas de reset.
- `CoursesService.tree.test.js` (ou nouveau) : `body.progression_mode` exposé.
- `renderer` / `navigation` : `canProceed` true en free ; `prevStep` navigue en free,
  bloque en linear.
- `npx tsc` 0 · `npm test` vert · entropy RATCHET OK.

### 7. Déploiement + vérif live (§ PLAN FRONTEND DONE)
Déployer backend + frontend. tpb-browser :
- **pa06-2 (free)** : toutes les leçons cliquables dans la sidebar (jump libre),
  bouton prev actif, next actif sans compléter, retour arrière OK.
- **pw05-2 (linear)** : comportement inchangé (verrou, prev bloqué, next gated).
- Fresh + reload, 0 erreur console sur les 2.

## Fichiers

- `backend/services/courses/_progressionMode.js` (nouveau) + `.test.js`.
- `backend/services/signals/SignalsService.js` — mode-aware can_access + body.
- `backend/services/signals/SignalsService.test.js` — cas free.
- `backend/services/courses/CoursesService.js` — expose mode + can_access_step.
- `frontend-on-cf-worker/app/course/navigation.js` — nextStep/prevStep mode-aware.
- `frontend-on-cf-worker/app/course/renderer.js` — canProceed + bouton prev.
- `frontend-on-cf-worker/i18n/en.json` + `fr.json` — `course.freeNavigation`.
- `db/migrations/008_seed_progression_modes.mjs` (nouveau) — pa06-2 → free.
- Tests frontend associés (renderer/navigation) si infrastructure le permet (node env).

## Critères

- `raw_json.tpb_progression_mode` lu partout, défaut `linear` (zéro régression onboarding).
- pa06-2 (free) : sidebar toutes leçons cliquables, prev/next libres, retour arrière OK.
- pw05-2 (linear) : verrou inchangé (prev bloqué, next gated, sidebar gated).
- `progression_mode` exposé dans course body + signals.
- Config invalide → linear + warn (pas de silent fallback ni de 500).
- tsc 0 · tests verts · entropy RATCHET OK · 0 erreur console live.

## Risques

- **Régression onboarding** : le défaut DOIT rester `linear`. pw05-2 non muté = reste
  linear par construction. Tests verrouillent le défaut.
- **`hasCorruptedState` en free** : on le skip (l'invariant est linear-only). Sans
  skip il ne triggerait de toute façon pas (tous can_access), mais on skip pour la
  clarté + éviter un reset accidentel.
- **Mode invalide** : `resolveProgressionMode` valide + log.warn + défaut linear.
  Pas de throw (un typo de config ne doit pas 500 le cours) — le warn le surface.
- **Requête lms_course dans signals** : +1 petite requête par appel signals. Négligeable
  (indexée par PK). Alternative : passer le mode depuis un cache — non justifié ici.
- **prevStep en free** : `navigateToStep(stepIndex-1)` respecte déjà le clamp bas (0).
  Pas de `setTimeout`, navigation synchrone.
