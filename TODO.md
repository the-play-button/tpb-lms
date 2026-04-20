# project_id: PB04 — tpb-lms

## CRUD+List Endpoint Granularity (entropy: `ddd_endpoint_granularity`)

4 violations détectées. Plan détaillé : `plans/2026-03_crud-list-endpoint-refactor/01-rename-endpoints.plan.md`

- [ ] Rename `sharedByMe` → `listSharedByMe` (entité Share — lister les partages créés par moi) {priority:medium} {tags:entropy+ddd+crud-list}
- [ ] Rename `sharedWithMe` → `listSharedWithMe` (entité Share — lister les partages reçus) {priority:medium} {tags:entropy+ddd+crud-list}
- [ ] Rename `revokeShare` → `deleteShare` (entité Share — révoquer = supprimer) {priority:medium} {tags:entropy+ddd+crud-list}
- [ ] Rename `shareContent` → `createShare` (entité Share — partager = créer un partage) {priority:medium} {tags:entropy+ddd+crud-list}

## GRAPHS: JS Handler Routes — RDD Refactoring Required

40 JS handler routes under `backend/handlers/` are NOT pipelined. Before pipelining them, the LMS ERD (Entity-Relationship Diagram) needs clarification through a Requirements-Driven Design (RDD) pass. Many handlers may not need to exist as-is — some should be merged, some split, some removed.

### Route inventory by domain (40 total)

| Domain | Routes | Count |
|--------|--------|-------|
| Enrollment | listEnrollments, updateProgress, enrollInCourse, abandonCourse, completeCourse, getEnrollmentStatus | 6 |
| Courses | listCourses, getCourse | 2 |
| Events | handleEvent, handleBatchEvents | 2 |
| Signals | getStepSignals, getCourseSignalsHandler, resetCourseSignals | 3 |
| Quiz | handleTallyWebhook, handleQuizSubmission | 2 |
| KMS | listSpaces, getSpace, getPage | 3 |
| Translations | getTranslations, upsertTranslation, batchUpsertTranslations, getTranslationsForReview | 4 |
| Glossary | getGlossary, addGlossaryTerm, deleteGlossaryTerm, importGlossaryTerms | 4 |
| API Keys | createAPIKeyHandler, listAPIKeysHandler, revokeAPIKeyHandler, adminCreateAPIKeyHandler | 4 |
| Badges | listBadges | 1 |
| Learner | getLearnerProgress | 1 |
| Leaderboard | getLeaderboard, getUserStats | 2 |
| Admin | getAdminStats, adminCreateAPIKeyHandler | 2 |
| Content | getGitHubContent, listGitHubDirectory | 2 |
| Health | handleHealthCheck | 1 |
| Test | handleTestSeed | 1 |

### Action needed

- [ ] RDD pass: clarify LMS bounded contexts and entities {priority:high} {tags:ddd+lms+architecture}
- [ ] Identify which handlers map to which BCs (enrollment? content-delivery? assessment? administration?) {priority:high} {tags:ddd+lms+architecture}
- [ ] Simplify: merge redundant handlers, remove dead ones, rename to CRUD+List conventions {priority:medium} {tags:ddd+crud-list+lms}
- [ ] THEN pipeline each surviving handler into 9-step DDD {priority:medium} {tags:ddd+lms}

## Direction : standalone app avec sa propre D1

Actuellement le LMS est branché sur GitHub pour lire le contenu (markdown via GitHub raw + token depuis Vault). L'objectif est d'en faire une app standalone avec sa propre D1 comme source de données.

### Flux actuel (à migrer)

```
Brain/{org}/{project}/outputs/built/SOMs/
    ↓ (scripts PA06: upload_som.py + handler.py)
    ↓
1. PARSE SOM (som_parser.py)
   - Parse YAML frontmatter + markdown structure
   - Extrait : courses, steps, quizzes, media links
    ↓
2. TRANSCRIBE vidéos (video_captions/transcriber.py)
   - Hardware-aware : mlx-whisper (macOS Metal), faster-whisper (CUDA), CPU fallback
   - Output : texte brut + timestamps
    ↓
3. TRANSLATE contenu (content_translation/)
   - Markdown STEPS : content_translator.py
   - Quizzes YAML : quiz_translator.py
   - VTT captions : video_captions/translator.py
   - Backend : Ollama qwen2.5:7b (local, gratuit) ou OpenAI gpt-4o-mini (fallback)
   - 6 langues supportées : fr, en, de, it, ja, zh
    ↓
4. UPLOAD captions vers CF Stream (video_captions/uploader.py)
   - Multi-language VTTs associés aux vidéos
    ↓
5. DEPLOY course vers D1 (core/d1_client.py via wrangler)
   - Metadata courses + classes
   - i18n translations
   - Quiz forms (Tally integration via quiz_publisher.py)
    ↓
6. FRONTEND lit le markdown depuis GitHub raw
   - Token GitHub stocké dans Vault
   - Fallback language : en → source
```

