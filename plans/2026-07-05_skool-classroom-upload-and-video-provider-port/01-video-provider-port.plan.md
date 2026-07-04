# Plan 01 — Port `VideoProvider` hexa (frontend) + adapter Loom avec tracking

## Contexte

La logique vidéo est éparpillée sur 4 mécanismes de progression différents, sans
abstraction :
- `content/loader/parseMediaUrl.js` : détecte la source (youtube/cloudflare/…).
- `course/renderer.functions/videoSection.js` : if/else par provider pour le markup
  (branche YouTube, branche CF Stream iframe, branche `<video>` mp4).
- `video/tracking/setupVideoTracking.js` : dispatch par dataset (native / youtubeId /
  Stream SDK) ; `youtubeTracking.js` isolé.
- L'emit vers le backend est **déjà provider-agnostic** (`_shared.js` :
  `sendVideoPing(currentTime, duration, …)` + `sendVideoEvent(type, …)`), et la
  **complétion (90%) est calculée BACKEND** depuis la coverage des pings. Donc un
  adapter n'a qu'à traduire ses events natifs → ces 2 fonctions partagées.

On introduit un port `VideoProvider` : chaque provider = un adapter (match + render +
tracking). `videoSection` et `setupVideoTracking` deviennent des **dispatchers thin**.
On **ajoute Loom** (embed + tracking `player.js`) sans dette.

## Objectif

Port hexa `VideoProvider` avec 4 adapters (youtube, loom, cloudflare, mp4), migration
mécanique **sans changement de comportement** pour les 3 existants, + Loom fonctionnel
(embed + progression + complétion à 90% via le pipeline backend existant).

## Étapes

### 1. Définir le port + registry
`app/video/providers/VideoProvider.js` (nouveau) — doc du contrat (JSDoc `@typedef`) :
```
VideoProvider = {
  id: 'youtube'|'loom'|'cloudflare'|'mp4',
  match(media) -> { providerId, videoId?, url } | null,   // depuis le media object
  renderEmbed(ctx) -> htmlString,                          // ctx: { parsed, stepIndex, courseId, classId, videoDuration }
  initTracking(element, hooks) -> { destroy() }            // hooks: { onPing(currentTime, duration), onEvent(type, currentTime, duration) }
}
```
`app/video/providers/index.js` (nouveau) — registry `VIDEO_PROVIDERS = [youtube, loom, cloudflare, mp4]` + `resolveProvider(media)` (premier `match` non-null) + `resolveProviderById(id)`.

### 2. Adapters (migration mécanique des 3 existants)
- `app/video/providers/youtubeProvider.js` : `match` = extractYoutubeId (déplacé/consommé) ; `renderEmbed` = branche YouTube actuelle de `videoSection` (iframe `youtube.com/embed` + `enablejsapi=1` + data attrs) ; `initTracking` = logique de `youtubeTracking.js` (IFrame API → `onPing`/`onEvent`).
- `app/video/providers/cloudflareProvider.js` : `match` = url `cloudflarestream.com` ; `renderEmbed` = branche CF Stream de `videoSection` ; `initTracking` = bloc `Stream(iframe)` de `setupVideoTracking` (play/pause/ended/timeupdate → `onPing`/`onEvent`).
- `app/video/providers/mp4Provider.js` : `match` = media type VIDEO avec url non-provider (mp4) ; `renderEmbed` = branche `<video>` de `videoSection` ; `initTracking` = `setupNativeVideoTracking`.

