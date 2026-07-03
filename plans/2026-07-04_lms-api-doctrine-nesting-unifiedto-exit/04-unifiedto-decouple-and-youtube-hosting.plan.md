# Plan 04 — Découplage Unified.to (sémantique) + hébergement vidéo YouTube privé

> Dernier plan. Touche le modèle de contenu (stabilisé par 02/03) + l'hébergement
> vidéo.

## Contexte

L'utilisateur veut arrêter de payer Unified.to ("ça ne nous apporte rien"). L'exit
*runtime* est déjà fait (`plans/2026-05-26_exit-unifiedto-runtime-final/`,
`TpbStorageHttpAdapter` Worker-to-Worker vers tpb-storage qui résout les tokens
nativement). Reste un couplage *sémantique* dans le modèle de contenu (4 fichiers)
+ le besoin d'héberger 400 MP4 Loom (13 GB) sans R2 (interdit) : via YouTube privé.

## Distinction cardinale à ne PAS confondre

1. **Unified.to comme SERVICE PAYANT** (runtime, connexions, OAuth) → à supprimer.
   L'exit runtime est **déjà fait** (`plans/2026-05-26_exit-unifiedto-runtime-final/`) :
   `TpbStorageHttpAdapter` forward Worker-to-Worker vers `tpb-storage`, qui résout
   les tokens OAuth **nativement** (pas d'appel unified.to). Il reste du couplage
   *sémantique* dans le modèle de contenu.

2. **Unified.to comme RÉFÉRENCE DE NOMMAGE ERD** (`lms_course`, `lms_class`,
   `media_json`, `sys_order_index`) → **à GARDER**. La doctrine
   `crud_list_only_endpoint_design_tier1.md` cite explicitement unified.to comme
   la preuve que CRUD+list suffit (115 domaines, 572 ops). Aligner nos noms de
   champs sur cette forme est de la bonne hygiène CRUD, **pas** une dépendance
   payante. Garder l'alignement de forme ; supprimer la dépendance de service.

## Étapes

1. **Découplage sémantique** (A) : nettoyer les commentaires/vocabulaire
   unified.to des 4 fichiers, recommenter `connection_id` (connexion native),
   reformuler le header `schema.sql`.
2. **Vérif zéro appel runtime** (C) : `grep -rn "unified"` → uniquement des
   mentions de nommage/référence.
3. **Capacité vidéo YouTube** (B) : confirmer que `media_json` type VIDEO accepte
   une URL YouTube et que frontend + viewer local l'embed (test renderer).
4. **Follow-up run data** (hors code) : documenter le pipeline d'upload 400 MP4 →
   chaîne YouTube privée → population `media_json` via `PATCH /api/classes/:id`.

## A — Découplage sémantique du modèle de contenu

Fichiers touchés (footprint unified.to = 4 fichiers) :

| Fichier | Action |
|---|---|
| `backend/types/Env.ts` | Déjà migré (`TPB_STORAGE_URL`). Nettoyer commentaires résiduels "unified.to". |
| `backend/services/storage/createStorageService.ts` | Vérifier qu'aucun chemin ne construit un client unified.to ; retirer si présent. |
| `backend/services/storage/adapters/TpbStorageHttpAdapter.ts` | OK (Worker-to-Worker). Renommer le commentaire `connection's OAuth token` pour clarifier "native storage connection, pas unified.to". |
| `db/schema.sql` + `db/migrations/005_byoc_cloud_content.sql` | `lms_content_ref.connection_id` commenté "Unified.to connection ID" → recommenter "storage connection ID (native OAuth resolved by tpb-storage)". La colonne reste (référence une `core_connection` bastion générique, plus une connexion unified.to). |

> **Le modèle BYOC lui-même reste valide** : un auteur PEUT héberger son contenu
> dans son propre cloud (Drive/Dropbox) via une `core_connection` bastion résolue
> par tpb-storage. Ce qui change : ce n'est plus "une connexion unified.to", c'est
> une connexion native. Le mot "unified" disparaît du vocabulaire ; le pattern BYOC
> survit.

Header `schema.sql` : `-- TPB LMS D1 Schema - Unified.to Aligned` →
`-- TPB LMS D1 Schema - CRUD-shaped (field naming aligned on the unified.to
canonical CRUD model — reference only, no runtime dependency)`.

## B — Hébergement vidéo via YouTube privé

Besoin : héberger les 400 MP4 Loom (13 GB) sans R2 (interdit), sans coût storage.
Solution retenue et confirmée viable : **upload sur une chaîne YouTube privée**,
puis référencer l'URL YouTube dans `media_json`.

- `media_json` supporte déjà `{ "url":"...", "type":"VIDEO", "name":"..." }`. Pour
  une leçon vidéo : `url` = URL YouTube (watch ou embed). Le frontend + le viewer
  local rendent déjà l'embed YouTube (`serve.py::_yt_id` → iframe).
- **Zéro R2, zéro tpb-storage pour la vidéo** : YouTube héberge, contrôle d'accès
  "non répertorié/privé", bande passante gratuite.
- Pas de changement de schema : c'est juste la valeur de `media_json[].url` qui
  devient une URL YouTube au lieu d'un embed Loom.

### Mapping MP4 → YouTube (run data, hors code)

Ce plan pose la **capacité** (le modèle accepte des URLs YouTube en VIDEO). Le run
d'upload effectif (400 MP4 → chaîne YouTube privée → collecte des video-ids →
population `media_json`) est un run *data* qui consommera le write-API du plan 02
(`PATCH /api/classes/:id` pour poser `media_json`). Documenté ici comme
follow-up, exécuté séparément (hors initiative code).

