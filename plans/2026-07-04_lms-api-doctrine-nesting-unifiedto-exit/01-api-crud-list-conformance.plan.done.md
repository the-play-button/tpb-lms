## Ce qui a été fait

Conformité CRUD/list **complète** (aucun defer — directive user « au bout du bout »),
backend **ET** frontend `lms-viewer` (`frontend-on-cf-worker/`) mis à jour ensemble.

### Backend
- **Aliases supprimés** : `/api/soms`, `/api/soms/:id`, `/api/profile`.
- **Sharing renommé** (application/) : `shareContent→createShare`,
  `revokeShare→deleteShare`, `sharedByMe→listSharedByMe`,
  `sharedWithMe→listSharedWithMe`.
- **Enrollment CRUD** : `enroll/abandon/complete` → `POST /api/enrollments`
  (`createEnrollment`) + `PATCH /api/enrollments/:courseId` (`updateEnrollment`
  `{status}`) + `GET /api/enrollments/:courseId`. Logique gamification préservée
  (wrappers minces sur `EnrollmentService`).
- **Events bulk** : `POST /api/events` accepte single OU `{events:[]}`
  (`createEvents`) ; route `/events/batch` supprimée.
- **Quiz** : `POST /api/quiz` → `POST /api/quiz-submissions` (`createQuizSubmission`).
- **Translations** : `/review` + `/batch` collapsés → `GET /api/translations`
  (`getTranslationsForReview`, `?status=review`) + `PUT /api/translations`
  (`upsertTranslations` bulk).
- **Glossary bulk** : `POST /api/glossary/:locale` accepte single OU `{terms:[]}` ;
  route `/import` supprimée.
- **Filtered-read dispatchers** : `GET /api/content/cloud?usage=pitch` +
  `GET /api/connections?default=true` (sous-URLs `/pitch` + `/default` supprimées).
- **Handler verb-renames** : `revokeAPIKey→deleteAPIKey`,
  `addGlossaryTerm→createGlossaryTerm`, `resetCourseSignals→deleteCourseSignals`
  (`POST /reset` → `DELETE /api/signals/:courseId`).
- rateLimit keys + docstrings alignés.

### Frontend (lms-viewer)
- `api.js` : ajout `apiPatch`.
- `overview.js` : enroll → `apiPost('/enrollments', {courseId})`, abandon →
  `apiPatch('/enrollments/:id', {status:'abandoned'})`, enrollment GET path.
- `navigation.js` + `debug/panel.js` : signals reset → `apiDelete('/signals/:id')`
  (**corrige une régression** que mon 1er passage Plan 01 avait introduite).
- `quiz/handler.js` : `/quiz` → `/quiz-submissions`.
- `content/loader/_shared.js` : `cloud/pitch` → `cloud?usage=pitch`.

### Nesting UI
- `stepsSidebar.js` rend l'arbre `course.nodes[]` (SECTION folders + LESSON leaves,
  indenté par profondeur, multi-niveau) ; `data-step` mappé sur l'index flat de
  `course.classes` (compatible navigation). Fallback flat préservé.

## Fichiers modifiés

| Zone | Fichiers |
|---|---|
| Backend routes/handlers | `backend/index.js`, `handlers/enrollment/{createEnrollment,updateEnrollment,index}.js` (+ 3 supprimés), `handlers/events.js`, `handlers/quiz/{createQuizSubmission,index}.js`, `handlers/translations/{upsertTranslations,index}.js`, `handlers/glossary/{createGlossaryTerm,index}.js` (+ import supprimé), `handlers/signals.js`, `handlers/apikeys/{deleteAPIKeyHandler,index}.js`, `middleware/rateLimit.js`, `lms/application/sharing/**` (renames) |
| Frontend viewer | `app/api.js`, `app/course/{overview,navigation}.js`, `app/debug/panel.js`, `app/quiz/handler.js`, `app/content/loader/_shared.js`, `app/ui/stepsSidebar.js` (+ tree test) |
| Sidecar | `01-...plan.after.py` (étendu) |

## Résultat de validation

- ✅ `npx tsc --noEmit` : **0 erreur**.
- ✅ **27/27 vitest** (sharing 4, tree 4, authoring 8, videoHosting 1, youtube 6,
  sidebar-tree 4).
- ✅ Sidecar `01-...plan.after.py` (scope complet) : **all pass**.
- ✅ **0 identifiant/route obsolète** résiduel (grep clean, hors docs/plans).
- ✅ node --check sur tous les JS backend + frontend modifiés.

## Note

**Preuve live tpb-browser** = requiert un déploiement de `lms-viewer`
(`cd frontend-on-cf-worker && npx wrangler deploy`) + `lms-api` (`npm run deploy`)
— ops prod déclenchées par l'utilisateur. Le code + 27 tests valident la conformité
et le wiring FE↔BE.
