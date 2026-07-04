## Ce qui a été fait

**Distinction cardinale respectée** : l'exit *runtime* Unified.to était déjà fait
(`TpbStorageHttpAdapter` Worker-to-Worker vers tpb-storage). Reste 100% du
couplage *sémantique* dans des **commentaires** (zéro appel runtime confirmé).
On garde l'**alignement de nommage** unified.to (référence CRUD blessée par la
doctrine) et on retire uniquement les mentions qui impliquaient une **dépendance
de service live**.

- **Découplage sémantique** (commentaires reformulés) :
  - `005_byoc_cloud_content.sql` : `connection_id -- Unified.to connection ID` →
    `storage connection ID (native OAuth resolved by tpb-storage, not unified.to)` ;
    header "via Unified.to + BASTION" → "via native storage connections (tpb-storage)".
  - `services/types/ConnectionInfo.ts` : "Maps to a Unified.to storage connection"
    → "native bastion storage connection (resolved by tpb-storage)".
  - `services/types/StorageFile.ts` : "Normalized from Unified.to storage file
    response" → "from the tpb-storage file response".
  - `db/schema.sql` header : "Unified.to Aligned" → "CRUD-shaped (field naming
    aligned on the unified.to canonical CRUD model — REFERENCE ONLY, no runtime
    dependency)".
- **BYOC préservé** : `lms_content_ref` + le modèle "contenu dans le cloud de
  l'auteur via connexion native" restent valides — juste dé-unified-to-ifiés.
- **Capacité vidéo YouTube** : `media_json` type VIDEO accepte n'importe quelle URL
  (dont une chaîne YouTube privée), retournée verbatim par le backend
  (`enrichMedia` ne réécrit pas l'url). C'est ce qui permet d'héberger les 400 MP4
  Loom sur YouTube privé (zéro R2, zéro coût storage). Verrouillé par
  `videoHosting.test.js`.
  - **CORRECTION (post-review user 2026-07-04)** : mon affirmation initiale « le
    frontend tpb-lms est vide » était **FAUSSE**. `frontend/` est vide, mais
    `frontend-on-cf-worker/` est le vrai frontend déployé (worker `lms-viewer`,
    https://lms-viewer.matthieu-marielouise.workers.dev/). Son renderer vidéo ne
    gérait que Cloudflare Stream + MP4 natif — une URL YouTube tombait dans
    `<video src>` (cassé). **Corrigé** : support YouTube end-to-end
    (embed `/embed/` + tracking via YouTube IFrame API). Commit `8a6b095` :
    `parseMediaUrl` (source youtube), `_mediaHelpers.extractYoutubeId` +
    `getVideoInfo.youtubeId`, `stepContext`/`renderer` (videoYoutubeId),
    `videoSection` (iframe /embed/), `youtubeTracking.js` (VIDEO_PLAY/PAUSE/PING),
    `videoYoutube.test.js` (6/6). Le pipeline data (Loom → YouTube privé →
    media_json url) rendra donc bien la vidéo dans le viewer.
    **Preuve live tpb-browser** = requiert un déploiement de `lms-viewer` (op prod,
    déclenchée par l'utilisateur) + un cours avec vidéo YouTube.

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `db/migrations/005_byoc_cloud_content.sql` | connection_id + header dé-unified-to-ifiés |
| `db/schema.sql` | header "reference only, no runtime dependency" |
| `backend/services/types/ConnectionInfo.ts` | commentaire native tpb-storage |
| `backend/services/types/StorageFile.ts` | commentaire tpb-storage |
| `backend/services/courses/videoHosting.test.js` | **créé** — YouTube passthrough |
| `04-...plan.after.py` | **créé** — sidecar |

## Résultat de validation

- ✅ **Zéro appel runtime unified.to** (grep `fetch|https?://.*unified` sur backend = 0).
- ✅ `npx tsc --noEmit` : **0 erreur**.
- ✅ Vitest `videoHosting.test.js` : **1/1** (url YouTube VIDEO retournée verbatim).
- ✅ Sidecar `04-...plan.after.py` : **all pass**.
- ✅ BYOC préservé (`lms_content_ref` intact).

## Note / suivi

- Le **run data** (upload des 400 MP4 → chaîne YouTube privée → population
  `media_json` via `PATCH /api/classes/:id`) reste hors périmètre code (confirmé
  hors-scope par l'utilisateur 2026-07-04). La capacité côté LMS est en place.
- Les labels de shape (`-- UNIFIED.TO: CRM/KMS/LMS/HRIS` dans schema.sql,
  "Unified.to aligned/extension" dans index.js/getOrCreateContact/badges) sont
  **conservés volontairement** : ils documentent l'alignement de forme (doctrine
  crud_list qui cite unified.to comme la référence canonique), pas une dépendance.
