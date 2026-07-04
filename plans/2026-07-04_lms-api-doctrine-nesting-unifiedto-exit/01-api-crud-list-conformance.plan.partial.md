## Ce qui a été fait

Conformité CRUD/list sur la couche **où la doctrine est enforçable et le risque nul**
(zéro consumer frontend — vérifié : `grep /api/ frontend/` = 0 ; seuls `rateLimit.js`
+ 1 test Python référencent les paths).

- **A — Aliases d'URL dupliqués supprimés** (SSOT) : `/api/soms`, `/api/soms/:courseId`,
  `/api/profile` retirés de `backend/index.js`. `/api/courses`, `/api/courses/:id`,
  `/api/learner` restent canoniques.
- **C/E — Renames `application/sharing`** (couche DDD, blessed CRUD prefixes) :
  `shareContent → createShare`, `revokeShare → deleteShare`,
  `sharedByMe → listSharedByMe`, `sharedWithMe → listSharedWithMe`. Dirs + fichiers +
  barrels + profondeur d'imports (`../../` → `../../../` pour les 2 use-cases passés
  de fichiers plats à sous-dossiers) + imports/routes dans `index.js`. Supersède le
  stub `2026-03_crud-list-endpoint-refactor` (chemins réels, exécuté cette fois).
- **B — Renames handlers sûrs** (verbe pur, zéro changement de logique) :
  `revokeAPIKeyHandler → deleteAPIKeyHandler`, `addGlossaryTerm → createGlossaryTerm`,
  `resetCourseSignals → deleteCourseSignals` + route `POST /api/signals/:courseId/reset`
  → `DELETE /api/signals/:courseId` (state-transition = delete).

## Ce qui bloque

Le reste du scope A-E touche la couche **`backend/handlers/` legacy**, que le
`TODO.md` du repo **gate explicitement sur une passe RDD** :
> « 40 JS handler routes under `backend/handlers/` are NOT pipelined. Before
> pipelining them, the LMS ERD needs clarification through a Requirements-Driven
> Design (RDD) pass. Many handlers may not need to exist as-is — some should be
> merged, some split, some removed. »

Ces items sont des **restructures sémantiques** (pas de simples renames), donc
gouvernés par cette passe RDD, pas par Plan 01 :

- **enroll/abandon/complete → Enrollment CRUD** : `enrollInCourse → createEnrollment`
  (`POST /api/enrollments`) + `abandonCourse`/`completeCourse` → merge en
  `updateEnrollment` `{status}` (`PATCH /api/enrollments/:id`). Touche la logique
  gamification (awards on complete) → RDD-gated.
- **Batch → bulk-create unifié** : `events/batch`, `translations/batch`,
  `glossary/:locale/import` — sémantique d'ingestion (single vs bulk, idempotency,
  rate-limit distinct) à trancher en RDD.
- **quiz → quiz-submissions** : nécessite de modéliser l'entité `QuizSubmission`
  (Tier 1 create sur sous-entité) → RDD.
- **Filtered-lists → query params** : `translations/review → ?status=review`,
  `content/cloud/pitch → ?usage=pitch`, `connections/default` (touché par Plan 04),
  `shared-*-me` (paths conservés ; handlers déjà renommés `list*`). Changements de
  contrat de réponse → à valider en RDD.

## Questions

Aucune question bloquante. Décision proposée (à valider) : ouvrir une **initiative
RDD dédiée `handlers/`** (celle que le TODO.md schedule déjà) pour les restructures
sémantiques ci-dessus, plutôt que les forcer dans Plan 01 au risque de casser la
gamification / l'ingestion. Plan 01 livre la conformité sûre + enforçable maintenant.

## État du code

**Propre.** `npx tsc --noEmit` = 0 erreur. Specs `sharing/**` = 4/4 pass. Sidecar
`01-...plan.after.py` = all pass. Zéro identifiant obsolète résiduel (grep clean).
Commit `7c920f2`. Aucun revert nécessaire.
