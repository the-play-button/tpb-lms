# Initiative — LMS API doctrine review + nested sections + Unified.to exit

> **Date** : 2026-07-04
> **Repo** : `Apps/the-play-button/tpb-lms`
> **Owner** : Matthieu MARIE-LOUISE
> **Statut** : SCAFFOLDED — en attente de validation utilisateur avant exécution.

## Contexte

Le LMS a été construit il y a plusieurs mois, avant que les doctrines API TPB
soient stabilisées. L'utilisateur demande de **REVOIR** (pas juste étendre) sa
surface API pour qu'elle respecte :

- `pipelined-ddd/api-only-mindset_tier1.md` — API-only, jamais de DOM ; webhooks
  P2P HMAC ; pas de broker custom.
- `pipelined-ddd/crud_list_only_endpoint_design_tier1.md` — Tier 1 CRUD+List par
  défaut, Tier 2 domain-command explicite et acknowledgé, jamais de CRUD déguisé,
  de batch-as-endpoint, ni d'alias d'URL.

Trois autres besoins convergent dans la même initiative :

1. **Sections imbriquées** — le LMS ne fait que 2 niveaux (`lms_course` →
   `lms_class`) + un soft-label `raw_json.tpb_section`. Impossible de reproduire
   l'arbre de la classroom Skool de Nick Saraev (Course → "Month 1" → "Week 1" →
   leçons). Notre PROPRE schema fait pourtant déjà de l'adjacency-list nesting
   ailleurs (`kms_space.parent_space_id`, `kms_page.parent_page_id`,
   `hris_group.parent_id`).
2. **Exit Unified.to** — l'exit *runtime* est déjà fait
   (`plans/2026-05-26_exit-unifiedto-runtime-final/`, storage Worker-to-Worker via
   `TpbStorageHttpAdapter`). Reste un couplage *sémantique* : le modèle BYOC
   (`lms_content_ref.connection_id`, `/api/connections`) suppose encore une
   connexion Unified.to pour héberger le contenu.
3. **Pousser la classroom** — la validation upstream a révélé qu'il n'existe
   **aucun endpoint create/update/delete** sur `lms_course` / `lms_class`. Une API
   "CRUD" sans C/U/D n'est pas CRUD ; et sans write-API on ne peut littéralement
   pas ingérer les 12 cours / 714 modules scrappés.

## Constats préalables (vérifiés en amont)

- **Surface API actuelle** = 36 endpoints répartis en `publicRoutes`,
  `standardRoutes`, `authKeyRoutes`, `byocRoutes`, `events` (inline dans
  `backend/index.js`).
- **Architecture mixte** : legacy handlers plats (`backend/handlers/*.js`, non
  pipelinés DDD) + pipeline DDD 9-step récente (`backend/lms/application/*` — mais
  seulement pour `cloudContent` (BYOC) + `connections` + `sharing`).
- **Pas de `backend/application/`** au niveau racine ; le DDD vit sous
  `backend/lms/application/`. Le plan stub `2026-03_crud-list-endpoint-refactor`
  cite `backend/application/sharing/` — **chemin périmé**, non exécuté (aucun
  `.done.md`). Cette initiative le **supersède**.
- **Zéro write-API** confirmé : `grep -cE "POST.*'/api/courses'|PATCH..."` = 0.
- **Nesting adjacency-list déjà blessé** dans `db/schema.sql` : `kms_space`,
  `kms_page`, `hris_group`. Jamais appliqué à `lms_class`.
- **Unified.to footprint** = 4 fichiers (`types/Env.ts`,
  `services/storage/createStorageService.ts`,
  `services/storage/adapters/TpbStorageHttpAdapter.ts`, `db/schema.sql`) — runtime
  déjà découplé, reste le modèle de contenu.
- **Vidéos Loom** : 400 MP4 (13 GB) sur CORSAIR / 413 leçons, viewer lit local
  disk (`serve.py:300`), pas les URLs Loom. YouTube privé = voie d'hébergement
  retenue.

## Plans

| # | Plan | Scope |
|---|------|-------|
| 01 | `api-crud-list-conformance` | Revue complète des 36 endpoints vs doctrine. Renames CRUD, suppression aliases, dé-batchification, filtered-lists via query params. Supersède le stub 2026-03. |
| 02 | `content-authoring-crud-api` | Ajout du write-layer manquant : `POST/PATCH/DELETE /api/courses` + `/api/classes` (pipeline DDD 9-step). Débloque l'ingestion de la classroom + rend l'API réellement CRUD. |
| 03 | `nested-sections-erd-adjacency-list` | Extension ERD : `lms_class.parent_class_id` (self-FK) + `node_kind` (`SECTION`\|`LESSON`). Migration `006`, backfill `tpb_section` → nœuds SECTION, GET course renvoie l'arbre. |
| 04 | `unifiedto-decouple-and-youtube-hosting` | Découplage sémantique BYOC/Unified.to du modèle de contenu + hébergement vidéo via YouTube privé (`media_json` type VIDEO → url youtube). |

## Ordre d'exécution

`03` (ERD nesting) → `02` (write-API, consomme le nesting) → `01` (rename
doctrine, s'applique à toute la surface y compris les nouveaux endpoints de 02)
→ `04` (découplage unified.to + vidéo). Rationale : poser le modèle de données
avant le write-API ; renommer une fois que tous les endpoints existent (évite de
renommer deux fois) ; le découplage unified.to touche le modèle de contenu qui
aura été stabilisé.

## Hors-scope

- Migration des noms de pipeline deprecated (`Assert` → `ValidateInput`) —
  chantier orthogonal, mentionné dans `TODO.md` mais non couvert ici.
- Ré-ingestion effective de la classroom Nick Saraev — c'est un run *data* qui
  consommera le write-API de 02 ; hors de cette initiative *code*.
- Frontend `frontend/pages` — sera adapté au fil des plans si un endpoint
  consommé change, mais pas de refonte UI.

## Doctrines de référence

- `crud_list_only_endpoint_design_tier1.md` (arbre de décision Q0–Q5).
- `api-only-mindset_tier1.md`.
- Précédent nesting maison : `db/schema.sql` (kms_space / kms_page / hris_group).
- BIG BANG / zéro backward-compat (CLAUDE.md) — renames en place, pas d'alias de
  compat, suppression du code mort.
