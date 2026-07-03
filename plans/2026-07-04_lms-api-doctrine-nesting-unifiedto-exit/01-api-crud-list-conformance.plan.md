# Plan 01 — API CRUD+List conformance (revue complète des 36 endpoints)

> Supersède le stub `plans/2026-03_crud-list-endpoint-refactor/01-rename-endpoints.plan.md`
> (jamais exécuté, chemins périmés, ne couvrait que 4 endpoints sharing).
> **Exécuté APRÈS 03 (nesting) et 02 (write-API)** pour renommer toute la surface
> en une passe, y compris les nouveaux endpoints.

## Contexte

Le LMS expose 36 endpoints définis inline dans `backend/index.js`. Beaucoup
violent `crud_list_only_endpoint_design_tier1.md` (aliases d'URL, state-transitions
déguisées, sub-resource creates déguisés, batch-as-endpoint, filtered-lists
déguisées). Le stub `plans/2026-03_crud-list-endpoint-refactor` visait ça mais
n'a jamais été exécuté et ne couvrait que 4 endpoints sharing (chemins périmés).
Ce plan couvre TOUTE la surface et supersède le stub.

## Objectif

Aligner les 36 endpoints sur `crud_list_only_endpoint_design_tier1.md` :
Tier 1 CRUD+List par défaut, Tier 2 acknowledgé, zéro alias, zéro batch-endpoint,
zéro CRUD déguisé. Filtered-lists via query params (§2 Filter).

## Inventaire complet + verdict doctrinal

Fichier routeur : `backend/index.js` (routes inline, arrays `publicRoutes` /
`standardRoutes` / `authKeyRoutes` / `byocRoutes` + `events`).

### A — Aliases d'URL dupliqués → SUPPRIMER l'alias (SSOT)

| Endpoint | Verdict | Action |
|---|---|---|
| `GET /api/soms` (== `listCourses`) | alias de `/api/courses` | **Supprimer** la route `/api/soms`. |
| `GET /api/soms/:courseId` (== `getCourse`) | alias de `/api/courses/:courseId` | **Supprimer**. |
| `GET /api/profile` (== `getLearnerProgress`) | alias de `/api/learner` | **Supprimer** `/api/profile`. |

> Vérifier les consumers frontend (`frontend/pages`) + externes avant suppression.
> "soms" (= Skool-Of-the-Month?) et "profile" sont des restes historiques.

### B — State-transitions déguisées → Tier 1 `update` (Q1)

| Endpoint actuel | Entité réelle | Nouveau |
|---|---|---|
| `POST /api/courses/:courseId/enroll` | crée une Enrollment | `POST /api/enrollments` `{ courseId }` (Q2 create sur sous-entité Enrollment) |
| `POST /api/courses/:courseId/abandon` | update Enrollment.status | `PATCH /api/enrollments/:enrollmentId` `{ status:'abandoned' }` |
| `POST /api/courses/:courseId/complete` | update Enrollment.status | `PATCH /api/enrollments/:enrollmentId` `{ status:'completed' }` |
| `DELETE /api/auth/api-keys/:keyId` (`revokeAPIKey`) | delete ApiKey | garder DELETE, renommer handler `revokeAPIKeyHandler` → `deleteAPIKeyHandler` |
| `POST /api/signals/:courseId/reset` | delete/reset Signals | `DELETE /api/signals/:courseId` (reset = suppression des signals du cours) |

> Enrollment lifecycle : `enroll` = create, `abandon`/`complete` = update status.
> Le doctrine (Q1/Q2) est explicite. `updateProgress` (`PATCH
> /api/enrollments/:courseId/progress`) est déjà Tier 1 update — le garder, mais
> uniformiser sur `:enrollmentId` si l'enrollment a un id propre (à vérifier :
> `lms_enrollment` a-t-il un `id` PK distinct de `(user_id, course_id)` ?).

### C — Sub-resource creates déguisés → Tier 1 `create` (Q2)

| Endpoint actuel | Nouveau | Note |
|---|---|---|
| `POST /api/quiz` (`handleQuizSubmission`) | `POST /api/quiz-submissions` handler `createQuizSubmission` | modéliser QuizSubmission comme entité |
| `POST /api/glossary/:locale` (`addGlossaryTerm`) | garder path, renommer handler `addGlossaryTerm` → `createGlossaryTerm` | add = create |
| `POST /api/content/:contentId/share` (`shareContent`) | `POST /api/content-shares` `{ contentId }` handler `createContentShare` | déjà repéré par stub 2026-03 |

