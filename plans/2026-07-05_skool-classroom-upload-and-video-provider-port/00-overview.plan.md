# Initiative — Skool classroom → tpb-lms (upload 100% API) + port vidéo hexa

## Contexte

Nick Saraev « Maker School » a **déjà été extrait** (skill `skool-scraping`) :
`Brain/the-play-button/pa02-roadmap-creation/inputs/resources/Nick Saraev - Maker School/`.
- `_raw/course_trees.json` : **12 cours**, arbre 3 niveaux **course → set → module** (= course → SECTION → LESSON).
- **~900 leçons markdown** (assets en chemins relatifs), `asset_url_to_local.json`.
- **413 vidéos Loom** (share links) + **100 YouTube** (513 total).
- Un viewer mockup (localhost:8777) prouve la data complète.

**Décisions actées avec l'utilisateur** :
1. **Pas de ré-hébergement vidéo**. Vérifié empiriquement : les 413 Loom share links
   sont **publics sans auth** (oEmbed 200 + embed 200, testé 25/25). On les **embarque
   directement** depuis Loom (comme YouTube). Zéro upload, zéro coût CF Stream, zéro
   re-upload copyright.
2. **Tracking Loom dès maintenant**. Vérifié : l'embed Loom parle le protocole
   **`player.js`** (event `ready` liste `ready/play/pause/ended/timeupdate`). Donc
   progression trackable via handshake postMessage `player.js` (pas de SDK exotique,
   pas de dépendance npm).
3. **Archi hexa** : un port `VideoProvider` abstrait YouTube / Loom / Cloudflare Stream
   / mp4 natif. Aujourd'hui la logique est éparpillée (`parseMediaUrl` détecte la source,
   `videoSection` if/else par provider, `youtubeTracking` isolé). Le port **réduit** la
   dette + rend le gating futur trivial (l'adapter Loom émet déjà la complétion → même
   pipeline signals). player.js couvre aussi Vimeo/Wistia gratuitement.

**Prérequis API déjà en place** : authoring CRUD (`POST /api/courses`, `POST /api/classes`
+ PATCH/DELETE, scopes `lms:course:write` / `lms:class:write`), nesting SECTION/LESSON,
content-proxy GitHub authentifié, `progression_mode` (Plan 09 précédente initiative).

## Plans

- **01 — Port `VideoProvider` hexa (frontend)** : interface + registry + migration
  YouTube/CF-Stream/mp4 en adapters (mécanique, zéro régression) + **adapter Loom avec
  tracking player.js**.
- **02 — Gaps config authoring API (backend)** : `rawJson`/`progressionMode`/`contentMd`
  settables sur create/update courses+classes (pour du 100% API : nav `free`, intro,
  texte inline optionnel).
- **03 — Pipeline upload + POC 1 cours** : push GitHub de l'arbre `classroom/`
  (texte+images) + walk `course_trees.json` → POST structure via API (media Loom/YouTube
  embed direct) sur `01_pre-program-start-here` (19 leçons), 100% API, vérif live.
- **04 — Scale aux 12 cours** (après UAT utilisateur du POC).

## Séquencement

01 → 02 → 03, puis **STOP pour UAT utilisateur** du POC avant 04.
01 et 02 sont indépendants et testables isolément ; 03 les consomme.

## Critères d'initiative

- Port vidéo hexa en place, YouTube inchangé, Loom joue + track + complète à 90%.
- API authoring peut set nav `free` + intro + (optionnel) texte inline.
- POC : `01_pre-program-start-here` uploadé 100% API, rendu live dans tpb-lms
  (structure + texte + images + vidéos Loom/YouTube embed), 0 erreur console.
- Zéro dette : gating Maker School futur = flip d'un flag (progression_mode), pas de refacto.

## Risques

- **player.js Loom** : handshake postMessage non-officiellement documenté par Loom mais
  vérifié live (protocole `player.js` standard). Fallback si un event manque : pings via
  `timeupdate` seul suffisent (la complétion est calculée backend depuis la coverage).
- **Loom share privé résiduel** : 25/25 testés publics, mais valider sur les 413 au
  moment du POC/scale (flag les rares privés → fallback lien-only sans embed).
- **Assets relatifs GitHub** : les MD ont des chemins relatifs (skill `relocalize`) →
  résolus par `resolveRelativeUrls` contre l'URL raw GitHub si l'arbre est poussé en
  préservant le layout. À vérifier au POC.
- **Volume** : ~912 POST au scale → throttle/batch + idempotence `INSERT OR IGNORE`.
