# Plan 03 — Pipeline upload (100% API) + POC sur 1 cours

## Contexte

Prérequis livrés : Plan 01 (adapter Loom + port vidéo) + Plan 02 (progressionMode /
contentMd / rawJson via API). La data extraite est structurée sur disque :
`Brain/…/Nick Saraev - Maker School/` :
- `_raw/course_trees.json` — 12 cours, arbre `course → set → module` (ids, titres,
  `videoLink` Loom/YouTube, `coverImage`).
- `classroom/<NN_course-slug>/<NN_section-slug>/<NN_lesson>.md` — bodies markdown
  (assets en chemins relatifs `../../assets/skool/…`), + README.md par cours/section.

POC ciblé : `01_pre-program-start-here` (3 sections, 19 leçons, mix Loom/YouTube).

## Objectif

Un script déterministe qui uploade **un cours** dans tpb-lms **100% via l'API**
(structure) + un **push GitHub** (texte + images), idempotent, et le rend visible
dans le viewer. Valider le bout-en-bout avant scale.

## Étapes

### 1. Cible d'hébergement contenu (GitHub)
- Repo content lisible par le PAT vault `tpb/infra/github_pat_tpb_repos` (celui que le
  content-proxy utilise). **Décision** : repo dédié `the-play-button/lms-content-makerschool`
  (à confirmer/creer). Push l'arbre `classroom/01_pre-program-start-here/` + les assets
  référencés, **en préservant le layout relatif** (pour que `resolveRelativeUrls` résolve
  les images contre l'URL raw du md).
- Vérif : `GET /api/content/github?url=raw.githubusercontent.com/.../<lesson>.md` → 200 + markdown.

### 2. Script d'upload
`scripts/skool-import/import_course.py` (Python stdlib + BastionClient) :
- Args : `--source "<path to course dir>"`, `--course-tree _raw/course_trees.json`,
  `--course-key <ab5cf4d1>`, `--github-base <raw url base>`, `--progression-mode free`,
  `--target dev`, `--dry-run`.
- Auth : `BastionClient` PAT avec `lms:course:write` + `lms:class:write` (fetch depuis
  vault `tpb/apps/lms/bastion_token` ou grant au PAT admin — cf. étape 6).
- Idempotence : ids déterministes dérivés des ids Skool (`course_<skoolid>`,
  `sec_<skoolid>`, `les_<skoolid>`), `INSERT OR IGNORE` côté API.
- Étapes internes :
  1. **push GitHub** : commit l'arbre du cours (MD + assets) via l'API GitHub (PAT vault),
     idempotent (upsert par path/sha).
  2. `POST /api/courses` : `{ id, name (course.title), description (course.desc),
     progressionMode:'free', mediaJson:[{type:'IMAGE', url: github raw coverImage}] }`.
  3. walk `course.children` :
     - `type:'set'` → `POST /api/classes { id, courseId, nodeKind:'SECTION', name,
       sysOrderIndex }`.
     - `type:'module'` → `POST /api/classes { id, courseId, parentClassId:<sec>,
       nodeKind:'LESSON', name, sysOrderIndex, mediaJson:[
         {type:'DOCUMENT', url:<github raw md>},
         {type:'VIDEO', url:<module.videoLink loom|youtube>} (si présent) ] }`.
     - (optionnel) `contentMd` inline pour les leçons courtes au lieu du DOCUMENT.
- Log : nb cours/sections/leçons créés/skippés + URLs.

### 3. Mapping module → fichier md
Joindre chaque `module` du tree à son `.md` disque (le layout numéroté `NN_slug`
aligne tree et disque ; matcher par slug/ordre dans la section). Résoudre l'URL raw
GitHub du md pour le media DOCUMENT.

### 4. Vidéos
- `videoLink` loom → media `{type:'VIDEO', url:'https://www.loom.com/share/<id>'}`
  (l'adapter Loom du Plan 01 le rend + track).
- `videoLink` youtube → media VIDEO url (déjà supporté).
- Pas de re-host (embed direct).

### 5. Loom privés résiduels
Avant push, tester chaque `videoLink` loom du cours (oEmbed 200 ?) → flag les rares
privés (fallback : lien-only dans le md, pas d'embed). Sur le POC (19 leçons) c'est trivial.

### 6. Auth / scopes
Vérifier/greneler le PAT utilisé avec `lms:course:write` + `lms:class:write`
(via `grant_pat_scopes` / bastion). Ne PAS rotater (§ SECRETS). Documenter le PAT utilisé.

### 7. Vérif live (§ PLAN FRONTEND DONE)
tpb-browser sur le cours importé :
- Classroom : la carte du cours apparaît (cover).
- Cours ouvert : arbre 3 sections + 19 leçons (nav libre = free, toutes cliquables).
- Une leçon Loom : la vidéo **joue** (embed) + tracking émet des pings.
- Une leçon YouTube : joue (inchangé).
- Le texte markdown rend (via DOCUMENT proxy GitHub) + images résolues.
- 0 erreur console, fresh + reload.

## Fichiers

- `scripts/skool-import/import_course.py` (nouveau)
- `scripts/skool-import/_github_push.py` + `_lms_api.py` (helpers) (nouveaux)
- `scripts/skool-import/README.md` (usage + mapping doctrine)

## Critères

- `01_pre-program-start-here` uploadé **100% API** (structure) + 1 push GitHub (contenu).
- Idempotent (re-run = 0 doublon).
- Live : cours + 3 sections + 19 leçons visibles, nav libre, texte+images rendus,
  vidéos Loom **et** YouTube qui jouent, tracking Loom actif.
- 0 erreur console.

## Risques

- **Repo GitHub content** : création/push d'un repo = action externe → confirmer le nom
  du repo avec l'utilisateur avant push (ou réutiliser un repo existant lisible par le PAT).
- **Chemins relatifs assets** : à valider live (le POC tranche si `resolveRelativeUrls`
  résout bien les `../../assets/…` contre l'URL raw GitHub).
- **Loom autoplay/tracking** : dépend du Plan 01 ; si un event manque, la leçon reste
  visible + jouable, seul le gate précis pâtit (moot en free-nav).
- **content_md vs DOCUMENT** : défaut = DOCUMENT (GitHub) pour le gros contenu ; l'inline
  `content_md` reste une option (Plan 02) si on veut zéro dépendance GitHub — à trancher
  au POC selon le rendu.
