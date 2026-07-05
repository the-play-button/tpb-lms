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
- **03 — Pipeline upload + POC 1 cours** (DONE) : walk `course_trees.json` → POST
  structure via API (media Loom/YouTube embed direct) sur `01_pre-program-start-here`
  (15 leçons), 100% API, vérif live. **Décision d'exécution : self-contained, zéro push
  externe** — texte = `content_md` inline (rendu ajouté au viewer), vidéos = embeds
  Loom/YouTube directs, cover + images de corps = **URLs Skool CDN publiques**
  (vérifiées HTTP 200 sans auth). Le push GitHub initialement prévu est **abandonné**
  (pas juste reporté) : rien n'est ré-hébergé, tout est référencé par URL publique.
- **04 — Scale aux 11 cours** (Life Optimization = WIP vide, skippé), umbrella décomposé
  en **4 sessions A/B/C/D = plans 05→08** (une par session) :
  - **05 (session A) — Durcissement importer + assets self-contained** (images → Skool CDN
    via `asset_url_to_local.json` reverse-map, path YouTube, mapping tree↔disk robuste,
    throttle/retry/reporting, `import_all.py`, dry-run des 11, re-import POC vérifié).
  - **06 (session B) — Upload cohorte 1** (Resource Library, Automation Tutorials, Month 1,
    Month 2) + vérif live échantillon.
  - **07 (session C) — Upload cohorte 2** (Month 3-6, Building Wealth, Building a Brand)
    + vérif live.
  - **08 (session D) — Sweep vidéos privées (413 Loom + 100 YT) + bilan + idempotence +
    vérif 11 cartes Classroom + rapport `_evidence/`.**

## Séquencement

01 → 02 → 03 (DONE), puis **UAT utilisateur du POC** (fait), puis 04 (umbrella) décomposé
en 05 → 06 → 07 → 08, **une session par plan**. 01 et 02 sont indépendants ; 03 les
consomme ; 05 durcit le code, 06/07 uploadent, 08 finalise.

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