### 3. Adapter Loom (nouveau — embed + tracking player.js)
`app/video/providers/loomProvider.js` :
- `match` : url `loom.com/share/<id>` ou `loom.com/embed/<id>` → `{ providerId:'loom', videoId:<id> }`.
- `renderEmbed` : `<iframe id="video-player-${stepIndex}" data-provider="loom" data-loom-id data-video-duration data-course-id data-class-id src="https://www.loom.com/embed/<id>?hide_owner=true&hide_share=true&hideEmbedTopBar=true" allow="autoplay; fullscreen">` dans `.video-container` (même wrapper que YouTube).
- `initTracking` : handshake **player.js** (protocole standard, vérifié live) :
  - au `message` `{context:'player.js', event:'ready'}` de l'iframe → poster
    `{context:'player.js', method:'addEventListener', value:'timeupdate'}` +
    `play`/`pause`/`ended`.
  - sur `{event:'timeupdate', value:{seconds, duration}}` → `onPing(seconds, duration)`.
  - sur `play`/`pause`/`ended` → `onEvent('VIDEO_PLAY'|'VIDEO_PAUSE'|…)`.
  - `destroy()` retire le listener.
  - Pas de dépendance npm : ~40 LOC postMessage (le frontend charge des ES modules
    directs, pas de bundler → on évite d'ajouter `player.js` en dep).

### 4. Câbler `parseMediaUrl` + `videoSection` + `setupVideoTracking` sur le port
- `parseMediaUrl.js` : ajouter la détection `loom.com` → `{type:'VIDEO', source:'loom'}` (garde le reste ; le port devient l'autorité mais on garde `parseMediaUrl` cohérent car consommé ailleurs — `_mediaHelpers.getVideoInfo`, renderer `hasVideo`).
- `_mediaHelpers.getVideoInfo` : retourner le provider résolu + son `videoId` (extended pour loom, pas que youtube).
- `videoSection.js` : remplacer les branches par `resolveProvider(media).renderEmbed(ctx)` (garde le speedControl + subtitles pour mp4). Fallback : si aucun provider → `''`.
- `setupVideoTracking.js` : lire `data-provider` sur l'élément → `resolveProviderById(id).initTracking(el, { onPing: sendVideoPing-wrap, onEvent: sendVideoEvent-wrap })`. Conserver `stopVideoTracking` (appelle `destroy()` du provider courant).

### 5. Nettoyage dette (§ BIG BANG)
Supprimer `youtubeTracking.js` (logique déplacée dans youtubeProvider) + les branches
mortes de `videoSection`/`setupVideoTracking` post-migration. Un seul chemin par
provider, via le port.

### 6. Tests
- `app/video/providers/__tests__/registry.test.js` : `resolveProvider` mappe
  youtube/loom/cloudflare/mp4 correctement + null sur inconnu.
- `loomProvider.test.js` : `match` parse share + embed ids ; `renderEmbed` produit
  l'iframe `loom.com/embed/<id>` avec les data attrs + `id=video-player-N`.
- `youtubeProvider.test.js` (migré depuis videoYoutube.test) : embed + match inchangés.
- `npx tsc` 0 · `npm test` vert · entropy RATCHET OK.

### 7. Déploiement + vérif live (§ PLAN FRONTEND DONE)
Déployer lms-viewer. Seed rapide (SQL ou via l'API Plan 02) d'1 leçon Loom + 1 YouTube
sur un cours de test. tpb-browser :
- YouTube : joue + pings émis (inchangé, non-régression).
- Loom : l'iframe `loom.com/embed` **joue**, le handshake player.js émet des
  `timeupdate` → pings envoyés → (sur un compte à ≥90%) la complétion se déclenche
  (quiz unlock / step complete).
- 0 erreur console, fresh + reload.

## Fichiers

- `app/video/providers/VideoProvider.js` (nouveau — contrat/typedef)
- `app/video/providers/index.js` (nouveau — registry)
- `app/video/providers/{youtube,loom,cloudflare,mp4}Provider.js` (nouveaux)
- `app/video/providers/__tests__/*.test.js` (nouveaux)
- `app/course/renderer.functions/videoSection.js` (dispatcher thin)
- `app/course/renderer.functions/_mediaHelpers.js` (getVideoInfo → provider-aware)
- `app/content/loader/parseMediaUrl.js` (+ loom)
- `app/video/tracking/setupVideoTracking.js` (dispatch data-provider)
- `app/video/tracking/youtubeTracking.js` (SUPPRIMÉ, migré)
- i18n : rien de neuf (labels vidéo déjà i18n).

## Critères

- Port `VideoProvider` + registry + 4 adapters en place ; `videoSection`/`setupVideoTracking` = dispatchers thin.
- YouTube + CF Stream + mp4 : comportement **identique** (non-régression, vérifié).
- Loom : embed joue + tracking player.js émet pings/events + complétion à 90% via pipeline backend.
- `youtubeTracking.js` supprimé (zéro branche morte).
- tsc 0 · tests verts · entropy RATCHET OK · 0 erreur console live (YouTube + Loom).

## Risques

- **player.js Loom** : vérifié live (event `ready` liste `timeupdate`). Si un event
  manque, `timeupdate` seul suffit (complétion = coverage backend). Fallback documenté.
- **Migration mécanique** : risque de casser YouTube/CF en déplaçant le code. Mitigation :
  déplacement 1:1 + tests de non-régression + vérif live YouTube d'abord.
- **`data-provider` vs dataset legacy** : setupVideoTracking lit aujourd'hui
  `data-youtube-id`/`data-video-url`. On ajoute `data-provider` comme clé canonique de
  dispatch ; garder les data ids par provider.
- **Autoplay Loom** : l'embed peut nécessiter un geste user. Le tracking se branche au
  `ready` (pas besoin d'autoplay) ; les pings démarrent au premier `play` réel.