### D — Batch-as-endpoint → décision par cas (Q3)

| Endpoint | Verdict | Action |
|---|---|---|
| `POST /api/events/batch` (`handleBatchEvents`) | ingestion telemetry bulk | **Garder** mais reclasser : c'est une ingestion append-only idempotente (déjà `POST /api/events` unitaire existe). Documenter comme bulk-create légitime OU router vers scheduler si volumineux. Décision : garder comme `POST /api/events` acceptant `{ events: [...] }` (bulk-create unifié), supprimer la route `/batch` séparée. |
| `POST /api/translations/batch` (`batchUpsertTranslations`) | bulk upsert | Unifier dans `PUT /api/translations` acceptant un array, OU garder + acknowledger. Décision : `PUT /api/translations` bulk-upsert (le single `PUT /:namespace/:locale/:key` reste). |
| `POST /api/glossary/:locale/import` (`importGlossaryTerms`) | bulk import | `POST /api/glossary/:locale` acceptant array = bulk-create ; supprimer `/import`. |

> Les "batch" ici sont des **bulk-CRUD** (create/upsert de N entités d'un coup),
> PAS des jobs cron. Le doctrine bannit "batch-job-as-endpoint" (Q3 = scheduler),
> pas le bulk-create. On unifie : un endpoint create/upsert accepte 1 ou N.

### E — Filtered-lists déguisées → query params (§2 Filter)

| Endpoint actuel | Nouveau | Filtre |
|---|---|---|
| `GET /api/translations/review` | `GET /api/translations?status=review` | Filter step strippe/scope |
| `GET /api/content/shared-with-me` | `GET /api/content-shares?direction=inbound` | scope par actor |
| `GET /api/content/shared-by-me` | `GET /api/content-shares?direction=outbound` | scope par actor |
| `GET /api/connections/default` | `GET /api/connections?default=true` (ou drop si géré par 04) | — |
| `GET /api/content/cloud/pitch` | `GET /api/content/cloud?usage=pitch` | filter par usage |

> `shared-with-me` / `shared-by-me` = même entité `ContentShare` listée avec un
> filtre `direction`. Le doctrine §2 : une URL, N shapes via Filter/query, pas
> N URLs.

### F — Tier 1 déjà conformes (aucune action)

`GET /api/courses`, `GET /api/courses/:courseId`, `GET /api/enrollments`,
`GET /api/badges`, `GET /api/leaderboard`, `GET /api/kms/spaces`,
`GET /api/kms/spaces/:spaceId`, `GET /api/kms/pages/:pageId`,
`GET /api/glossary/:locale`, `DELETE /api/glossary/:locale/:termId`,
`GET /api/translations/:namespace/:locale`,
`PUT /api/translations/:namespace/:locale/:key`, `POST /api/auth/api-keys`
(create), `GET /api/auth/api-keys` (list), `GET /api/connections` (list),
`GET /api/content/:contentId/permissions` (list),
`DELETE /api/content/:contentId/share/:shareId` (garder, renommer handler
`revokeShare` → `deleteShare`), `GET /api/auth/session` (get),
`GET /api/admin/stats` / `GET /api/stats` / `GET /api/learner` (reads).

### G — Webhooks / handle (conformes, Q4)

`POST /api/tally-webhook` (`handleTallyWithAuth`) — provider-driven, `handle*` OK.
`POST /api/events` (`handleEvent`) — reclasser `createEvent` (create, pas webhook).

### H — Admin duplicate

`POST /api/admin/api-keys` (`adminCreateAPIKeyHandler`) vs
`POST /api/auth/api-keys` (`createAPIKeyHandler`) — deux creates du même type.
Décision : garder les deux SI l'admin-variant a une sémantique distincte (crée
pour un autre user). Sinon fusionner via Filter/scope actor. À trancher en
lisant les 2 handlers.

## Étapes d'exécution