### Flux cible

```
Brain/{org}/{project}/outputs/built/SOMs/
    ↓ (scripts de build — à migrer depuis PA06 vers tpb-lms/scripts/)
    ↓
1-4. Même pipeline (parse, transcribe, translate, upload captions)
    ↓
5. DEPLOY vers D1 **avec le contenu markdown inclus**
   - Plus besoin de GitHub raw : le markdown est dans D1 directement
   - Le build insère le contenu rendu dans la base
   - Chaque langue a son propre contenu en D1
    ↓
6. FRONTEND lit TOUT depuis D1
   - Plus de dépendance GitHub
   - Plus de token GitHub dans Vault
   - Requête D1 = source unique
   - i18n : query par lang + fallback en D1
```

### Scripts PA06 à migrer vers tpb-lms

Actuellement dans `Brain/the-play-button/PA06 KMS Setup/outputs/run/automations/scripts/` :

| Script PA06 | Destination tpb-lms | Rôle |
|---|---|---|
| `upload_som.py` | `scripts/upload_som.py` | CLI entry point |
| `handler.py` | `scripts/handler.py` | Orchestrateur lifecycle |
| `som_parser.py` | `scripts/som_parser.py` | Parse YAML+markdown |
| `video_captions/transcriber.py` | `scripts/video_captions/transcriber.py` | Whisper (mlx/CUDA/CPU) |
| `video_captions/downloader.py` | `scripts/video_captions/downloader.py` | Download MP4 |
| `video_captions/translator.py` | `scripts/video_captions/translator.py` | Translate VTT |
| `video_captions/uploader.py` | `scripts/video_captions/uploader.py` | Upload VTT to CF Stream |
| `content_translation/content_translator.py` | `scripts/content_translation/content_translator.py` | Translate markdown |
| `content_translation/quiz_translator.py` | `scripts/content_translation/quiz_translator.py` | Translate quizzes |
| `content_translation/quiz_publisher.py` | `scripts/content_translation/quiz_publisher.py` | Publish Tally forms |
| `content_translation/i18n_generator.py` | `scripts/content_translation/i18n_generator.py` | Generate i18n JSON |
| `core/config.py` | `scripts/core/config.py` | Config loader |
| `core/state.py` | `scripts/core/state.py` | Idempotent state tracking |
| `core/d1_client.py` | `scripts/core/d1_client.py` | D1 database wrapper |
| `core/cloudflare_stream.py` | `scripts/core/cloudflare_stream.py` | CF Stream API |
| `core/translation_backend.py` | `scripts/core/translation_backend.py` | Ollama/OpenAI backend |
| `core/retry.py` | `scripts/core/retry.py` | Retry decorator |
| `core/validators.py` | `scripts/core/validators.py` | Prerequisite validation |
| `core/errors.py` | `scripts/core/errors.py` | Custom exceptions |
| `core/logger.py` | `scripts/core/logger.py` | Session logger |
| `lms/sync_tally_quiz.py` | `scripts/lms/sync_tally_quiz.py` | Tally quiz sync |
| `lms/tally_webhook.py` | `scripts/lms/tally_webhook.py` | Tally webhook handler |

### Refactos nécessaires

- [ ] Migrer les scripts PA06 vers `tpb-lms/scripts/` {priority:medium} {tags:lms+migration}
- [ ] Modifier le build pour insérer le markdown directement dans D1 (plus de GitHub raw) {priority:medium} {tags:lms+d1+migration}
- [ ] Supprimer la dépendance au token GitHub dans le frontend {priority:medium} {tags:lms+security+migration}
- [ ] Le frontend fetch D1 directement (via Worker binding) au lieu de GitHub {priority:medium} {tags:lms+d1+ui}
- [ ] Supporter le multi-org (aujourd'hui hardcodé sur TPB SOMs) {priority:medium} {tags:lms+multi-org}
- [ ] Les directives LMS (`PA06/automations/directives/lms/`) → absorber dans un SKILL.md tpb-cock si pertinent {priority:medium} {tags:lms+sss}

### Hardware-aware transcription (à conserver)

Le pipeline de transcription supporte 3 backends :
- **macOS M1/M2/M3** : `mlx-whisper` (Metal GPU, 5x realtime)
- **Linux/Windows NVIDIA** : `faster-whisper` + CUDA (5x realtime)
- **CPU fallback** : `faster-whisper` CPU (0.3x realtime — lent)

Détection automatique dans `transcriber.py`. Ne pas casser cette logique.

### Translation backend (à conserver)

Priorité : Ollama local (gratuit) → OpenAI API (fallback payant).
- Ollama : `qwen2.5:7b` via subprocess
- OpenAI : `gpt-4o-mini` via API

Ne pas forcer un seul backend. La détection auto est la bonne approche.