> Note : le upload YouTube en masse peut se faire via l'UI YouTube Studio
> (glisser-déposer + "non répertorié") ou l'API YouTube Data v3 (quota 6 uploads/j
> par défaut sans hausse de quota — pour 400 vidéos, préférer l'upload UI batch ou
> demander une hausse de quota). À trancher au moment du run data.

## C — Vérification qu'aucun appel unified.to ne subsiste

```bash
cd Apps/the-play-button/tpb-lms
grep -rn "unified.to\|api.unified\|unifiedto\|UnifiedTo\|unified-" backend/ db/ | grep -v node_modules
# attendu après ce plan : uniquement des mentions "reference/naming", zéro appel runtime
npx tsc --noEmit
```

## Fichiers

- `backend/types/Env.ts` — nettoyer commentaires "unified.to" résiduels.
- `backend/services/storage/createStorageService.ts` — retirer tout chemin client
  unified.to s'il subsiste.
- `backend/services/storage/adapters/TpbStorageHttpAdapter.ts` — reformuler
  commentaire "connection's OAuth token" (native, pas unified.to).
- `db/schema.sql` + `db/migrations/005_byoc_cloud_content.sql` — recommenter
  `lms_content_ref.connection_id` (storage connection native) ; header schema.
- `04-unifiedto-decouple-and-youtube-hosting.plan.after.py` — sidecar assertions.

## Critères

- `grep -rn "unified" backend/ db/` ne retourne aucun **appel runtime** (seulement
  commentaires de nommage/référence).
- `npx tsc --noEmit` = 0 erreur.
- `media_json` type VIDEO avec URL `youtube.com`/`youtu.be` rendu en embed par le
  frontend (test unitaire du renderer).
- Le pattern BYOC (connexion native tpb-storage) fonctionne toujours pour un auteur
  qui héberge dans son cloud.
- Header `schema.sql` clarifie "reference only, no runtime dependency".

## Risques

- **Confondre nommage ERD et dépendance payante** : garder l'alignement de forme
  unified.to (doctrine-blessé) ; ne supprimer QUE la dépendance de service. Ne pas
  renommer `lms_course`/`lms_class`/`media_json` (ce serait une régression inutile).
- **Casser BYOC** : le modèle BYOC (contenu dans le cloud de l'auteur) reste
  valide via connexion native — ne pas le supprimer, juste le dé-unified-to-ifier.
- **Quota YouTube API** : upload API v3 = 6 vidéos/jour par défaut. Pour 400 vidéos
  → upload UI batch YouTube Studio ou demande de hausse de quota. C'est un run
  *data* hors de ce plan code ; documenté comme follow-up.

## Vérification

- Aucun `fetch`/client pointant vers un domaine unified.to.
- `media_json` type VIDEO accepte une URL YouTube et le viewer/frontend l'embed.
- Le pattern BYOC (connexion native tpb-storage) fonctionne toujours pour les
  auteurs qui veulent héberger dans leur cloud.

## Sidecar assertions

`04-unifiedto-decouple-and-youtube-hosting.plan.after.py` :
- assert `grep -rn "unified" backend/` ne retourne aucun appel runtime (seulement
  commentaires de nommage/référence).
- assert le header `schema.sql` ne dit plus "Unified.to Aligned" seul mais clarifie
  "reference only, no runtime dependency".
- assert `media_json` VIDEO avec une URL `youtube.com`/`youtu.be` est rendu en embed
  par le frontend (test unitaire du renderer).