1. **Audit consumers** : `grep -rn "api/soms\|api/profile\|/enroll\|/abandon\|/complete\|shared-with-me\|shared-by-me\|translations/review\|glossary.*import\|/reset\|content/cloud/pitch\|connections/default"` dans `frontend/`, `Apps/**/` (consumers cross-repo), le SDK. Lister chaque call-site AVANT de renommer.
2. **Renames handlers + dossiers** DDD (`backend/lms/application/**`) : suivre le pattern du stub 2026-03 (créer dossier use-case, déplacer fichiers, barrel `index.ts`) — mais chemins réels sous `backend/lms/application/`, pas `backend/application/`.
3. **Réécrire les arrays de routes** dans `backend/index.js` : supprimer aliases (A), remapper paths (B/C/E), unifier bulk (D).
4. **Adapter les call-sites** frontend + consumers repérés à l'étape 1 (BIG BANG, pas d'alias de compat).
5. **Filter step** : pour les filtered-lists (E), implémenter le `?status=` / `?direction=` / `?usage=` dans le HydrateContext/Filter du list use-case.
6. **Track / entropy** : chaque handler renommé garde son `Track`. Lancer l'entropy check.

## Fichiers

- `backend/index.js` — arrays de routes (`publicRoutes`, `standardRoutes`,
  `authKeyRoutes`, `byocRoutes`, `events`) : suppression aliases, remap paths,
  unification bulk, mise à jour imports handlers.
- `backend/handlers/**/*.js` — renames de handlers legacy (enrollment, glossary,
  quiz, signals, apikeys).
- `backend/lms/application/{sharing,connections,cloudContent}/**` — renames
  use-cases DDD (dossiers + fichiers step + barrels), **chemins réels sous
  `backend/lms/application/`** (pas `backend/application/`).
- `frontend/pages/**` + consumers cross-repo repérés à l'étape 1 — adaptation des
  call-sites (BIG BANG, pas d'alias de compat).
- `01-api-crud-list-conformance.plan.after.py` — sidecar assertions.

## Critères

- `npx tsc --noEmit` = 0 erreur.
- `python3 -m tpb_entropy --path . --format lint | grep ddd_endpoint_granularity`
  = 0 violation.
- Aucun ancien path supprimé ne subsiste (`/api/soms`, `/api/profile`, `/enroll`,
  `/abandon`, `/complete`, `/reset`, `shared-with-me`, `shared-by-me`,
  `translations/review`, `glossary/*/import`, `content/cloud/pitch`).
- Chaque handler commence par un préfixe Tier 1 blessé
  (`create|get|list|update|remove|delete|patch|upload|download|handle`) ou porte
  un ACK `entropy-ddd-endpoint-granularity-tier2:`.
- Smoke : chaque endpoint renommé répond correctement (déploiement + test UI via
  tpb-browser ou curl authentifié).

## Risques

- **Régression consumers** : des call-sites frontend/externes tapent encore les
  anciens paths. Mitigation : audit exhaustif (étape 1) AVANT tout rename ;
  adaptation de tous les call-sites dans la même passe.
- **Aliases supprimés utilisés en prod** (`/api/soms`, `/api/profile`) : vérifier
  0 trafic avant suppression. Si trafic → adapter le consumer, ne pas garder
  l'alias (BIG BANG).
- **Enrollment sans `id` propre** : si `lms_enrollment` est clé composite
  `(user_id, course_id)` sans PK `id`, `PATCH /api/enrollments/:enrollmentId`
  n'est pas adressable — fallback `PATCH /api/enrollments/:courseId` (déjà le
  pattern de `updateProgress`). À trancher en lisant le DDL.

## Vérification

```bash
cd Apps/the-play-button/tpb-lms
npx tsc --noEmit                                   # 0 erreurs
python3 -m tpb_entropy --path . --format lint | grep ddd_endpoint_granularity   # 0 violations
# smoke: déployer + tester chaque endpoint renommé via tpb-browser (UI) ou curl authentifié
```

## Sidecar assertions

`01-api-crud-list-conformance.plan.after.py` :
- assert aucun endpoint dans `index.js` ne matche les anciens paths supprimés
  (`/api/soms`, `/api/profile`, `/enroll`, `/abandon`, `/complete`, `/reset`,
  `shared-with-me`, `shared-by-me`, `translations/review`, `glossary/*/import`,
  `content/cloud/pitch`).
- assert chaque handler name commence par un préfixe Tier 1 blessé
  (`create|get|list|update|remove|delete|patch|upload|download|handle`) OU porte
  un ACK `entropy-ddd-endpoint-granularity-tier2:`.
